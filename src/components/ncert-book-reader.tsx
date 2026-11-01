"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from "react";
import {
  BookOpen,
  Bookmark,
  Maximize2,
  Minimize2,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  File,
  ScrollText,
  SlidersHorizontal,
  X,
  CircleAlert,
  LoaderCircle,
  Minus,
  PanelLeft,
  Plus,
} from "lucide-react";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  RenderTask,
} from "pdfjs-dist/types/src/pdf";

import { cn } from "@/lib/utils";
import { preparePageTurn, ReaderPageTurn, type PageTurn } from "@/components/reader-page-turn";
import type {
  NcertBookManifest,
  NcertCatalogBook,
} from "@/lib/ncert/types";

type NcertBookReaderProps = {
  book: NcertCatalogBook | null;
  className?: string;
  actions?: ReactNode;
};

type ReaderLoadState = "idle" | "loading" | "ready" | "error";

const DEFAULT_PAGE_HEIGHT = 842;
const DEFAULT_PAGE_WIDTH = 595;
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 2.05;
const PAGE_PRELOAD_ROOT_MARGIN = "100% 0px";
const ZOOM_STEP = 0.15;

type PdfJsModule = typeof import("pdfjs-dist/webpack.mjs");

let pdfJsModulePromise: Promise<PdfJsModule> | null = null;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isRenderCancelledError(error: unknown) {
  return error instanceof Error && error.name === "RenderingCancelledException";
}

function loadPdfJs() {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = import("pdfjs-dist/webpack.mjs");
  }

  return pdfJsModulePromise;
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));
}

function getFitScale(
  pageWidth: number,
  pageHeight: number,
  viewerWidth: number,
  viewerHeight: number,
  crop = 0,
  fitWidth = false,
) {
  const visibleFraction = 1 - crop * 2;
  const widthScale = Math.max(1, viewerWidth) / (pageWidth * visibleFraction);
  return fitWidth ? widthScale : Math.min(widthScale, Math.max(1, viewerHeight) / (pageHeight * visibleFraction));
}

function getScaledPageSize(
  pageWidth: number,
  pageHeight: number,
  viewerWidth: number,
  viewerHeight: number,
  zoom: number,
  crop: number,
  fitWidth: boolean,
) {
  const scale = getFitScale(pageWidth, pageHeight, viewerWidth, viewerHeight, crop, fitWidth) * zoom;

  return {
    height: pageHeight * scale,
    scale,
    width: pageWidth * scale,
  };
}

function useElementMetrics<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [metrics, setMetrics] = useState({ height: 0, width: 0 });
  const elementRef = useCallback((node: T | null) => {
    setElement(node);
    if (!node) {
      setMetrics({ height: 0, width: 0 });
    }
  }, []);

  useEffect(() => {
    if (!element) {
      return;
    }

    const updateMetrics = () => {
      setMetrics({
        height: element.clientHeight,
        width: element.clientWidth,
      });
    };

    updateMetrics();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateMetrics);

      return () => {
        window.removeEventListener("resize", updateMetrics);
      };
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setMetrics({
        height: entry.contentRect.height,
        width: entry.contentRect.width,
      });
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [element]);

  return [elementRef, element, metrics.width, metrics.height] as const;
}

function ReaderMessageState({
  className,
  description,
  title,
}: {
  className?: string;
  description: string;
  title: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 items-center justify-center p-6 text-center",
        className,
      )}
    >
      <div className="max-w-md space-y-3">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-white/82 text-stone-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
          <CircleAlert className="size-5" />
        </div>
        <div>
          <p className="font-serif text-2xl text-stone-950">{title}</p>
          <p className="mt-2 text-sm leading-6 text-stone-600">{description}</p>
        </div>
      </div>
    </div>
  );
}

type PdfPageCanvasProps = {
  crop: number;
  fitWidth: boolean;
  displayZoom: number;
  pageNumber: number;
  pdfDocument: PDFDocumentProxy;
  renderZoom: number;
  scrollRoot: HTMLDivElement | null;
  viewerHeight: number;
  viewerWidth: number;
};

