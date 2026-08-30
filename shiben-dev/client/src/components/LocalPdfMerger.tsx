/**
 * 纸上远航：本地 PDF 合并器像一张整理分卷资料的工作台；不上传任何教材文件，只在当前浏览器内拼接并下载。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CheckCircle2, Download, Files, FolderUp, Loader2, RotateCcw, Trash2, UploadCloud } from "lucide-react";

type PdfGroup = {
  outputName: string;
  parts: File[];
  totalSize: number;
};

type LocalPdfMergerProps = {
  onOpenMergedPdf: (pdf: { name: string; data: Uint8Array; downloadUrl: string }) => void;
  autoMerge?: { outputName: string; parts: Array<{ name: string; downloadUrl: string }> } | null;
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const partPattern = /^(.*\.pdf)\.(\d+)$/i;

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function makeGroups(fileList: File[]) {
  const groups = new Map<string, File[]>();
  const skipped: string[] = [];
  for (const file of fileList) {
    const match = file.name.match(partPattern);
    if (!match) {
      skipped.push(file.name);
      continue;
    }
    const outputName = match[1];
    const items = groups.get(outputName) ?? [];
    items.push(file);
    groups.set(outputName, items);
  }
  return {
    groups: Array.from(groups.entries()).map(([outputName, parts]: [string, File[]]) => ({
      outputName,
      parts: [...parts].sort((a, b) => collator.compare(a.name, b.name)),
      totalSize: parts.reduce((total: number, item: File) => total + item.size, 0),
    })).sort((a, b) => collator.compare(a.outputName, b.outputName)),
    skipped,
  };
}

export default function LocalPdfMerger({ onOpenMergedPdf, autoMerge }: LocalPdfMergerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [groups, setGroups] = useState<PdfGroup[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [mergingAction, setMergingAction] = useState<"open" | "download" | null>(null);
  const [status, setStatus] = useState("");
  const [autoState, setAutoState] = useState<"idle" | "loading" | "error">("idle");
  const [autoProgress, setAutoProgress] = useState({ loaded: 0, total: 0 });
  const [autoError, setAutoError] = useState("");
  const [retryAttempt, setRetryAttempt] = useState(0);

  const partCount = useMemo(() => groups.reduce((total, group) => total + group.parts.length, 0), [groups]);
  const showManualFallback = !autoMerge || autoState === "error";

  const receiveFiles = (files: FileList | File[]) => {
    const { groups: nextGroups, skipped: nextSkipped } = makeGroups(Array.from(files));
    setGroups(nextGroups);
    setSkipped(nextSkipped);
    if (!nextGroups.length) {
      setStatus("没有识别到分卷文件。文件名需要类似“教材.pdf.1”或“教材.pdf.001”。");
      return;
    }
    setStatus(`已识别 ${nextGroups.length} 份教材，共 ${nextGroups.reduce((total, group) => total + group.parts.length, 0)} 个分卷。`);
  };

  const mergeGroup = async (group: PdfGroup) => {
    const buffers = await Promise.all(group.parts.map((part) => part.arrayBuffer()));
    return new Blob(buffers, { type: "application/pdf" });
  };

  const autoKey = autoMerge ? `${autoMerge.outputName}:${autoMerge.parts.map((part) => part.name).join("|")}` : "";

  useEffect(() => {
    if (!autoMerge || autoMerge.parts.length < 2) return;
    let active = true;
    const mergeRemoteParts = async () => {
      setAutoState("loading");
      setAutoProgress({ loaded: 0, total: autoMerge.parts.length });
      setAutoError("");
      try {
        const buffers: ArrayBuffer[] = [];
        for (let index = 0; index < autoMerge.parts.length; index += 1) {
          const part = autoMerge.parts[index];
          const response = await fetch(part.downloadUrl);
          if (!response.ok) throw new Error(`无法下载第 ${index + 1} 个分卷（${response.status}）`);
          buffers.push(await response.arrayBuffer());
          if (active) setAutoProgress({ loaded: index + 1, total: autoMerge.parts.length });
        }
        if (!active) return;
        const mergedFile = new Blob(buffers, { type: "application/pdf" });
        onOpenMergedPdf({
          name: autoMerge.outputName,
          data: new Uint8Array(await mergedFile.arrayBuffer()),
          downloadUrl: URL.createObjectURL(mergedFile),
        });
      } catch (cause) {
        if (!active) return;
        setAutoState("error");
        setAutoError(cause instanceof Error ? cause.message : "自动合成暂时没有完成。");
      }
    };
    void mergeRemoteParts();
    return () => { active = false; };
  }, [autoKey, autoMerge, onOpenMergedPdf, retryAttempt]);

  const mergeAndDownload = async () => {
    setMergingAction("download");
    setStatus("正在按文件名序号拼接分卷并准备下载，请不要关闭此页面…");
    try {
      for (const group of groups) {
        const mergedFile = await mergeGroup(group);
        const objectUrl = URL.createObjectURL(mergedFile);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = group.outputName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      }
      setStatus(`已在此设备上合并并下载 ${groups.length} 份 PDF。源文件没有被上传或删除。`);
    } catch {
      setStatus("合并未完成。请确认已重新下载全部分卷，然后再试一次。");
    } finally {
      setMergingAction(null);
    }
  };

  const mergeAndOpen = async () => {
    const group = groups[0];
    if (!group || groups.length !== 1) return;
    setMergingAction("open");
    setStatus("正在将分卷拼接为完整 PDF，并在本站阅读器中打开…");
    try {
      const mergedFile = await mergeGroup(group);
      onOpenMergedPdf({
        name: group.outputName,
        data: new Uint8Array(await mergedFile.arrayBuffer()),
        downloadUrl: URL.createObjectURL(mergedFile),
      });
      setStatus("完整 PDF 已在本站阅读器中打开。关闭或切换文件后，本地临时文件会自动释放。");
    } catch {
      setStatus("合并未完成。请确认已重新下载全部分卷，然后再试一次。");
    } finally {
      setMergingAction(null);
    }
  };

  const clearFiles = () => {
    setGroups([]);
    setSkipped([]);
    setStatus("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="local-merger border border-[#c9523e]/30 bg-[#fffaf6] p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="eyebrow text-[#c9523e]">{autoMerge ? "自动合成" : "本地合成器"}</p>
          <h3 className="mt-2 font-serif text-2xl font-semibold text-[#172f39]">{autoMerge ? "正在合成完整 PDF，请稍后" : "选择全部分卷进行合成"}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#53686b]">{autoMerge ? `已找到 ${autoMerge.parts.length} 个分卷。合成完成后会自动在本站打开。` : <>选择命名为 <code>教材.pdf.1</code>、<code>教材.pdf.2</code> 的全部文件。</>}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 border border-[#167b78]/30 bg-[#e5f3ef] px-3 py-2 text-xs font-semibold text-[#167b78]"><CheckCircle2 size={15} /> 不上传文件</span>
      </div>

      {autoMerge && <div className={`mt-5 border-l-2 px-4 py-3 text-sm leading-6 ${autoState === "error" ? "border-[#c9523e] bg-[#fceee9] text-[#733e34]" : "border-[#167b78] bg-[#edf8f4] text-[#245c58]"}`}>
        {autoState === "loading" ? <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={17} /> 正在下载并合成第 {Math.max(1, autoProgress.loaded + 1)} / {autoProgress.total} 个分卷…</span> : <span>{autoError || "正在准备自动合成…"}</span>}
        {autoState === "error" && <button type="button" onClick={() => setRetryAttempt((attempt) => attempt + 1)} className="mt-2 inline-flex items-center gap-1 font-semibold underline"><RotateCcw size={14} /> 重新自动合成</button>}
      </div>}

      {autoMerge && autoState === "error" && <div className="mt-5 border border-[#c9523e]/20 bg-white p-4">
        <p className="text-sm font-semibold text-[#733e34]">自动合成失败。请下载全部分卷，再使用下方的本地合成器。</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {autoMerge.parts.map((part) => <a key={part.name} href={part.downloadUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 border border-[#c9523e]/25 bg-[#fff7f3] px-3 py-2 text-xs font-semibold text-[#9a4637] hover:border-[#c9523e]"><Download size={14} /> {part.name}</a>)}
        </div>
      </div>}

      {showManualFallback && <>
      <input ref={inputRef} id="pdf-part-input" type="file" multiple className="sr-only" onChange={(event) => receiveFiles(event.target.files ?? [])} />
      <label
        htmlFor="pdf-part-input"
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); receiveFiles(event.dataTransfer.files); }}
        className={`mt-5 flex min-h-32 cursor-pointer flex-col items-center justify-center border-2 border-dashed p-5 text-center transition ${dragging ? "border-[#167b78] bg-[#e8f4f0]" : "border-[#c58d7f]/60 bg-white hover:border-[#167b78] hover:bg-[#f3faf8]"}`}
      >
        <UploadCloud size={28} className="text-[#167b78]" />
        <strong className="mt-3 text-sm text-[#172f39]">选择全部分卷，或直接拖到这里</strong>
        <span className="mt-1 text-xs text-[#6b8080]">支持多本教材同时整理；仅识别名称含 .pdf.序号 的文件。</span>
      </label>

      {status && <p className={`mt-4 border-l-2 px-3 py-2 text-sm leading-6 ${groups.length ? "border-[#167b78] bg-[#edf8f4] text-[#245c58]" : "border-[#c9523e] bg-[#fceee9] text-[#733e34]"}`}>{status}</p>}
      {skipped.length > 0 && <p className="mt-3 text-xs leading-5 text-[#8a604e]">已忽略 {skipped.length} 个不符合分卷命名的文件。</p>}

      {groups.length > 0 && <div className="mt-5 grid gap-3">
        {groups.map((group) => (
          <article key={group.outputName} className="border border-[#17303b]/12 bg-white p-4">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center"><div className="flex min-w-0 items-center gap-2"><Files size={18} className="shrink-0 text-[#167b78]" /><h4 className="truncate text-sm font-semibold text-[#172f39]">{group.outputName}</h4></div><span className="text-xs text-[#6b8080]">{group.parts.length} 个分卷 · {formatBytes(group.totalSize)}</span></div>
            <div className="mt-3 flex flex-wrap gap-1.5">{group.parts.map((part) => <span key={`${part.name}-${part.lastModified}`} className="border border-[#17303b]/10 bg-[#f7f2e8] px-2 py-1 text-xs text-[#53686b]">{part.name}</span>)}</div>
          </article>
        ))}
      </div>}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button type="button" disabled={groups.length !== 1 || Boolean(mergingAction)} onClick={() => void mergeAndOpen()} className="action-button justify-center bg-[#167b78] text-white hover:bg-[#0e6562] disabled:cursor-not-allowed disabled:opacity-45">{mergingAction === "open" ? <Loader2 className="animate-spin" size={17} /> : <BookOpen size={17} />}{mergingAction === "open" ? "正在合并并打开…" : "合并并在本站打开"}</button>
        <button type="button" disabled={!groups.length || Boolean(mergingAction)} onClick={() => void mergeAndDownload()} className="action-button justify-center bg-[#c9523e] text-white hover:bg-[#ad402f] disabled:cursor-not-allowed disabled:opacity-45">{mergingAction === "download" ? <Loader2 className="animate-spin" size={17} /> : <Download size={17} />}{mergingAction === "download" ? "正在合并并下载…" : `合并并下载${groups.length ? `（${groups.length} 份）` : ""}`}</button>
        <button type="button" disabled={!groups.length || Boolean(mergingAction)} onClick={clearFiles} className="action-button justify-center border border-[#17303b]/15 bg-white text-[#53686b] hover:border-[#c9523e] hover:text-[#c9523e] disabled:cursor-not-allowed disabled:opacity-45"><Trash2 size={16} /> 清除选择</button>
        {partCount > 0 && <span className="self-center text-xs text-[#6b8080]">已在当前浏览器中暂存 {partCount} 个分卷</span>}
      </div>
      </>}
      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-[#6b8080]"><FolderUp className="mt-0.5 shrink-0 text-[#167b78]" size={14} />自动下载、排序和合并均在本设备的浏览器内完成。若自动下载被网络限制阻断，可使用本地文件兜底；文件不会上传到本站。</p>
    </div>
  );
}
