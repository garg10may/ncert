"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
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

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  NcertBookManifest,
  NcertCatalogBook,
  NcertManifestSection,
} from "@/lib/ncert/types";

type NcertBookReaderProps = {
  book: NcertCatalogBook | null;
  className?: string;
};

type ReaderLoadState = "idle" | "loading" | "ready" | "error";

const CONTROL_PILL_CLASSNAME =
  "inline-flex items-center rounded-full bg-white/76 px-3 py-1 text-[0.7rem] font-semibold tracking-[0.18em] text-stone-600 uppercase shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]";
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
) {
  const availableWidth = Math.max(220, viewerWidth - 12);
  const availableHeight = Math.max(320, viewerHeight - 12);
  return Math.min(availableWidth / pageWidth, availableHeight / pageHeight);
}

function getScaledPageSize(
  pageWidth: number,
  pageHeight: number,
  viewerWidth: number,
  viewerHeight: number,
  zoom: number,
) {
  const scale = getFitScale(pageWidth, pageHeight, viewerWidth, viewerHeight) * zoom;

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

function ReaderLoadingState({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-full min-h-[760px] flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.35rem] bg-white/58 px-4 py-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20 rounded-full bg-stone-200/90" />
          <Skeleton className="h-6 w-52 rounded-full bg-stone-200/90" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-full bg-stone-200/90" />
          <Skeleton className="h-9 w-24 rounded-full bg-stone-200/90" />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="rounded-[1.35rem] bg-white/52 p-3">
          <Skeleton className="h-full min-h-[160px] rounded-[1rem] bg-stone-200/90" />
        </div>
        <div className="rounded-[1.35rem] bg-white/52 p-3">
          <Skeleton className="h-full min-h-[520px] rounded-[1rem] bg-stone-200/90" />
        </div>
      </div>
    </div>
  );
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
        "flex min-h-[760px] items-center justify-center rounded-[1.5rem] bg-white/52 p-6 text-center",
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
  displayZoom: number;
  pageNumber: number;
  pdfDocument: PDFDocumentProxy;
  renderZoom: number;
  scrollRoot: HTMLDivElement | null;
  viewerHeight: number;
  viewerWidth: number;
};