const PdfPageCanvas = memo(function PdfPageCanvas({
  crop,
  fitWidth,
  displayZoom,
  pageNumber,
  pdfDocument,
  renderZoom,
  scrollRoot,
  viewerHeight,
  viewerWidth,
}: PdfPageCanvasProps) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [completedRenderToken, setCompletedRenderToken] = useState<string | null>(null);
  const [isNearViewport, setIsNearViewport] = useState(pageNumber <= 2);
  const [pageHeight, setPageHeight] = useState(DEFAULT_PAGE_HEIGHT);
  const [pageWidth, setPageWidth] = useState(DEFAULT_PAGE_WIDTH);
  const [renderFailure, setRenderFailure] = useState<{
    message: string;
    token: string;
  } | null>(null);
  const [shouldRender, setShouldRender] = useState(pageNumber <= 2);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const renderToken =
    shouldRender && isNearViewport && viewerWidth > 0 && viewerHeight > 0
      ? `${pageNumber}:${renderZoom}:${crop}:${fitWidth}:${Math.round(viewerWidth)}:${Math.round(viewerHeight)}`
      : null;
  const renderError =
    renderToken && renderFailure?.token === renderToken ? renderFailure.message : null;
  const rendering = Boolean(
    renderToken && completedRenderToken !== renderToken && !renderError,
  );
  const scaledPageSize = getScaledPageSize(
    pageWidth,
    pageHeight,
    viewerWidth,
    viewerHeight,
    displayZoom,
    crop,
    fitWidth,
  );

  useEffect(() => {
    if (!container) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      const frame = window.requestAnimationFrame(() => {
        setShouldRender(true);
        setIsNearViewport(true);
      });

      return () => {
        window.cancelAnimationFrame(frame);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) {
          return;
        }

        setIsNearViewport(entry.isIntersecting);
        if (!entry.isIntersecting) {
          return;
        }

        setShouldRender(true);
      },
      {
        root: scrollRoot,
        rootMargin: PAGE_PRELOAD_ROOT_MARGIN,
        threshold: 0.01,
      },
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [container, scrollRoot]);

  useEffect(() => {
    if (!canvas || !renderToken) {
      return;
    }

    let cancelled = false;

    void pdfDocument
      .getPage(pageNumber)
      .then(async (page) => {
        if (cancelled) {
          return;
        }

        const context = canvas.getContext("2d", { alpha: false });

        if (!context) {
          throw new Error(`Could not create the drawing surface for page ${pageNumber}.`);
        }

        const baseViewport = page.getViewport({ scale: 1 });
        setPageWidth((currentWidth) => (currentWidth === baseViewport.width ? currentWidth : baseViewport.width));
        setPageHeight((currentHeight) =>
          currentHeight === baseViewport.height ? currentHeight : baseViewport.height,
        );

        const viewport = page.getViewport({
          scale:
            getFitScale(baseViewport.width, baseViewport.height, viewerWidth, viewerHeight, crop, fitWidth) *
            renderZoom,
        });
        const outputScale = window.devicePixelRatio || 1;

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const renderTask = page.render({
          canvas,
          canvasContext: context,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
          viewport,
        });

        renderTaskRef.current = renderTask;
        await renderTask.promise;
      })
      .then(() => {
        if (cancelled || !renderToken) {
          return;
        }

        setRenderFailure(null);
        setCompletedRenderToken(renderToken);
      })
      .catch((error) => {
        if (cancelled || isRenderCancelledError(error) || !renderToken) {
          return;
        }

        setRenderFailure({
          message: getErrorMessage(error, `Could not render page ${pageNumber}.`),
          token: renderToken,
        });
      });

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [canvas, crop, fitWidth, pageNumber, pdfDocument, renderToken, renderZoom, viewerHeight, viewerWidth]);

  const showInitialLoader = rendering && completedRenderToken === null;

  return (
    <div className="flex flex-col items-center">
      <div className="relative overflow-hidden" ref={setContainer} style={{
        height: scaledPageSize.height * (1 - crop * 2),
        width: scaledPageSize.width * (1 - crop * 2),
      }}>
        {shouldRender ? (
          <canvas
            data-rendered={completedRenderToken === renderToken && !!renderToken}
            aria-label={`Book page ${pageNumber}`}
            role="img"
            className="block bg-white"
            ref={setCanvas}
            style={{
              height: `${scaledPageSize.height}px`,
              width: `${scaledPageSize.width}px`,
              marginTop: -scaledPageSize.height * crop,
              marginLeft: -scaledPageSize.width * crop,
            }}
          />
        ) : (
          <div
            aria-hidden="true"
            className="bg-white/76"
            style={{
              height: `${scaledPageSize.height}px`,
              width: `${scaledPageSize.width}px`,
              marginTop: -scaledPageSize.height * crop,
              marginLeft: -scaledPageSize.width * crop,
            }}
          />
        )}

        {showInitialLoader ? (
          <div className="reader-page-loading absolute inset-0 flex items-center justify-center bg-white/68 backdrop-blur-[1px]">
            <div className="flex items-center gap-3 rounded-full bg-white/94 px-4 py-2 text-sm text-stone-700 shadow-[0_12px_24px_-20px_rgba(58,38,18,0.45)]">
              <LoaderCircle className="size-4 animate-spin" />
              <span>Rendering page {pageNumber}...</span>
            </div>
          </div>
        ) : null}
      </div>

      {renderError ? (
        <div className="mt-2 w-full max-w-2xl rounded-[1rem] bg-rose-50/90 px-4 py-3 text-sm leading-6 text-rose-900">
          {renderError}
        </div>
      ) : null}
    </div>
  );
});

