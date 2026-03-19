"use client";

import Image from "next/image";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  Minus,
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
type ReaderSectionFormat = "image" | "pdf";

const CONTROL_PILL_CLASSNAME =
  "inline-flex items-center rounded-full border border-stone-300/80 bg-white/78 px-3 py-1 text-[0.7rem] font-semibold tracking-[0.18em] text-stone-600 uppercase shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]";
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 2.05;
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

function getPreferredSectionId(manifest: NcertBookManifest): string | null {
  return manifest.sections.find((section) => section.kind === "content")?.id ?? manifest.sections[0]?.id ?? null;
}

function getSectionKindLabel(kind: NcertManifestSection["kind"]) {
  switch (kind) {
    case "cover":
      return "Cover";
    case "supplement":
      return "Extra";
    default:
      return "Section";
  }
}

function getSectionFormat(section: NcertManifestSection | null): ReaderSectionFormat {
  if (!section) {
    return "pdf";
  }

  const normalizedPath = section.href.split("#")[0]?.split("?")[0]?.toLowerCase() ?? "";

  if (normalizedPath.endsWith(".png") || normalizedPath.endsWith(".jpg") || normalizedPath.endsWith(".jpeg")) {
    return "image";
  }

  return "pdf";
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));
}

function useElementWidth<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  const elementRef = useCallback((node: T | null) => {
    setElement(node);
    if (!node) {
      setWidth(0);
    }
  }, []);

  useEffect(() => {
    if (!element) {
      return;
    }

    const updateWidth = () => {
      setWidth(element.clientWidth);
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);

      return () => {
        window.removeEventListener("resize", updateWidth);
      };
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setWidth(entry.contentRect.width);
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [element]);

  return [elementRef, width] as const;
}

function ReaderLoadingState({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-full min-h-[620px] flex-col gap-4 rounded-[1.75rem] border border-stone-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(245,238,227,0.94))] p-4 shadow-[0_18px_50px_-28px_rgba(58,38,18,0.38)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.3rem] border border-stone-300/70 bg-white/78 px-4 py-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20 rounded-full bg-stone-200/90" />
          <Skeleton className="h-6 w-52 rounded-full bg-stone-200/90" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-full bg-stone-200/90" />
          <Skeleton className="h-9 w-24 rounded-full bg-stone-200/90" />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <div className="rounded-[1.4rem] border border-stone-300/80 bg-white/72 p-3">
          <Skeleton className="h-full min-h-[160px] rounded-[1rem] bg-stone-200/90" />
        </div>
        <div className="rounded-[1.4rem] border border-stone-300/80 bg-white/72 p-3">
          <Skeleton className="h-full min-h-[420px] rounded-[1rem] bg-stone-200/90" />
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
        "flex min-h-[620px] items-center justify-center rounded-[1.75rem] border border-stone-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(245,238,227,0.94))] p-6 text-center shadow-[0_18px_50px_-28px_rgba(58,38,18,0.38)]",
        className,
      )}
    >
      <div className="max-w-md space-y-3">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-stone-300/80 bg-white/80 text-stone-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
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
  pageNumber: number;
  pdfDocument: PDFDocumentProxy;
  sectionId: string;
  viewerWidth: number;
  zoom: number;
};