const PdfPageCanvas = memo(function PdfPageCanvas({
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
    shouldRender && isNearViewport && viewerWidth >= 180 && viewerHeight >= 220
      ? `${pageNumber}:${renderZoom}:${Math.round(viewerWidth)}:${Math.round(viewerHeight)}`
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
            getFitScale(baseViewport.width, baseViewport.height, viewerWidth, viewerHeight) *
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
  }, [canvas, pageNumber, pdfDocument, renderToken, renderZoom, viewerHeight, viewerWidth]);

  const showInitialLoader = rendering && completedRenderToken === null;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" ref={setContainer}>
        {shouldRender ? (
          <canvas
            className="block bg-white"
            ref={setCanvas}
            style={{
              height: `${scaledPageSize.height}px`,
              width: `${scaledPageSize.width}px`,
            }}
          />
        ) : (
          <div
            aria-hidden="true"
            className="bg-white/76"
            style={{
              height: `${scaledPageSize.height}px`,
              width: `${scaledPageSize.width}px`,
            }}
          />
        )}

        {showInitialLoader ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/68 backdrop-blur-[1px]">
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

export function NcertBookReader({ book, className }: NcertBookReaderProps) {
  const [manifest, setManifest] = useState<NcertBookManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [manifestState, setManifestState] = useState<ReaderLoadState>(book ? "loading" : "idle");
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [indexOpen, setIndexOpen] = useState(true);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfState, setPdfState] = useState<ReaderLoadState>(book ? "loading" : "idle");
  const [zoom, setZoom] = useState(1);
  const renderZoom = useDeferredValue(zoom);
  const [viewerRef, viewerElement, viewerWidth, viewerHeight] = useElementMetrics<HTMLDivElement>();
  const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollFrameRef = useRef<number | null>(null);
  const bookId = book?.id ?? null;

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
        setActiveSectionId(nextManifest.sections[0]?.id ?? null);
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
  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0] ?? null;
  const readerPdfUrl = bookId ? `/api/books/${bookId}/download?inline=1` : "";
  const pageCount = pdfDocument?.numPages ?? 0;
  const pdfPageNumbers = useMemo(() => {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }, [pageCount]);

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
    if (!viewerElement) {
      return;
    }

    viewerElement.scrollTo({ top: 0 });
  }, [bookId, viewerElement]);

  const syncActiveSectionFromScroll = useCallback(() => {
    if (!viewerElement || sections.length === 0) {
      return;
    }

    const scrollAnchor = viewerElement.scrollTop + Math.max(96, viewerElement.clientHeight * 0.33);
    let nextSectionId = sections[0]?.id ?? null;

    for (const section of sections) {
      const sectionStartPage = pageRefs.current.get(section.startPage);
      if (!sectionStartPage) {
        continue;
      }

      if (sectionStartPage.offsetTop <= scrollAnchor) {
        nextSectionId = section.id;
        continue;
      }

      break;
    }

    if (nextSectionId && nextSectionId !== activeSectionId) {
      setActiveSectionId(nextSectionId);
    }
  }, [activeSectionId, sections, viewerElement]);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (pdfState !== "ready" || !viewerElement || sections.length === 0) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      syncActiveSectionFromScroll();
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [pdfState, sections.length, syncActiveSectionFromScroll, viewerElement]);

  const handleViewerScroll = useCallback(() => {
    if (scrollFrameRef.current !== null) {
      return;
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      syncActiveSectionFromScroll();
    });
  }, [syncActiveSectionFromScroll]);

  const jumpToSection = useCallback(
    (section: NcertManifestSection) => {
      setActiveSectionId(section.id);

      const sectionStartPage = pageRefs.current.get(section.startPage);
      if (!viewerElement || !sectionStartPage) {
        return;
      }

      viewerElement.scrollTo({
        behavior: "smooth",
        top: Math.max(0, sectionStartPage.offsetTop - 12),
      });
    },
    [viewerElement],
  );

  const zoomLabel = `${Math.round(zoom * 100)}%`;
  const canZoomOut = zoom > MIN_ZOOM;
  const canZoomIn = zoom < MAX_ZOOM;
  const pdfFlowLoading = pdfState === "loading";
  const zoomRefreshing = renderZoom !== zoom;

  if (!book) {
    return (
      <div
        className={cn(
          "rounded-[1.5rem] bg-white/52 p-6 text-sm leading-6 text-stone-600",
          className,
        )}
      >
        Pick a book to start reading.
      </div>
    );
  }

  if (manifestState === "loading" || manifestState === "idle") {
    return <ReaderLoadingState className={className} />;
  }

  if (manifestState === "error") {
    return (
      <ReaderMessageState
        className={className}
        description={manifestError ?? "Could not load this book."}
        title="Reader unavailable"
      />
    );
  }

  if (sections.length === 0) {
    return (
      <ReaderMessageState
        className={className}
        description="This book did not include any readable sections."
        title="No sections found"
      />
    );
  }

  return (
    <div className={cn("flex h-full min-h-[760px] flex-col gap-3", className)}>
      <div
        className={cn(
          "grid min-h-0 flex-1 gap-3",
          indexOpen ? "grid-cols-1 lg:grid-cols-[14.5rem_minmax(0,1fr)]" : "grid-cols-1",
        )}
      >
        {indexOpen ? (
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-[1.35rem] bg-white/42">
            <div className="overflow-x-auto p-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overflow-x-hidden">
              <div className="flex gap-2 lg:flex-col">
                {sections.map((section) => {
                  const isActive = section.id === activeSection?.id;

                  return (
                    <button
                      aria-pressed={isActive}
                      className={cn(
                        "group flex min-w-[12rem] items-center gap-3 rounded-[1rem] px-3.5 py-3 text-left transition-all duration-200 lg:min-w-0",
                        isActive
                          ? "bg-[linear-gradient(180deg,rgba(255,251,240,0.98),rgba(252,241,214,0.92))] shadow-[0_16px_28px_-24px_rgba(126,82,26,0.65)]"
                          : "bg-white/62 hover:bg-white/84",
                      )}
                      key={section.id}
                      onClick={() => jumpToSection(section)}
                      type="button"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 block text-sm leading-5 font-medium text-stone-900">
                          {section.label}
                        </span>
                        <span className="mt-1 block text-[0.68rem] uppercase tracking-[0.18em] text-stone-500">
                          Page {section.startPage}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        ) : null}

        <section className="flex min-h-0 flex-col overflow-hidden rounded-[1.45rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(247,240,229,0.9))]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-2 py-2.5 sm:px-3">
            <div className="flex items-center gap-2">
              <Button
                aria-expanded={indexOpen}
                aria-label={indexOpen ? "Hide index" : "Show index"}
                className="rounded-full border-transparent bg-white/72 text-stone-700 hover:bg-white"
                onClick={() => setIndexOpen((currentState) => !currentState)}
                size="sm"
                title={indexOpen ? "Hide index" : "Show index"}
                variant="outline"
              >
                <PanelLeft className="size-4" />
                <span className="hidden sm:inline">Index</span>
              </Button>

              {activeSection ? <span className={CONTROL_PILL_CLASSNAME}>{activeSection.label}</span> : null}
            </div>

            <div className="flex items-center gap-2">
              <span className={CONTROL_PILL_CLASSNAME}>{zoomLabel}</span>
              {zoomRefreshing ? (
                <span className="hidden rounded-full bg-white/68 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-stone-500 sm:inline-flex">
                  Sharpening
                </span>
              ) : null}

              <Button
                className="rounded-full border-transparent bg-white/76 text-stone-700 hover:bg-white"
                disabled={!canZoomOut || pdfFlowLoading}
                onClick={() => setZoom((currentZoom) => clampZoom(currentZoom - ZOOM_STEP))}
                size="icon-sm"
                variant="outline"
              >
                <Minus className="size-4" />
                <span className="sr-only">Zoom out</span>
              </Button>

              <Button
                className="rounded-full border-transparent bg-white/76 text-stone-700 hover:bg-white"
                disabled={!canZoomIn || pdfFlowLoading}
                onClick={() => setZoom((currentZoom) => clampZoom(currentZoom + ZOOM_STEP))}
                size="icon-sm"
                variant="outline"
              >
                <Plus className="size-4" />
                <span className="sr-only">Zoom in</span>
              </Button>
            </div>
          </div>

          <div
            className="min-h-0 flex-1 overflow-auto px-1 pb-2 pt-1 sm:px-2 sm:pb-3"
            onScroll={handleViewerScroll}
            ref={viewerRef}
          >
            {pdfFlowLoading ? (
              <div className="flex min-h-[18rem] w-full items-center justify-center">
                <div className="flex items-center gap-3 rounded-full bg-white/92 px-4 py-2 text-sm text-stone-700 shadow-[0_12px_24px_-20px_rgba(58,38,18,0.45)]">
                  <LoaderCircle className="size-4 animate-spin" />
                  <span>Loading the full book...</span>
                </div>
              </div>
            ) : null}

            {pdfDocument ? (
              <div className="mx-auto flex w-full flex-col items-center gap-1 sm:gap-2">
                {pdfPageNumbers.map((pdfPageNumber) => (
                  <div
                    className="w-full"
                    key={`${book.id}-${pdfPageNumber}`}
                    ref={(node) => {
                      if (node) {
                        pageRefs.current.set(pdfPageNumber, node);
                        return;
                      }

                      pageRefs.current.delete(pdfPageNumber);
                    }}
                  >
                    <PdfPageCanvas
                      displayZoom={zoom}
                      pageNumber={pdfPageNumber}
                      pdfDocument={pdfDocument}
                      renderZoom={renderZoom}
                      scrollRoot={viewerElement}
                      viewerHeight={viewerHeight}
                      viewerWidth={viewerWidth}
                    />
                  </div>
                ))}
              </div>
            ) : null}

            {pdfState === "error" ? (
              <div className="mx-auto mt-4 max-w-2xl rounded-[1rem] bg-rose-50/90 px-4 py-3 text-sm leading-6 text-rose-900">
                {pdfError}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
