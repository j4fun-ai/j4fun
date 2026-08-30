/**
 * 纸上远航：PDF 阅读器以单页纸张呈现真实教材，远航青用于翻页和读取进度；源文件仍保留原始下载入口。
 */
import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist/build/pdf.mjs";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { ChevronLeft, ChevronRight, Download, Keyboard, Loader2, Minus, Plus, RotateCcw } from "lucide-react";

GlobalWorkerOptions.workerSrc = workerUrl;

type PdfCanvasReaderProps = {
  fileName: string;
  url?: string;
  data?: Uint8Array;
  downloadUrl?: string;
  initialPage?: number;
  onPageChange?: (page: number) => void;
  immersive?: boolean;
  onToggleFocus?: () => void;
};

function prettyBytes(value: number) {
  if (!value) return "正在连接…";
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PdfCanvasReader({ fileName, url, data, downloadUrl, initialPage = 1, onPageChange, immersive = false, onToggleFocus }: PdfCanvasReaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [documentProxy, setDocumentProxy] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.3);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    let active = true;
    const task = data
      ? getDocument({ data: data.slice() })
      : getDocument({ url: url ?? "", disableRange: false, disableStream: false, disableAutoFetch: false });
    setDocumentProxy(null);
    setPageNumber(Math.max(1, initialPage));
    setProgress({ loaded: 0, total: 0 });
    setState("loading");
    setError("");

    task.onProgress = ({ loaded, total }) => {
      if (active) setProgress({ loaded, total });
    };
    task.promise
      .then((pdf) => {
        if (active) {
          setDocumentProxy(pdf);
          setPageNumber((page) => Math.min(Math.max(1, page), pdf.numPages));
          setState("ready");
        } else {
          void pdf.destroy();
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setState("error");
          setError(cause instanceof Error ? cause.message : "无法读取此 PDF 文件。");
        }
      });

    return () => {
      active = false;
      void task.destroy();
    };
  }, [data, url]);

  useEffect(() => {
    if (documentProxy && state === "ready") onPageChange?.(pageNumber);
  }, [documentProxy, onPageChange, pageNumber, state]);

  useEffect(() => {
    if (!documentProxy || state !== "ready" || !canvasRef.current) return;
    let cancelled = false;
    let renderTask: { promise: Promise<void>; cancel: () => void } | null = null;

    const renderPage = async () => {
      const page = await documentProxy.getPage(pageNumber);
      if (cancelled || !canvasRef.current) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      const nextRenderTask = page.render({ canvas, canvasContext: context, viewport });
      renderTask = nextRenderTask;
      await nextRenderTask.promise;
    };
    void renderPage().catch((cause: unknown) => {
      if (!cancelled) {
        setState("error");
        setError(cause instanceof Error ? cause.message : "渲染教材页面时出现问题。");
      }
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [documentProxy, pageNumber, scale, state]);

  useEffect(() => {
    if (!documentProxy || state !== "ready") return;

    const isTyping = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    };
    const keydown = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (["ArrowLeft", "PageUp"].includes(event.key)) { event.preventDefault(); setPageNumber((page) => Math.max(1, page - 1)); return; }
      if (["ArrowRight", "PageDown"].includes(event.key)) { event.preventDefault(); setPageNumber((page) => Math.min(documentProxy.numPages, page + 1)); return; }
      if (["+", "="].includes(event.key)) { event.preventDefault(); setScale((value) => Math.min(2, Number((value + 0.15).toFixed(2)))); return; }
      if (event.key === "-") { event.preventDefault(); setScale((value) => Math.max(0.8, Number((value - 0.15).toFixed(2)))); return; }
      if (event.key === "0") { event.preventDefault(); setScale(1.3); return; }
      if (event.key.toLowerCase() === "f" && onToggleFocus) { event.preventDefault(); onToggleFocus(); return; }
      if (event.key.toLowerCase() === "h" || event.key === "?") { event.preventDefault(); setShowShortcuts((visible) => !visible); return; }
      if (event.key === "Escape" && immersive && onToggleFocus) { event.preventDefault(); onToggleFocus(); }
    };

    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [documentProxy, immersive, onToggleFocus, state]);

  const readerHeight = immersive ? "h-full min-h-0" : "min-h-[470px]";
  const fileDownloadUrl = downloadUrl ?? url;

  if (state === "loading") {
    const percent = progress.total ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : 0;
    return (
      <div className={`flex ${readerHeight} flex-col items-center justify-center bg-[#f2eee4] p-7 text-center`}>
        <Loader2 className="animate-spin text-[#167b78]" size={34} />
        <h3 className="mt-5 font-serif text-xl font-semibold">正在翻开教材</h3>
        <p className="mt-2 text-sm text-[#53686b]">直接读取原始 PDF，不经本站保存。</p>
        <div className="mt-5 h-1.5 w-48 overflow-hidden bg-[#d8d0bf]"><div className="h-full bg-[#167b78] transition-[width] duration-200" style={{ width: `${percent || 8}%` }} /></div>
        <p className="mt-2 text-xs text-[#6b8080]">{percent ? `${percent}% · ${prettyBytes(progress.loaded)}` : "准备文件…"}</p>
      </div>
    );
  }

  if (state === "error" || !documentProxy) {
    return (
      <div className={`flex ${readerHeight} flex-col items-center justify-center bg-[#fbefea] p-7 text-center`}>
        <h3 className="font-serif text-xl font-semibold text-[#733e34]">暂时无法在本站渲染这本教材</h3>
        <p className="mt-3 max-w-md text-sm leading-6 text-[#733e34]">{error || "这可能是网络、文件格式或浏览器对公开源文件的限制。"}</p>
        {fileDownloadUrl && <a href={fileDownloadUrl} target="_blank" rel="noreferrer" className="action-button mt-6 bg-[#c9523e] text-white hover:bg-[#ad402f]"><Download size={17} /> 下载或用本地阅读器打开</a>}
      </div>
    );
  }

  return (
    <div className={`flex ${readerHeight} flex-col bg-[#e7e0d0]`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#17303b]/10 bg-[#faf7ef] px-3 py-2.5 text-xs text-[#53686b]">
        <span className="min-w-0 truncate">第 <strong className="text-[#172f39]">{pageNumber}</strong> / {documentProxy.numPages} 页</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setScale((value) => Math.max(0.8, Number((value - 0.15).toFixed(2))))} className="reader-icon" aria-label="缩小页面"><Minus size={14} /></button>
          <button type="button" onClick={() => setScale(1.3)} className="reader-icon" aria-label="恢复默认大小"><RotateCcw size={14} /></button>
          <button type="button" onClick={() => setScale((value) => Math.min(2, Number((value + 0.15).toFixed(2))))} className="reader-icon" aria-label="放大页面"><Plus size={14} /></button>
          <button type="button" onClick={() => setShowShortcuts((visible) => !visible)} className={`reader-icon ml-1 ${showShortcuts ? "border-[#167b78] bg-[#e2f1ed] text-[#167b78]" : ""}`} aria-label="显示阅读快捷键" aria-expanded={showShortcuts}><Keyboard size={14} /></button>
          {fileDownloadUrl && <a href={fileDownloadUrl} target="_blank" rel="noreferrer" className="reader-icon ml-1" aria-label={`下载 ${fileName}`}><Download size={14} /></a>}
        </div>
      </div>
      {showShortcuts && <div className="shortcut-panel border-b border-[#17303b]/10 bg-[#edf7f4] px-3 py-3 text-xs text-[#365a59]" aria-live="polite">
        <span className="font-bold text-[#167b78]">阅读快捷键</span>
        <span><kbd>←</kbd><kbd>→</kbd> / <kbd>PgUp</kbd><kbd>PgDn</kbd> 翻页</span>
        <span><kbd>+</kbd> <kbd>-</kbd> 缩放</span>
        <span><kbd>0</kbd> 恢复大小</span>
        <span><kbd>F</kbd> 专注阅读</span>
        <span><kbd>Esc</kbd> 退出</span>
        <span><kbd>H</kbd> 显示/隐藏提示</span>
      </div>}
      <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
        <canvas ref={canvasRef} className="mx-auto block max-w-full bg-white shadow-[0_10px_28px_rgba(23,47,57,0.23)]" aria-label={`${fileName} 第 ${pageNumber} 页`} />
      </div>
      <div className="flex items-center justify-between border-t border-[#17303b]/10 bg-[#faf7ef] p-2.5">
        <button type="button" onClick={() => setPageNumber((page) => Math.max(1, page - 1))} disabled={pageNumber === 1} className="reader-page-control"><ChevronLeft size={16} /> 上一页</button>
        <span className="font-serif text-sm text-[#167b78]">{pageNumber} / {documentProxy.numPages}</span>
        <button type="button" onClick={() => setPageNumber((page) => Math.min(documentProxy.numPages, page + 1))} disabled={pageNumber === documentProxy.numPages} className="reader-page-control">下一页 <ChevronRight size={16} /></button>
      </div>
    </div>
  );
}
