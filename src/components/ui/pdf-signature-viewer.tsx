import { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { ChevronLeft, ChevronRight, Loader2, Move } from 'lucide-react';
import { Button } from '@/components/ui/button';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export interface SignaturePlacement {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PdfSignatureViewerProps {
  pdfUrl: string;
  placement: SignaturePlacement;
  signatureDataUrl?: string | null;
  onPlacementChange?: (p: SignaturePlacement) => void;
}

export function PdfSignatureViewer({
  pdfUrl,
  placement,
  signatureDataUrl,
  onPlacementChange,
}: PdfSignatureViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(placement.pageIndex === -1 ? 1 : placement.pageIndex + 1);
  const [totalPages, setTotalPages] = useState(0);
  const [renderScale, setRenderScale] = useState(1);
  const [pageHeightPdf, setPageHeightPdf] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const renderTaskRef = useRef<pdfjs.RenderTask | null>(null);

  // overlay position in PDF coordinate space
  const [overlayPdf, setOverlayPdf] = useState({ x: placement.x, y: placement.y });

  const signaturePage = totalPages > 0
    ? (placement.pageIndex === -1 ? totalPages : placement.pageIndex + 1)
    : null;

  const isSignaturePage = signaturePage !== null && currentPage === signaturePage;

  // screen pixels for overlay derived from PDF coords + current scale
  const overlayScreen = {
    left: overlayPdf.x * renderScale,
    top: pageHeightPdf > 0 ? (pageHeightPdf - overlayPdf.y - placement.height) * renderScale : 0,
    width: placement.width * renderScale,
    height: placement.height * renderScale,
  };

  // load PDF
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    pdfjs.getDocument({ url: pdfUrl }).promise
      .then(doc => {
        if (cancelled) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        if (placement.pageIndex === -1) setCurrentPage(doc.numPages);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Erro ao carregar PDF.');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [pdfUrl]);

  // render page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;

    const render = async () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      const page = await pdfDoc.getPage(currentPage);
      const containerWidth = container.clientWidth || 600;
      const viewport = page.getViewport({ scale: 1 });
      const scale = containerWidth / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      const dpr = window.devicePixelRatio || 1;
      canvas.width = scaledViewport.width * dpr;
      canvas.height = scaledViewport.height * dpr;
      canvas.style.width = `${scaledViewport.width}px`;
      canvas.style.height = `${scaledViewport.height}px`;

      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);

      const renderTask = page.render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        canvas,
        viewport: scaledViewport,
      });
      renderTaskRef.current = renderTask;

      try {
        await renderTask.promise;
        setRenderScale(scale);
        setPageHeightPdf(viewport.height);
      } catch {
        // cancelled — ignore
      }
    };

    render();
  }, [pdfDoc, currentPage]);

  // sync overlay back to initial placement when placement prop changes
  useEffect(() => {
    setOverlayPdf({ x: placement.x, y: placement.y });
  }, [placement.x, placement.y]);

  // drag logic
  const dragState = useRef<{
    startMouseX: number;
    startMouseY: number;
    startPdfX: number;
    startPdfY: number;
  } | null>(null);

  const clampOverlay = useCallback((x: number, y: number) => {
    const minY = 0;
    const maxY = pageHeightPdf > 0 ? pageHeightPdf - placement.height : 9999;
    const canvasWidth = canvasRef.current ? canvasRef.current.clientWidth / renderScale : 9999;
    return {
      x: Math.max(0, Math.min(x, canvasWidth - placement.width)),
      y: Math.max(minY, Math.min(y, maxY)),
    };
  }, [pageHeightPdf, placement.width, placement.height, renderScale]);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    dragState.current = {
      startMouseX: clientX,
      startMouseY: clientY,
      startPdfX: overlayPdf.x,
      startPdfY: overlayPdf.y,
    };

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!dragState.current) return;
      const cx = 'touches' in ev ? ev.touches[0].clientX : (ev as MouseEvent).clientX;
      const cy = 'touches' in ev ? ev.touches[0].clientY : (ev as MouseEvent).clientY;
      const dxScreen = cx - dragState.current.startMouseX;
      const dyScreen = cy - dragState.current.startMouseY;
      const dxPdf = dxScreen / renderScale;
      const dyPdf = -dyScreen / renderScale; // flip: screen Y down = PDF Y up
      const next = clampOverlay(
        dragState.current.startPdfX + dxPdf,
        dragState.current.startPdfY + dyPdf,
      );
      setOverlayPdf(next);
    };

    const onUp = () => {
      if (!dragState.current) return;
      dragState.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      // read final position from ref to avoid stale closure, then notify parent
      setOverlayPdf(prev => {
        // schedule outside the updater to avoid calling side effects during setState
        setTimeout(() => {
          onPlacementChange?.({ ...placement, x: prev.x, y: prev.y });
        }, 0);
        return prev;
      });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }, [overlayPdf, renderScale, placement, onPlacementChange, clampOverlay]);

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#CE9F48]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-red-400">{error}</div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-lg border border-[#e3d5bd] dark:border-white/10 bg-white dark:bg-black"
      >
        <canvas ref={canvasRef} className="block w-full" />

        {isSignaturePage && renderScale > 0 && pageHeightPdf > 0 && (
          <div
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            style={{
              position: 'absolute',
              left: overlayScreen.left,
              top: overlayScreen.top,
              width: overlayScreen.width,
              height: overlayScreen.height,
              cursor: 'grab',
              touchAction: 'none',
            }}
            className="group"
          >
            {signatureDataUrl ? (
              <img
                src={signatureDataUrl}
                alt="assinatura"
                className="h-full w-full select-none rounded border border-[#CE9F48]/60 object-contain"
                draggable={false}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-[#CE9F48] bg-[#CE9F48]/10">
                <span className="text-[10px] text-[#9a6a16] select-none">Assinatura aqui</span>
              </div>
            )}
            <div className="pointer-events-none absolute -top-5 right-0 flex items-center gap-1 opacity-70 group-hover:opacity-100">
              <Move className="h-3 w-3 text-[#CE9F48]" />
              <span className="text-[9px] text-[#9a6a16]">arrastar</span>
            </div>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="border-[#e3d5bd] dark:border-white/10 bg-[#f3ead9] dark:bg-white/5 text-[#1f1a14] dark:text-white hover:bg-[#eadbbf] dark:hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-[#8a7b66] dark:text-gray-400">
            Página {currentPage} de {totalPages}
            {isSignaturePage && (
              <span className="ml-2 font-bold text-[#9a6a16] dark:text-[#CE9F48]">← assinar aqui</span>
            )}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="border-[#e3d5bd] dark:border-white/10 bg-[#f3ead9] dark:bg-white/5 text-[#1f1a14] dark:text-white hover:bg-[#eadbbf] dark:hover:bg-white/10"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