function PdfPageCanvas({
  pageNumber,
  pdfDocument,
  sectionId,
  viewerWidth,
  zoom,
}: PdfPageCanvasProps) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [completedRenderToken, setCompletedRenderToken] = useState<string | null>(null);
  const [renderFailure, setRenderFailure] = useState<{
    message: string;
    token: string;
  } | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const renderToken =
    viewerWidth >= 180 ? `${sectionId}:${pageNumber}:${zoom}:${Math.round(viewerWidth)}` : null;
  const renderError =
    renderToken && renderFailure?.token === renderToken ? renderFailure.message : null;
  const rendering = Boolean(
    renderToken && completedRenderToken !== renderToken && !renderError,
  );

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
        const availableWidth = Math.max(220, viewerWidth - 48);
        const fitScale = availableWidth / baseViewport.width;
        const viewport = page.getViewport({ scale: fitScale * zoom });
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
        if (cancelled) {
          return;
        }

        setCompletedRenderToken(renderToken);
      })
      .catch((error) => {
        if (cancelled || isRenderCancelledError(error)) {
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
  }, [canvas, pageNumber, pdfDocument, renderToken, viewerWidth, zoom]);

  return (
    <div className="flex flex-col items-center gap-2">
      <span className={cn(CONTROL_PILL_CLASSNAME, "px-2.5 py-0.5 text-[0.62rem] tracking-[0.16em]")}>
        Page {pageNumber}
      </span>

      <div className="relative rounded-[1.4rem] border border-stone-300/80 bg-[#fcfbf7] p-3 shadow-[0_20px_44px_-30px_rgba(58,38,18,0.45)] sm:p-4">
        <canvas
          className="block max-w-full rounded-[1rem] shadow-[0_16px_36px_-24px_rgba(58,38,18,0.45)]"
          ref={setCanvas}
        />

        {rendering ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-[1.4rem] bg-[#fcfbf7]/84 backdrop-blur-[1px]">
            <div className="flex items-center gap-3 rounded-full border border-stone-300/80 bg-white/92 px-4 py-2 text-sm text-stone-700 shadow-[0_12px_24px_-20px_rgba(58,38,18,0.45)]">
              <LoaderCircle className="size-4 animate-spin" />
              <span>Rendering page {pageNumber}...</span>
            </div>
          </div>
        ) : null}
      </div>

      {renderError ? (
        <div className="w-full max-w-2xl rounded-[1.2rem] border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm leading-6 text-rose-900">
          {renderError}
        </div>
      ) : null}
    </div>
  );
}