type ReadingMode = "page" | "spread" | "scroll";

const READING_MODES = [
  { value: "page", label: "Single page", Icon: File },
  { value: "spread", label: "Two pages", Icon: BookOpen },
  { value: "scroll", label: "Continuous scroll", Icon: ScrollText },
] as const;

export function NcertBookReader({ book, className, actions }: NcertBookReaderProps) {
  const [manifest, setManifest] = useState<NcertBookManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [manifestState, setManifestState] = useState<ReaderLoadState>(book ? "loading" : "idle");
  const [indexOpen, setIndexOpen] = useState(false);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfState, setPdfState] = useState<ReaderLoadState>(book ? "loading" : "idle");
  const [zoom, setZoom] = useState(1);
  const [pageSpacing, setPageSpacing] = useState(0);
  const [pageCrop, setPageCrop] = useState(0);
  const [spacingOpen, setSpacingOpen] = useState(false);
  const [fitWidth, setFitWidth] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [darkPaper, setDarkPaper] = useState(true);
  const [pageTurn, setPageTurn] = useState<PageTurn | null>(null);
  const turnBusy = useRef(false);
  const turnAbort = useRef<AbortController | null>(null);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [mode, setMode] = useState<ReadingMode>("page");
  const [currentPage, setCurrentPage] = useState(1);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const renderZoom = useDeferredValue(zoom);
  const [viewerRef, viewerElement, viewerWidth, viewerHeight] = useElementMetrics<HTMLDivElement>();
  const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollFrameRef = useRef<number | null>(null);
  const pendingScrollPage = useRef<number | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const contentsButton = useRef<HTMLButtonElement | null>(null);
  const bookId = book?.id ?? null;
  const turnLayoutKey = `${mode}:${zoom}:${pageSpacing}:${pageCrop}:${fitWidth}:${viewerWidth}:${viewerHeight}:${indexOpen}:${focusMode}:${darkMode}:${darkPaper}`;
  const activeTurn = pageTurn?.layoutKey === turnLayoutKey ? pageTurn : null;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const preference = localStorage.getItem("ncert-reader-theme");
        setDarkMode(preference === "dark" || (!preference && window.matchMedia("(prefers-color-scheme: dark)").matches));
        setDarkPaper(localStorage.getItem("ncert-reader-dark-paper") !== "false");
      } catch { /* Theme controls also work without browser storage. */ }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
    try { localStorage.setItem("ncert-reader-theme", darkMode ? "light" : "dark"); } catch { /* Optional persistence. */ }
  };

  useEffect(() => () => {
    turnAbort.current?.abort();
    turnBusy.current = false;
  }, [turnLayoutKey]);

  const finishTurn = useCallback(() => {
    setPageTurn(null);
    turnBusy.current = false;
  }, []);

  useEffect(() => {
    if (!bookId) {
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();

    void fetch(`/api/books/${bookId}/manifest`, {
      cache: "no-store",
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Could not load this book.");
        }

        return (await response.json()) as NcertBookManifest;
      })
      .then((nextManifest) => {
        if (cancelled) {
          return;
        }

        setManifest(nextManifest);
        setManifestState("ready");
      })
      .catch((error) => {
        if (cancelled || abortController.signal.aborted) {
          return;
        }

        setManifestError(getErrorMessage(error, "Could not load this book."));
        setManifestState("error");
      });

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [bookId]);

  useEffect(() => {
    return () => {
      if (pdfDocumentRef.current) {
        void pdfDocumentRef.current.destroy();
      }
    };
  }, []);


  const sections = useMemo(() => manifest?.sections ?? [], [manifest]);
  const readerPdfUrl = bookId ? `/api/books/${bookId}/download?inline=1` : "";
  const pageCount = pdfDocument?.numPages ?? 0;
  // A cover stands alone; subsequent even/odd pages form a facing spread.
  const spreadStart = currentPage === 1 ? 1 : currentPage - (currentPage % 2);
  const firstPage = mode === "spread" ? spreadStart : currentPage;
  const lastPage = mode === "spread" && firstPage > 1 ? Math.min(pageCount, firstPage + 1) : firstPage;
  const activeSection = [...sections].reverse().find((section) => section.startPage <= currentPage);
  const pageNumbers = useMemo(() => mode === "scroll"
    ? Array.from({ length: pageCount }, (_, index) => index + 1)
    : Array.from({ length: Math.max(0, lastPage - firstPage + 1) }, (_, index) => firstPage + index),
  [mode, pageCount, firstPage, lastPage]);
  useEffect(() => {
    if (!bookId) {
      return;
    }

    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;

    if (pdfDocumentRef.current) {
      void pdfDocumentRef.current.destroy();
      pdfDocumentRef.current = null;
    }

    pageRefs.current.clear();

    void loadPdfJs()
      .then(({ getDocument }) => {
        if (cancelled) {
          return null;
        }

        loadingTask = getDocument({
          url: readerPdfUrl,
          withCredentials: false,
        });

        return loadingTask.promise;
      })
      .then((nextDocument) => {
        if (!nextDocument) {
          return;
        }

        if (cancelled) {
          void nextDocument.destroy();
          return;
        }

        try {
          const saved = JSON.parse(localStorage.getItem(`ncert-reader:${bookId}`) ?? "null");
          if (saved && typeof saved === "object") {
            const page = Number.isInteger(saved.page) ? Math.max(1, Math.min(nextDocument.numPages, saved.page)) : 1;
            setCurrentPage(page);
            if (["page", "spread", "scroll"].includes(saved.mode)) {
              setMode(saved.mode);
              if (saved.mode === "scroll") pendingScrollPage.current = page;
            }
            if (typeof saved.spacing === "number") setPageSpacing(Math.min(48, Math.max(0, saved.spacing)));
            if (typeof saved.crop === "number") setPageCrop(Math.min(.1, Math.max(0, saved.crop)));
            setFitWidth(saved.fitWidth === true);
            if (Array.isArray(saved.bookmarks)) setBookmarks(saved.bookmarks.filter((value: unknown) =>
              typeof value === "number" && Number.isInteger(value) && value > 0 && value <= nextDocument.numPages));
          }
        } catch { /* Reading remains available when browser storage is disabled. */ }
        pdfDocumentRef.current = nextDocument;
        setPdfDocument(nextDocument);
        setPdfState("ready");
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        if (pdfDocumentRef.current) {
          void pdfDocumentRef.current.destroy();
          pdfDocumentRef.current = null;
        }

        setPdfDocument(null);
        setPdfError(getErrorMessage(error, "Could not open this book."));
        setPdfState("error");
      });

    return () => {
      cancelled = true;
      void loadingTask?.destroy();
    };
  }, [bookId, readerPdfUrl]);


  useEffect(() => {
    if (!bookId || pdfState !== "ready") return;
    try {
      localStorage.setItem(`ncert-reader:${bookId}`, JSON.stringify({ page: currentPage, mode,
        spacing: pageSpacing, crop: pageCrop, fitWidth, bookmarks }));
    } catch { /* Storage may be unavailable in private browsing. */ }
  }, [bookId, pdfState, currentPage, mode, pageSpacing, pageCrop, fitWidth, bookmarks]);

  const goToPage = useCallback((page: number) => {
    if (!pageCount) return;
    turnAbort.current?.abort();
    turnBusy.current = false;
    setPageTurn(null);
    const next = Math.min(pageCount, Math.max(1, Math.round(page)));
    setDirection(next < currentPage ? "backward" : "forward");
    setCurrentPage(next);
    if (mode === "scroll") {
      const element = pageRefs.current.get(next);
      if (element && viewerElement) viewerElement.scrollTo({ top: element.offsetTop - pageSpacing });
    } else {
      viewerElement?.scrollTo({ top: 0, left: 0 });
    }
  }, [currentPage, mode, pageCount, pageSpacing, viewerElement]);

  const turnPage = useCallback(async (delta: number) => {
    if (turnBusy.current || !pageCount) return;
    const next = delta > 0 ? lastPage + 1 : firstPage - 1;
    if (next < 1 || next > pageCount) return;
    const targetFirst = next === 1 ? 1 : next - (next % 2);
    const left = pageRefs.current.get(firstPage);
    const right = pageRefs.current.get(lastPage);
    if (mode !== "spread" || firstPage === lastPage || targetFirst === 1 || targetFirst + 1 > pageCount ||
        !pdfDocument || !viewerElement || !left || !right || zoom > 1 || fitWidth ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      goToPage(next);
      return;
    }
    turnBusy.current = true;
    turnAbort.current?.abort();
    const controller = new AbortController();
    turnAbort.current = controller;
    try {
      const turn = await preparePageTurn({ elements: [left, right], destination: [targetFirst, targetFirst + 1],
        pdf: pdfDocument, crop: pageCrop, signal: controller.signal, viewport: viewerElement,
        direction: delta > 0 ? "forward" : "backward", layoutKey: turnLayoutKey });
      if (controller.signal.aborted) return;
      if (!turn) { goToPage(next); return; }
      setPageTurn(turn);
      setDirection(turn.direction);
      setCurrentPage(next);
    } catch {
      if (!controller.signal.aborted) goToPage(next);
    } finally {
      if (controller.signal.aborted && turnAbort.current === controller) turnBusy.current = false;
    }
  }, [firstPage, lastPage, goToPage, mode, pageCount, pdfDocument, viewerElement, zoom, fitWidth, pageCrop, turnLayoutKey]);

  const changeMode = (nextMode: ReadingMode) => {
    if (nextMode === "scroll") pendingScrollPage.current = currentPage;
    setMode(nextMode);
    setZoom(1);
    setFitWidth(false);
    viewerElement?.scrollTo({ top: 0, left: 0 });
  };

  useEffect(() => {
    if (!viewerElement || mode !== "scroll" || pdfState !== "ready" || manifestState !== "ready" || pendingScrollPage.current === null) return;
    const page = pendingScrollPage.current;
    pendingScrollPage.current = null;
    const frame = requestAnimationFrame(() => {
      const node = pageRefs.current.get(page);
      if (node) viewerElement.scrollTo({ top: node.offsetTop - pageSpacing });
    });
    return () => cancelAnimationFrame(frame);
  }, [mode, pageSpacing, pdfState, manifestState, viewerElement]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.altKey || event.ctrlKey || event.metaKey ||
          target.closest("input, textarea, select, [contenteditable=true]")) return;
      if (event.key === "Escape" && spacingOpen) {
        event.preventDefault(); event.stopPropagation(); setSpacingOpen(false);
        return;
      }
      if (event.key === "Escape" && focusMode) {
        event.preventDefault(); event.stopPropagation(); setFocusMode(false);
        requestAnimationFrame(() => contentsButton.current?.focus()); return;
      }
      if (event.key.toLowerCase() === "f") {
        event.preventDefault(); setFocusMode((active) => !active); setIndexOpen(false); setSpacingOpen(false); return;
      }
      if (event.key === "Escape" && indexOpen) {
        event.preventDefault();
        event.stopPropagation();
        setIndexOpen(false);
        contentsButton.current?.focus();
        return;
      }
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault(); turnPage(1);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault(); turnPage(-1);
      } else if (event.key === "Home") {
        event.preventDefault(); goToPage(1);
      } else if (event.key === "End") {
        event.preventDefault(); goToPage(pageCount);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [goToPage, indexOpen, spacingOpen, focusMode, pageCount, turnPage]);

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
  }, []);

  const handleViewerScroll = () => {
    if (mode !== "scroll" || !viewerElement || scrollFrameRef.current !== null) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const anchor = viewerElement.scrollTop + viewerElement.clientHeight * 0.4;
      let visiblePage = 1;
      for (const [number, node] of pageRefs.current) {
        if (node.offsetTop <= anchor) visiblePage = number;
        else break;
      }
      setCurrentPage(visiblePage);
    });
  };

  const ready = pdfState === "ready" && manifestState === "ready";
  const progress = pageCount > 1 ? ((currentPage - 1) / (pageCount - 1)) * 100 : 0;
  const pageAreaWidth = Math.max(0, viewerWidth - pageSpacing * 2);
  const canvasWidth = mode === "spread" ? (pageAreaWidth - 2) / 2 : pageAreaWidth;

  const visiblePageLabel = lastPage > firstPage ? `${firstPage}–${lastPage}` : `${firstPage}`;

  if (!book) return null;

  return (
    <div className={cn("book-reader", focusMode && "reader-focus-mode", className)} data-theme={darkMode ? "dark" : "light"} data-dark-paper={darkMode && darkPaper} data-turning={!!activeTurn} style={{ "--page-spacing": `${pageSpacing}px` } as CSSProperties}>
      <header className="reader-toolbar">
        <div className="reader-identity">
          <button ref={contentsButton} type="button" className="reader-icon-button" aria-label="Contents"
            title="Contents" aria-expanded={indexOpen} aria-controls="reader-contents"
            data-active={indexOpen} onClick={() => setIndexOpen((open) => !open)}>
            <PanelLeft size={18} />
          </button>
          <span className="reader-toolbar-divider" />
          <div className="reader-book-title" title={`${book.title} · ${book.classLabel}`}>
            <strong>{book.title}</strong><span>{book.classLabel}</span>
          </div>
        </div>
        <div className="reader-modes" role="group" aria-label="Reading layout">
          {READING_MODES.map(({ value, label, Icon }) => (
            <button key={value} type="button" aria-label={label} title={label}
              aria-pressed={mode === value} onClick={() => changeMode(value)}>
              <Icon size={16} /><span>{value === "page" ? "Page" : value === "spread" ? "Spread" : "Scroll"}</span>
            </button>
          ))}
        </div>
        <div className="reader-tools">
          <div className="reader-zoom" role="group" aria-label="Page zoom">
            <button type="button" className="reader-icon-button" aria-label="Zoom out" title="Zoom out"
              disabled={zoom <= MIN_ZOOM || !ready} onClick={() => setZoom(clampZoom(zoom - ZOOM_STEP))}><Minus size={16} /></button>
            <button type="button" className="reader-fit" aria-label="Fit page" title="Fit entire page" disabled={!ready}
              onClick={() => { setZoom(1); setFitWidth(false); viewerElement?.scrollTo({ top: 0, left: 0 }); }}>
              {zoom === 1 ? (fitWidth ? "Width" : "Fit") : `${Math.round(zoom * 100)}%`}
            </button>
            <button type="button" className="reader-icon-button" aria-label="Zoom in" title="Zoom in"
              disabled={zoom >= MAX_ZOOM || !ready} onClick={() => setZoom(clampZoom(zoom + ZOOM_STEP))}><Plus size={16} /></button>
          </div>
          <div className="reader-spacing-control">
            <button type="button" className="reader-icon-button" aria-label="Page margins" title="Page margins"
              aria-expanded={spacingOpen} aria-controls="reader-spacing-panel" data-active={spacingOpen}
              onClick={() => setSpacingOpen((open) => !open)}><SlidersHorizontal size={17} /></button>
            {spacingOpen && <div className="reader-spacing-panel" id="reader-spacing-panel" role="region" aria-label="Page margins">
              <div className="reader-spacing-heading"><strong>Page margins</strong><button type="button" className="reader-icon-button" aria-label="Close page margins" onClick={() => setSpacingOpen(false)}><X size={15} /></button></div>
              <div className="reader-fit-options" role="group" aria-label="Page fitting">
                <button type="button" aria-pressed={!fitWidth} onClick={() => { setFitWidth(false); setZoom(1); }}>Fit page</button>
                <button type="button" aria-pressed={fitWidth} onClick={() => { setFitWidth(true); setZoom(1); }}>Fit width</button>
              </div>
              <label htmlFor="reader-spacing">Space around page <output>{pageSpacing}px</output></label>
              <input id="reader-spacing" type="range" min="0" max="48" step="4" value={pageSpacing} onChange={(event) => setPageSpacing(Number(event.target.value))} />
              <label htmlFor="reader-crop">Trim printed margins <output>{Math.round(pageCrop * 100)}%</output></label>
              <input id="reader-crop" type="range" min="0" max="10" step="1" value={Math.round(pageCrop * 100)} onChange={(event) => setPageCrop(Number(event.target.value) / 100)} />
              <p>Trimming enlarges the print and hides the page edges.</p>
              {darkMode && <label className="reader-dark-paper-option"><input type="checkbox" checked={darkPaper}
                onChange={(event) => {
                  setDarkPaper(event.target.checked);
                  try { localStorage.setItem("ncert-reader-dark-paper", String(event.target.checked)); } catch { /* Optional persistence. */ }
                }} />Dark PDF pages</label>}
              <button type="button" className="reader-spacing-reset" onClick={() => { setPageSpacing(0); setPageCrop(0); setZoom(1); setFitWidth(false); }}>Reset margins</button>
            </div>}
          </div>
          <button type="button" className="reader-icon-button reader-theme-button" aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            title={darkMode ? "Light mode" : "Dark mode"} aria-pressed={darkMode} onClick={toggleTheme}>
            {darkMode ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button type="button" className="reader-icon-button reader-focus-button" aria-label="Focus mode" title="Focus mode (F)"
            onClick={() => { setFocusMode(true); setIndexOpen(false); setSpacingOpen(false); }}><Maximize2 size={17} /></button>
          <span className="reader-toolbar-divider reader-action-divider" />
          {actions}
        </div>
      </header>

      <div className="reader-body">
        {indexOpen && <>
          <button className="reader-drawer-scrim" aria-label="Dismiss contents" onClick={() => setIndexOpen(false)} />
          <aside className="reader-contents" id="reader-contents" aria-label="Table of contents">
            <div className="reader-contents-heading"><span>Contents</span>
              <button type="button" className="reader-icon-button" aria-label="Close contents" onClick={() => {
                setIndexOpen(false); contentsButton.current?.focus();
              }}><X size={16} /></button>
            </div>
            <nav aria-label="Chapters" className="reader-chapters">
              {bookmarks.length > 0 && <div className="reader-bookmarks">
                <p>BOOKMARKS</p><div>{[...bookmarks].sort((a, b) => a - b).map((page) =>
                  <button key={page} type="button" aria-label={`Go to bookmark, page ${page}`} onClick={() => {
                    goToPage(page);
                    if (window.matchMedia("(max-width: 767px)").matches) setIndexOpen(false);
                  }}><Bookmark size={11} />{page}</button>)}</div>
              </div>}
              {sections.map((section) => (
                <button type="button" key={section.id} disabled={!ready}
                  aria-label={`${section.label}, page ${section.startPage}`}
                  aria-current={section.id === activeSection?.id ? "location" : undefined}
                  onClick={() => {
                    goToPage(section.startPage);
                    if (window.matchMedia("(max-width: 767px)").matches) {
                      setIndexOpen(false); contentsButton.current?.focus();
                    }
                  }}>
                  <span>{section.label}</span><span>{section.startPage}</span>
                </button>
              ))}
            </nav>
            <div className="reader-contents-footer">NCERT EDITION<span>{pageCount ? `${pageCount} pages` : "Opening book…"}</span></div>
          </aside>
        </>}

        <main className="reader-workspace" aria-label="Book pages">
          <div className="reader-viewport" ref={viewerRef} onScroll={handleViewerScroll}
            onTouchStart={(event) => { const touch = event.touches[0]; touchStart.current = { x: touch.clientX, y: touch.clientY }; }}
            onTouchEnd={(event) => {
              const start = touchStart.current; touchStart.current = null;
              if (!start || zoom > 1 || mode === "scroll") return;
              const touch = event.changedTouches[0];
              const dx = touch.clientX - start.x; const dy = touch.clientY - start.y;
              if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) turnPage(dx < 0 ? 1 : -1);
            }}>
            {manifestState === "error" || pdfState === "error" ? (
              <ReaderMessageState title="Couldn’t open this book" description={manifestError ?? pdfError ?? "Please close the reader and try again."} />
            ) : !ready ? (
              <div className="reader-loading" role="status"><BookOpen size={30} strokeWidth={1.25} /><span>Opening your book</span><LoaderCircle size={16} className="animate-spin" /></div>
            ) : pdfDocument ? (
              <div className={cn("reader-pages", mode === "scroll" ? "reader-pages-scroll" : "reader-pages-paged",
                mode === "spread" && firstPage > 1 && "reader-pages-spread")}
                data-direction={direction} key={mode === "scroll" ? "scroll" : `${mode}-${firstPage}`}>
                {pageNumbers.map((pageNumber) => (
                  <div className="reader-paper" key={pageNumber} ref={(node) => {
                    if (node) pageRefs.current.set(pageNumber, node);
                    else pageRefs.current.delete(pageNumber);
                  }}>
                    <PdfPageCanvas fitWidth={fitWidth} crop={pageCrop} displayZoom={zoom} pageNumber={pageNumber} pdfDocument={pdfDocument}
                      renderZoom={renderZoom} scrollRoot={viewerElement} viewerHeight={Math.max(1, viewerHeight - pageSpacing * 2)} viewerWidth={canvasWidth} />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          {activeTurn && <ReaderPageTurn turn={activeTurn} viewport={viewerElement} darkPaper={darkMode && darkPaper} onFinish={finishTurn} />}
        </main>
      </div>

      <footer className="reader-footer">
        <div className="reader-rail-title" title={`${book.title} · ${book.classLabel}`}><strong>{book.title}</strong><span>{book.classLabel}</span></div>
        <div className="reader-location"><span>{activeSection?.label ?? "Opening book…"}</span><span className="reader-key-hint" title="Use left and right arrow keys to turn pages">← →</span></div>
        <button type="button" className="reader-icon-button reader-bookmark-button" disabled={!ready}
          aria-label={bookmarks.includes(firstPage) ? "Remove bookmark" : "Bookmark page"}
          title={bookmarks.includes(firstPage) ? "Remove bookmark" : "Bookmark this page"}
          aria-pressed={bookmarks.includes(firstPage)} onClick={() => setBookmarks((pages) =>
            pages.includes(firstPage) ? pages.filter((page) => page !== firstPage) : [...pages, firstPage])}>
          <Bookmark size={17} fill={bookmarks.includes(firstPage) ? "currentColor" : "none"} />
        </button>
        <div className="reader-pagination">
          <button type="button" className="reader-icon-button" aria-label="Go to previous page" disabled={!ready || !!activeTurn || firstPage <= 1} onClick={() => turnPage(-1)}><ChevronLeft size={16} /></button>
          <div className="reader-page-position" aria-label={`Pages ${visiblePageLabel} of ${pageCount || "unknown"}`}>
            <strong>{visiblePageLabel}</strong><span>of {pageCount || "—"}</span>
          </div>
          <form onSubmit={(event) => {
            event.preventDefault();
            const value = Number(new FormData(event.currentTarget).get("page"));
            if (Number.isFinite(value)) goToPage(value);
          }}>
            <label htmlFor="reader-page-number">Go to</label>
            <input id="reader-page-number" name="page" aria-label="Page number" type="number" min={1} max={pageCount || 1}
              key={firstPage} defaultValue={firstPage} disabled={!ready} />
          </form>
          <button type="button" className="reader-icon-button" aria-label="Go to next page" disabled={!ready || !!activeTurn || lastPage >= pageCount} onClick={() => turnPage(1)}><ChevronRight size={16} /></button>
        </div>
        <div className="reader-progress"><input type="range" aria-label="Reading progress" min={1} max={pageCount || 1}
          value={currentPage} disabled={!ready} onChange={(event) => goToPage(Number(event.target.value))} />
          <span>{Math.round(progress)}%</span></div>
        <span className="sr-only" role="status" aria-live="polite">{ready ? `Page ${firstPage}${lastPage > firstPage ? ` to ${lastPage}` : ""} of ${pageCount}` : "Loading book"}</span>
      </footer>
      {focusMode && <div className="reader-focus-controls">
        <button type="button" className="reader-icon-button" aria-label="Exit focus mode" title="Exit focus mode (Esc)" onClick={() => setFocusMode(false)}><Minimize2 size={16} /></button>
        <button type="button" className="reader-icon-button" aria-label="Previous page in focus mode" disabled={!!activeTurn || firstPage <= 1} onClick={() => turnPage(-1)}><ChevronLeft size={16} /></button>
        <span>{visiblePageLabel} of {pageCount}</span>
        <button type="button" className="reader-icon-button" aria-label="Next page in focus mode" disabled={!!activeTurn || lastPage >= pageCount} onClick={() => turnPage(1)}><ChevronRight size={16} /></button>
      </div>}
    </div>
  );
}
