/**
 * 纸上远航：教材浏览器是“家庭资料夹”的数字化版本；目录保持纸张层次，远航青承担所有浏览路径与当前状态。
 * 数据只读取 ChinaTextbook 的公开 GitHub Contents API，不复制或托管教材文件；PDF 以原始公开链接嵌入站内阅读窗。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileArchive,
  FileText,
  Focus,
  Folder,
  LibraryBig,
  Loader2,
  Maximize2,
  PanelRightClose,
  PanelRightOpen,
  Search,
  X,
} from "lucide-react";
import PdfCanvasReader from "@/components/PdfCanvasReader";
import LocalPdfMerger from "@/components/LocalPdfMerger";
import { loadReadingEntries, saveReadingEntries, type ReadingEntry } from "@/lib/readingStore";

const REPO = "TapXWorld/ChinaTextbook";
const REPO_URL = `https://github.com/${REPO}`;
const J4FUN_HOME_URL = import.meta.env.BASE_URL.replace(/shiben\/?$/, "") || "/";
const DEFAULT_PATH = "";
const imagePath = (name: string) => `${import.meta.env.BASE_URL}images/${name}`;

type GitHubItem = {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
  size?: number;
  html_url?: string;
  download_url?: string | null;
};

type LocalPdf = {
  name: string;
  data: Uint8Array;
  downloadUrl: string;
};

const shortcuts = [
  { label: "小学", path: "小学", note: "一至六年级" },
  { label: "初中", path: "初中", note: "七至九年级" },
  { label: "高中", path: "高中", note: "十至十二年级" },
  { label: "大学", path: "大学", note: "大学课程" },
];

function encodePath(path: string) {
  return path.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function parentPath(path: string) {
  return path.split("/").slice(0, -1).join("/");
}

function formatSize(size?: number) {
  if (!size) return "文件大小未标注";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdf(item: GitHubItem | null) {
  return Boolean(item && /\.pdf$/i.test(item.name));
}

function isSplitPdf(item: GitHubItem | null) {
  return Boolean(item && /\.pdf\.\d+$/i.test(item.name));
}

function readInitialBrowseState() {
  if (typeof window === "undefined") return { path: DEFAULT_PATH, filePath: null as string | null, page: 1 };
  const params = new URLSearchParams(window.location.search);
  const rawPage = Number(params.get("page"));
  return {
    path: params.get("root") === "1" ? "" : params.get("path") ?? DEFAULT_PATH,
    filePath: params.get("file"),
    page: Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1,
  };
}

export default function TextbookBrowser() {
  const [initialBrowseState] = useState(readInitialBrowseState);
  const cache = useRef(new Map<string, GitHubItem[]>());
  const [path, setPath] = useState(initialBrowseState.path);
  const [pendingFilePath, setPendingFilePath] = useState<string | null>(initialBrowseState.filePath);
  const [activePage, setActivePage] = useState(initialBrowseState.page);
  const [items, setItems] = useState<GitHubItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<GitHubItem | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showFiles, setShowFiles] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [localPdf, setLocalPdf] = useState<LocalPdf | null>(null);
  const [readingEntries, setReadingEntries] = useState<ReadingEntry[]>(loadReadingEntries);
  const readerRef = useRef<HTMLElement>(null);

  useEffect(() => () => {
    if (localPdf) URL.revokeObjectURL(localPdf.downloadUrl);
  }, [localPdf]);

  const loadDirectory = useCallback(async (nextPath: string, targetFilePath: string | null = null, restoredPage = 1) => {
    setLocalPdf(null);
    setLoading(true);
    setError("");
    setQuery("");
    setPendingFilePath(targetFilePath);
    setActivePage(restoredPage);

    const resolveSelectedFile = (directoryItems: GitHubItem[]) => {
      if (!nextPath) return null;
      const target = targetFilePath ? directoryItems.find((item) => item.path === targetFilePath || item.name === targetFilePath) : null;
      return target ?? directoryItems.find((item) => isPdf(item)) ?? directoryItems.find((item) => item.type === "file") ?? null;
    };

    const cached = cache.current.get(nextPath);
    if (cached) {
      setPath(nextPath);
      setItems(cached);
      setSelectedFile(resolveSelectedFile(cached));
      setLoading(false);
      return;
    }

    try {
      const endpoint = `https://api.github.com/repos/${REPO}/contents/${encodePath(nextPath)}?ref=master`;
      const response = await fetch(endpoint, { headers: { Accept: "application/vnd.github+json" } });
      if (!response.ok) {
        if (response.status === 403) throw new Error("GitHub 的匿名访问额度暂时已满，请稍后再试。你也可以直接打开原项目继续浏览。");
        throw new Error(`原始目录暂时无法读取（${response.status}）。请稍后重试。`);
      }
      const payload = await response.json();
      const nextItems: GitHubItem[] = Array.isArray(payload) ? payload : [payload];
      nextItems.sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name, "zh-CN");
      });
      cache.current.set(nextPath, nextItems);
      setPath(nextPath);
      setItems(nextItems);
      setSelectedFile(resolveSelectedFile(nextItems));
    } catch (cause) {
      setItems([]);
      setSelectedFile(null);
      setError(cause instanceof Error ? cause.message : "读取原始目录时发生了未知问题。请稍后重试。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDirectory(initialBrowseState.path, initialBrowseState.filePath, initialBrowseState.page);
  }, [loadDirectory]);

  useEffect(() => {
    saveReadingEntries(readingEntries);
  }, [readingEntries]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (path) params.set("path", path);
    else params.set("root", "1");
    if (selectedFile?.type === "file") params.set("file", selectedFile.path);
    if (activePage > 1) params.set("page", String(activePage));
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) window.history.replaceState(null, "", nextUrl);
  }, [activePage, path, selectedFile?.path]);

  useEffect(() => {
    const syncFullscreenState = () => {
      if (!document.fullscreenElement) setFocusMode(false);
    };
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized ? items.filter((item) => item.name.toLocaleLowerCase().includes(normalized)) : items;
  }, [items, query]);
  const browseItems = useMemo(() => path === "" ? filteredItems.filter((item) => item.type === "dir") : filteredItems, [filteredItems, path]);
  const folderCount = items.filter((item) => item.type === "dir").length;
  const fileCount = items.length - folderCount;
  const autoMerge = useMemo(() => {
    const matched = selectedFile?.name.match(/^(.*\.pdf)\.(\d+)$/i);
    if (!matched) return null;
    const outputName = matched[1];
    const parts = items
      .filter((item) => item.type === "file" && item.download_url && item.name.match(/^(.*\.pdf)\.(\d+)$/i)?.[1] === outputName)
      .map((item) => ({ name: item.name, downloadUrl: item.download_url as string }))
      .sort((left, right) => left.name.localeCompare(right.name, "zh-CN", { numeric: true }));
    return parts.length > 1 ? { outputName, parts } : null;
  }, [items, selectedFile]);
  const pdfSource = localPdf
    ? { name: localPdf.name, data: localPdf.data, downloadUrl: localPdf.downloadUrl }
    : isPdf(selectedFile) && selectedFile?.download_url
      ? { name: selectedFile.name, url: selectedFile.download_url }
      : null;
  const hasPreviewablePdf = Boolean(pdfSource);

  const updateReadingEntry = useCallback((file: GitHubItem, page: number, favorite?: boolean) => {
    if (!isPdf(file)) return;
    setReadingEntries((entries) => {
      const existing = entries.find((entry) => entry.filePath === file.path);
      const nextEntry: ReadingEntry = {
        filePath: file.path,
        directory: parentPath(file.path),
        fileName: file.name,
        page,
        favorite: favorite ?? existing?.favorite ?? false,
        updatedAt: Date.now(),
      };
      return [nextEntry, ...entries.filter((entry) => entry.filePath !== file.path)].sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 40);
    });
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setActivePage(page);
    if (selectedFile && !localPdf) updateReadingEntry(selectedFile, page);
  }, [localPdf, selectedFile, updateReadingEntry]);

  const currentReadingEntry = selectedFile ? readingEntries.find((entry) => entry.filePath === selectedFile.path) : undefined;

  const openItem = (item: GitHubItem) => {
    setLocalPdf(null);
    if (item.type === "dir") {
      void loadDirectory(item.path);
      return;
    }
    setActivePage(1);
    setPendingFilePath(item.path);
    setSelectedFile(item);
  };

  const toggleFavorite = () => {
    if (!selectedFile || !isPdf(selectedFile) || localPdf) return;
    updateReadingEntry(selectedFile, activePage, !currentReadingEntry?.favorite);
  };

  const openMergedPdf = ({ name, data, downloadUrl }: LocalPdf) => {
    setLocalPdf((existing) => {
      if (existing) URL.revokeObjectURL(existing.downloadUrl);
      return { name, data, downloadUrl };
    });
    setShowFiles(false);
  };

  const enterFocusMode = () => {
    setShowFiles(false);
    setFocusMode(true);
    if (readerRef.current?.requestFullscreen) {
      void readerRef.current.requestFullscreen().catch(() => {
        // 浏览器拒绝全屏时仍保留站内的覆盖式专注阅读布局。
      });
    }
  };

  const exitFocusMode = () => {
    setFocusMode(false);
    if (document.fullscreenElement) void document.exitFullscreen();
  };

  const desktopGrid = showFiles ? "lg:grid-cols-[minmax(340px,0.9fr)_minmax(460px,1.25fr)]" : "lg:grid-cols-1";

  return (
    <div className="min-h-screen bg-[#f7f2e8] text-[#172f39]">
      <header className="sticky top-0 z-40 border-b border-[#17303b]/10 bg-[#f7f2e8]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[74px] max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-9">
          <Link href="/" className="group flex items-center gap-3" aria-label="返回华文教材库首页">
            <img src={imagePath("huawen-textbook-mark.svg")} alt="" className="h-11 w-11 rounded-full border-2 border-[#167b78]/25 bg-[#d7ebe5] p-1.5 object-contain transition-transform group-hover:-rotate-3" />
            <span className="leading-none"><span className="block font-serif text-[18px] font-semibold tracking-[0.15em]">识本</span><span className="mt-1 block text-xs font-semibold tracking-[0.18em] text-[#167b78]">华文教材库</span></span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <a href={J4FUN_HOME_URL} className="action-button border border-[#17303b]/15 bg-white/70 py-2.5 text-[#172f39] hover:border-[#167b78] hover:text-[#167b78]">J4FUN 出品</a>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="action-button hidden border border-[#17303b]/15 bg-white/70 py-2.5 text-[#172f39] hover:border-[#167b78] hover:text-[#167b78] sm:inline-flex">原始项目 <ArrowUpRight size={15} /></a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 pb-10 pt-6 sm:px-6 lg:px-9">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div><p className="eyebrow text-[#167b78]">教材主目录</p><h1 className="mt-2 font-serif text-2xl font-semibold sm:text-3xl">选择学段</h1></div>
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#167b78] transition hover:text-[#0e6562]"><ArrowLeft size={16} /> 返回识本首页</Link>
        </div>

        <section className="mb-6 grid gap-2 border-b border-[#17303b]/10 pb-6 sm:grid-cols-4" aria-label="教材主目录">
          {shortcuts.map((shortcut) => {
            const active = path === shortcut.path;
            return (
              <button
                type="button"
                key={shortcut.path}
                onClick={() => void loadDirectory(shortcut.path)}
                className={`relative border p-3 text-left transition ${active ? "border-[#167b78] bg-[#167b78] text-white shadow-[4px_4px_0_#c9523e]" : "border-[#17303b]/15 bg-white/45 hover:border-[#167b78]/60 hover:bg-white"}`}
              >
                <span className={`block font-serif text-lg font-semibold ${active ? "text-white" : "text-[#172f39]"}`}>{shortcut.label}</span>
                <span className={`mt-0.5 block text-xs ${active ? "text-[#e1f7f2]" : "text-[#53686b]"}`}>{shortcut.note}</span>
                {active && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#f4d5c9]" />}
              </button>
            );
          })}
        </section>

        <section className="overflow-hidden border border-[#17303b]/15 bg-[#fbf8f0] shadow-[12px_14px_0_rgba(22,123,120,0.08)]">
          <div className={`grid min-h-[690px] ${desktopGrid}`}>
            {showFiles && <section className="flex min-h-[400px] flex-col border-b border-[#17303b]/15 bg-[#fdfbf6] lg:border-b-0 lg:border-r" aria-label="当前目录文件列表">
              <div className="border-b border-[#17303b]/10 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div><p className="eyebrow text-[#167b78]">{path || "教材主目录"}</p><p className="mt-2 text-xs text-[#53686b]">{path ? `${folderCount} 个目录 · ${fileCount} 个文件` : "选择小学、初中、高中或大学"}</p></div>
                  {path && <button type="button" onClick={() => void loadDirectory(parentPath(path))} className="inline-flex items-center gap-1 text-xs font-semibold text-[#167b78] hover:text-[#0e6562]"><ChevronLeft size={15} /> 上一级</button>}
                </div>
                <label className="relative mt-5 block">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b8080]" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="在当前目录内查找文件名" className="h-10 w-full border border-[#17303b]/15 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[#167b78]" />
                </label>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
                {loading && <div className="flex h-56 items-center justify-center gap-3 text-sm text-[#53686b]"><Loader2 className="animate-spin text-[#167b78]" size={20} /> 正在打开原始目录…</div>}
                {!loading && error && <div className="m-2 border-l-4 border-[#c9523e] bg-[#f8e9e4] p-4 text-sm leading-6 text-[#733e34]">{error}<a className="mt-2 inline-flex items-center gap-1 font-semibold underline" href={REPO_URL} target="_blank" rel="noreferrer">打开原始项目 <ArrowUpRight size={14} /></a></div>}
                {!loading && !error && browseItems.length === 0 && <div className="flex h-48 items-center justify-center text-sm text-[#53686b]">当前目录没有与“{query}”匹配的项目。</div>}
                {!loading && !error && browseItems.map((item) => {
                  const active = selectedFile?.path === item.path;
                  const split = isSplitPdf(item);
                  return (
                    <button type="button" key={item.path} onClick={() => openItem(item)} className={`group grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 border-b border-[#17303b]/8 px-3 py-3 text-left transition ${active ? "bg-[#d9eee8]" : "hover:bg-[#f1ebdf]"}`}>
                      {item.type === "dir" ? <Folder size={19} className="fill-[#cfe6df] text-[#167b78]" /> : split ? <FileArchive size={19} className="text-[#c9523e]" /> : <FileText size={19} className="text-[#167b78]" />}
                      <span className="min-w-0"><span className="block truncate text-sm font-medium text-[#172f39]">{item.name}</span><span className="mt-0.5 block text-xs text-[#6b8080]">{item.type === "dir" ? "打开目录" : split ? "分卷文件 · 下载后合并" : formatSize(item.size)}</span></span>
                      {item.type === "dir" ? <ChevronRight size={17} className="text-[#6b8080] group-hover:text-[#167b78]" /> : <span className={`text-xs font-bold ${isPdf(item) ? "text-[#167b78]" : "text-[#c9523e]"}`}>{isPdf(item) ? "阅读" : "文件"}</span>}
                    </button>
                  );
                })}
              </div>
            </section>}

            <section ref={readerRef} className={`flex min-h-[520px] flex-col bg-[#f7f2e8] ${focusMode ? "fixed inset-0 z-[100] min-h-screen bg-[#f7f2e8] p-3 sm:p-5" : ""}`} aria-label="教材预览">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#17303b]/10 p-4 sm:p-5">
                <div className="min-w-0"><p className="eyebrow text-[#167b78]">{focusMode ? "专注阅读 / 只保留教材" : localPdf ? "本地合并完成 / 站内阅读" : "站内阅读窗"}</p><h2 className="mt-2 truncate font-serif text-lg font-semibold sm:text-xl">{pdfSource?.name ?? selectedFile?.name ?? "先从目录选择一本教材"}</h2></div>
                <div className="flex items-center gap-1.5">
                  {!focusMode && <>
                    <button type="button" onClick={() => setShowFiles((visible) => !visible)} className="reader-layout-control" aria-label={showFiles ? "收起文件列表" : "展开文件列表"} title={showFiles ? "收起文件列表" : "展开文件列表"}>{showFiles ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}<span className="hidden xl:inline">文件</span></button>
                    {hasPreviewablePdf && <button type="button" onClick={enterFocusMode} className="reader-layout-control bg-[#167b78] text-white hover:bg-[#0e6562]" aria-label="进入专注阅读模式"><Focus size={17} /><span className="hidden sm:inline">专注阅读</span><kbd className="shortcut-key shortcut-key-inverse">F</kbd></button>}
                  </>}
                  {focusMode && hasPreviewablePdf && <button type="button" onClick={exitFocusMode} className="reader-layout-control bg-[#172f39] text-white hover:bg-[#294650]" aria-label="退出专注阅读模式"><X size={17} /><span>退出阅读</span><kbd className="shortcut-key shortcut-key-inverse">Esc</kbd></button>}
                  {hasPreviewablePdf && selectedFile && !localPdf && <button type="button" onClick={toggleFavorite} className={`reader-layout-control ${currentReadingEntry?.favorite ? "border-[#c9523e] bg-[#f9e8e1] text-[#c9523e]" : ""}`} aria-label={currentReadingEntry?.favorite ? "取消收藏" : "收藏这本教材"} title={currentReadingEntry?.favorite ? "取消收藏" : "收藏这本教材"}>{currentReadingEntry?.favorite ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}</button>}
                  {!localPdf && selectedFile?.html_url && <a href={selectedFile.html_url} target="_blank" rel="noreferrer" aria-label="在原始仓库页面打开" className="reader-layout-control" title="在原始仓库页面打开"><ExternalLink size={16} /></a>}
                </div>
              </div>
              <div className="min-h-0 flex-1 p-3 sm:p-4">
                {pdfSource ? (
                  <div className={`overflow-hidden border border-[#17303b]/15 bg-white ${focusMode ? "h-full" : ""}`}><PdfCanvasReader fileName={pdfSource.name} url={pdfSource.url} data={pdfSource.data} downloadUrl={pdfSource.downloadUrl} initialPage={localPdf ? 1 : currentReadingEntry?.page ?? activePage} onPageChange={handlePageChange} immersive={focusMode} onToggleFocus={focusMode ? exitFocusMode : enterFocusMode} /></div>
                ) : isSplitPdf(selectedFile) ? (
                  <LocalPdfMerger onOpenMergedPdf={openMergedPdf} autoMerge={autoMerge} />
                ) : selectedFile ? (
                  <div className="flex h-full min-h-[470px] flex-col justify-center border border-dashed border-[#17303b]/25 bg-white/50 p-7 text-center"><FileText className="mx-auto text-[#167b78]" size={38} /><h2 className="mt-5 font-serif text-2xl font-semibold">此文件暂不支持预览</h2><p className="mt-3 text-sm leading-6 text-[#53686b]">可前往原始项目查看文件详情或下载。</p>{selectedFile.html_url && <a href={selectedFile.html_url} target="_blank" rel="noreferrer" className="action-button mx-auto mt-6 border border-[#167b78] bg-white text-[#167b78] hover:bg-[#e4f3ef]">查看原始文件 <ArrowUpRight size={17} /></a>}</div>
                ) : path === "" ? (
                  <div className="flex h-full min-h-[470px] flex-col justify-center border border-dashed border-[#167b78]/35 bg-[#f0f7f4] p-7 text-center"><LibraryBig className="mx-auto text-[#167b78]" size={42} /><h2 className="mt-5 font-serif text-2xl font-semibold">选择一个学段</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#53686b]">然后按学科、年级和教材版本继续查找。</p><div className="mx-auto mt-6 flex max-w-md flex-wrap justify-center gap-2">{shortcuts.map((shortcut) => <button type="button" key={`root-${shortcut.path}`} onClick={() => void loadDirectory(shortcut.path)} className="border border-[#167b78]/25 bg-white px-3 py-2 text-sm font-semibold text-[#167b78] hover:bg-[#e3f2ed]">{shortcut.label}</button>)}</div></div>
                ) : (
                  <div className="flex h-full min-h-[470px] flex-col justify-center border border-dashed border-[#17303b]/25 bg-white/50 p-7 text-center"><BookOpenCheck className="mx-auto text-[#167b78]" size={42} /><h2 className="mt-5 font-serif text-2xl font-semibold">从左侧目录选择一本书</h2><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#53686b]">真实 PDF 文件会在这里直接展开；文件夹则会带你继续进入教材目录。</p></div>
                )}
              </div>
            </section>
          </div>
        </section>

      </main>

      <footer className="border-t border-[#17303b]/10 bg-[#172f39] px-4 py-7 text-[#c7d2cf] sm:px-6 lg:px-9">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center gap-1 text-center text-xs leading-relaxed sm:items-end sm:text-right">
          <a className="font-semibold tracking-[0.08em] hover:text-white" href={J4FUN_HOME_URL}>© 2026 J4FUN</a>
          <span className="text-[#9bafae]">Made with ❤️ (AI)</span>
        </div>
      </footer>
    </div>
  );
}
