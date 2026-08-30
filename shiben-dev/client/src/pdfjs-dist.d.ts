/** 纸上远航：为浏览器端 PDF 阅读器声明最小的 pdf.js 接口，保持教材渲染逻辑类型明确。 */
declare module "pdfjs-dist/build/pdf.mjs" {
  export type PDFRenderTask = { promise: Promise<void>; cancel: () => void };
  export type PDFPageProxy = {
    getViewport: (options: { scale: number }) => { width: number; height: number };
    render: (options: { canvas: HTMLCanvasElement; canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => PDFRenderTask;
  };
  export type PDFDocumentProxy = {
    numPages: number;
    getPage: (pageNumber: number) => Promise<PDFPageProxy>;
    destroy: () => Promise<void>;
  };
  export type PDFLoadingTask = {
    promise: Promise<PDFDocumentProxy>;
    onProgress: ((progress: { loaded: number; total: number }) => void) | null;
    destroy: () => Promise<void>;
  };
  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(options: { url?: string; data?: Uint8Array; disableRange?: boolean; disableStream?: boolean; disableAutoFetch?: boolean }): PDFLoadingTask;
}