export function NcertBookReader({ book, className }: NcertBookReaderProps) {
  const [manifest, setManifest] = useState<NcertBookManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [manifestState, setManifestState] = useState<ReaderLoadState>(book ? "loading" : "idle");
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfState, setPdfState] = useState<ReaderLoadState>("idle");
  const [zoom, setZoom] = useState(1);
  const [viewerRef, viewerWidth] = useElementWidth<HTMLDivElement>();
  const pdfDocumentRef = useRef<PDFDocumentProxy | null>(null);
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

        const preferredSectionId = getPreferredSectionId(nextManifest);
        const preferredSection =
          nextManifest.sections.find((section) => section.id === preferredSectionId) ?? null;

        setManifest(nextManifest);
        setManifestState("ready");
        if (!preferredSection) {
          return;
        }

        setActiveSectionId(preferredSection.id);
        setPdfDocument(null);
        setPdfError(null);
        setPdfState(getSectionFormat(preferredSection) === "pdf" ? "loading" : "ready");
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

  const sections = manifest?.sections ?? [];
  const activeSection =
    sections.find((section) => section.id === activeSectionId) ??
    sections.find((section) => section.kind === "content") ??
    sections[0] ??
    null;
  const resolvedActiveSectionId = activeSection?.id ?? null;
  const activeSectionIndex = activeSection ? sections.findIndex((section) => section.id === activeSection.id) : -1;
  const sectionFormat = getSectionFormat(activeSection);
  const sectionUrl = bookId && resolvedActiveSectionId ? `/api/books/${bookId}/section/${resolvedActiveSectionId}` : "";
  const pageCount = sectionFormat === "image" ? 1 : pdfDocument?.numPages ?? 0;
  const pdfPageNumbers = useMemo(() => {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }, [pageCount]);
  const currentSectionLabel = activeSection?.label ?? "Choose a section";
  const currentSectionKindLabel = activeSection ? getSectionKindLabel(activeSection.kind) : "Section";
  const progressLabel = useMemo(() => {
    if (!activeSection || activeSectionIndex < 0) {
      return null;
    }

    return `${activeSectionIndex + 1} of ${sections.length}`;
  }, [activeSection, activeSectionIndex, sections.length]);

  useEffect(() => {
    if (!bookId || !resolvedActiveSectionId || sectionFormat !== "pdf") {
      return;
    }

    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;

    void loadPdfJs()
      .then(({ getDocument }) => {
        if (cancelled) {
          return null;
        }

        loadingTask = getDocument({
          url: sectionUrl,
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

        if (pdfDocumentRef.current) {
          void pdfDocumentRef.current.destroy();
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
        setPdfError(getErrorMessage(error, "Could not open this section."));
        setPdfState("error");
      });

    return () => {
      cancelled = true;
      void loadingTask?.destroy();
    };
  }, [bookId, resolvedActiveSectionId, sectionFormat, sectionUrl]);

  const selectSection = (section: NcertManifestSection) => {
    if (pdfDocumentRef.current) {
      void pdfDocumentRef.current.destroy();
      pdfDocumentRef.current = null;
    }

    startTransition(() => {
      setActiveSectionId(section.id);
      setPdfDocument(null);
      setPdfError(null);
      setPdfState(getSectionFormat(section) === "pdf" ? "loading" : "ready");
    });
  };

  const goToRelativeSection = (direction: -1 | 1) => {
    if (activeSectionIndex < 0) {
      return;
    }

    const nextSection = sections[activeSectionIndex + direction];
    if (!nextSection) {
      return;
    }

    selectSection(nextSection);
  };

  const zoomLabel = `${Math.round(zoom * 100)}%`;
  const canZoomOut = sectionFormat === "pdf" && zoom > MIN_ZOOM;
  const canZoomIn = sectionFormat === "pdf" && zoom < MAX_ZOOM;
  const hasWarnings = Boolean(manifest?.warnings.length);
  const pdfFlowLoading = sectionFormat === "pdf" && pdfState === "loading";
  const pageCountLabel =
    sectionFormat === "pdf" ? (pageCount > 0 ? `${pageCount} pages` : "Loading pages") : "Image section";

  if (!book) {
    return (
      <div
        className={cn(
          "rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50 p-6 text-sm leading-6 text-stone-600",
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

  if (!activeSection) {
    return (
      <ReaderMessageState
        className={className}
        description="This book did not include any readable sections."
        title="No sections found"
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-[620px] flex-col gap-4 rounded-[1.75rem] border border-stone-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(245,238,227,0.94))] p-4 shadow-[0_18px_50px_-28px_rgba(58,38,18,0.38)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[1.35rem] border border-stone-300/80 bg-white/78 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={CONTROL_PILL_CLASSNAME}>In-App Reader</span>
            {progressLabel ? <span className={CONTROL_PILL_CLASSNAME}>Contents {progressLabel}</span> : null}
            {hasWarnings ? (
              <span className={cn(CONTROL_PILL_CLASSNAME, "gap-1.5 text-amber-800")}>
                <CircleAlert className="size-3.5" />
                Note
              </span>
            ) : null}
          </div>

          <div className="mt-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-stone-500">
              {currentSectionKindLabel}
            </p>
            <p className="mt-1 font-serif text-2xl leading-tight text-stone-950">{currentSectionLabel}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="rounded-full border-stone-300/80 bg-white/80 text-stone-700 hover:bg-white"
            disabled={activeSectionIndex <= 0}
            onClick={() => goToRelativeSection(-1)}
            size="sm"
            variant="outline"
          >
            <ChevronLeft className="size-4" />
            <span>Previous section</span>
          </Button>

          <Button
            className="rounded-full border-stone-300/80 bg-white/80 text-stone-700 hover:bg-white"
            disabled={activeSectionIndex < 0 || activeSectionIndex >= sections.length - 1}
            onClick={() => goToRelativeSection(1)}
            size="sm"
            variant="outline"
          >
            <span>Next section</span>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-[1.4rem] border border-stone-300/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(247,240,229,0.94))] shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
          <div className="border-b border-stone-300/80 px-4 py-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-stone-500">
              Reader Contents
            </p>
            <p className="mt-1 text-sm text-stone-600">
              Jump by section instead of opening the browser PDF chrome.
            </p>
          </div>

          <div className="overflow-x-auto px-3 py-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overflow-x-hidden">
            <div className="flex gap-2 lg:flex-col">
              {sections.map((section, index) => {
                const isActive = section.id === activeSection.id;

                return (
                  <button
                    aria-pressed={isActive}
                    className={cn(
                      "group min-w-[12rem] flex-1 rounded-[1.15rem] border px-3.5 py-3 text-left transition-all duration-200 lg:min-w-0",
                      isActive
                        ? "border-amber-400/80 bg-[linear-gradient(180deg,rgba(255,251,240,0.98),rgba(252,241,214,0.92))] shadow-[0_16px_28px_-24px_rgba(126,82,26,0.65)]"
                        : "border-stone-300/75 bg-white/74 hover:border-amber-300/80 hover:bg-white",
                    )}
                    key={section.id}
                    onClick={() => selectSection(section)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-stone-500">
                        {getSectionKindLabel(section.kind)}
                      </span>
                      <span className="text-xs font-semibold text-stone-500">{index + 1}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-5 font-medium text-stone-900">
                      {section.label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {hasWarnings ? (
            <div className="border-t border-stone-300/80 bg-white/55 px-4 py-3 text-xs leading-5 text-stone-600">
              {manifest?.warnings[0]}
            </div>
          ) : null}
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-[1.4rem] border border-stone-300/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(247,240,229,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-300/80 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={CONTROL_PILL_CLASSNAME}>{pageCountLabel}</span>
              {sectionFormat === "pdf" ? (
                <span className={CONTROL_PILL_CLASSNAME}>Continuous flow</span>
              ) : null}
              <span className={CONTROL_PILL_CLASSNAME}>
                {sectionFormat === "pdf" && pdfFlowLoading ? "Loading PDF" : zoomLabel}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="rounded-full border-stone-300/80 bg-white/80 text-stone-700 hover:bg-white"
                disabled={!canZoomOut || pdfFlowLoading}
                onClick={() => setZoom((currentZoom) => clampZoom(currentZoom - ZOOM_STEP))}
                size="icon-sm"
                variant="outline"
              >
                <Minus className="size-4" />
                <span className="sr-only">Zoom out</span>
              </Button>

              <Button
                className="rounded-full border-stone-300/80 bg-white/80 text-stone-700 hover:bg-white"
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

          <div className="min-h-0 flex-1 overflow-auto px-3 py-4 sm:px-5" ref={viewerRef}>
            <div className="mx-auto flex min-h-full w-full items-start justify-center">
              <div className="flex w-full flex-col items-center gap-6">
                {sectionFormat === "image" ? (
                  <div className="relative rounded-[1.4rem] border border-stone-300/80 bg-[#fcfbf7] p-3 shadow-[0_20px_44px_-30px_rgba(58,38,18,0.45)] sm:p-4">
                    <Image
                      alt={`${book.title} ${activeSection.label}`}
                      className="block h-auto max-w-full rounded-[1rem] shadow-[0_16px_36px_-24px_rgba(58,38,18,0.45)]"
                      src={sectionUrl}
                      unoptimized
                      height={1600}
                      width={1200}
                    />
                  </div>
                ) : null}

                {sectionFormat === "pdf" && pdfFlowLoading ? (
                  <div className="flex min-h-[16rem] w-full max-w-3xl items-center justify-center rounded-[1.4rem] border border-stone-300/80 bg-[#fcfbf7] p-6 shadow-[0_20px_44px_-30px_rgba(58,38,18,0.45)]">
                    <div className="flex items-center gap-3 rounded-full border border-stone-300/80 bg-white/90 px-4 py-2 text-sm text-stone-700 shadow-[0_12px_24px_-20px_rgba(58,38,18,0.45)]">
                      <LoaderCircle className="size-4 animate-spin" />
                      <span>Loading section in continuous flow...</span>
                    </div>
                  </div>
                ) : null}

                {sectionFormat === "pdf" && pdfDocument ? (
                  <div className="flex w-full flex-col items-center gap-6">
                    {pdfPageNumbers.map((pdfPageNumber) => (
                      <PdfPageCanvas
                        key={`${resolvedActiveSectionId}-${pdfPageNumber}`}
                        pageNumber={pdfPageNumber}
                        pdfDocument={pdfDocument}
                        sectionId={resolvedActiveSectionId ?? "section"}
                        viewerWidth={viewerWidth}
                        zoom={zoom}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {sectionFormat === "pdf" && pdfState === "error" ? (
              <div className="mx-auto mt-4 max-w-2xl rounded-[1.2rem] border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm leading-6 text-rose-900">
                {pdfError}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-300/80 bg-white/52 px-4 py-3 text-sm text-stone-600">
            <div className="flex items-center gap-2">
              <BookOpenText className="size-4 text-stone-500" />
              <span>Designed to keep the book in a continuous reading flow without handing off to the browser PDF viewer.</span>
            </div>
            <span className="text-xs uppercase tracking-[0.2em] text-stone-500">
              {sectionFormat === "pdf" ? "Scroll to read, download for print" : "Cover-ready preview"}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
