"use client";

import { useLayoutEffect, useRef } from "react";
import { createPageCurl } from "@/lib/page-curl-renderer";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/pdf";

export type PageTurn = {
  direction: "forward" | "backward";
  layoutKey: string;
  left: number;
  top: number;
  width: number;
  height: number;
  before: [HTMLCanvasElement, HTMLCanvasElement];
  after: [HTMLCanvasElement, HTMLCanvasElement];
};

function copyVisiblePage(source: HTMLCanvasElement, crop: number) {
  const copy = document.createElement("canvas");
  const fraction = 1 - crop * 2;
  copy.width = Math.round(source.width * fraction);
  copy.height = Math.round(source.height * fraction);
  const context = copy.getContext("2d");
  if (!context) throw new Error("Page-turn canvas unavailable");
  context.drawImage(source, source.width * crop, source.height * crop,
    source.width * fraction, source.height * fraction, 0, 0, copy.width, copy.height);
  return copy;
}

/** Prepare both sides before moving the sheet, so a slow PDF cannot flash blank paper. */
export async function preparePageTurn({ elements, destination, pdf, crop, signal, viewport, direction, layoutKey }: {
  elements: [HTMLDivElement, HTMLDivElement];
  destination: [number, number];
  pdf: PDFDocumentProxy;
  crop: number;
  signal: AbortSignal;
  viewport: HTMLDivElement;
  direction: PageTurn["direction"];
  layoutKey: string;
}): Promise<PageTurn | null> {
  const sources = elements.map((element) => element.querySelector<HTMLCanvasElement>('canvas[data-rendered="true"]'));
  if (!sources[0] || !sources[1]) return null;
  const bounds = elements.map((element) => element.getBoundingClientRect());
  if (Math.abs(bounds[0].height - bounds[1].height) > 2 || Math.abs(bounds[0].width - bounds[1].width) > 2) return null;
  const root = viewport.getBoundingClientRect();
  const before: PageTurn["before"] = [copyVisiblePage(sources[0], crop), copyVisiblePage(sources[1], crop)];
  const after = await Promise.all(destination.map(async (number, index) => {
    const page = await pdf.getPage(number);
    signal.throwIfAborted();
    const size = page.getViewport({ scale: 1 });
    const pixelRatio = window.devicePixelRatio || 1;
    const scale = bounds[index].width * pixelRatio / (size.width * (1 - crop * 2));
    const renderViewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(renderViewport.width);
    canvas.height = Math.round(renderViewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Page-turn canvas unavailable");
    const task = page.render({ canvas, canvasContext: context, viewport: renderViewport });
    const cancel = () => task.cancel();
    signal.addEventListener("abort", cancel, { once: true });
    try {
      await task.promise;
      signal.throwIfAborted();
      return copyVisiblePage(canvas, crop);
    } finally {
      signal.removeEventListener("abort", cancel);
    }
  }));
  return { direction, layoutKey, left: bounds[0].left - root.left, top: bounds[0].top - root.top,
    width: bounds[1].right - bounds[0].left, height: bounds[0].height, before, after: [after[0], after[1]] };
}

function PageSnapshot({ source }: { source: HTMLCanvasElement }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = source.width;
    canvas.height = source.height;
    canvas.getContext("2d")?.drawImage(source, 0, 0);
  }, [source]);
  return <canvas ref={ref} />;
}

export function ReaderPageTurn({ turn, onFinish, viewport, darkPaper }: {
  turn: PageTurn;
  onFinish: () => void;
  viewport: HTMLDivElement | null;
  darkPaper: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shadowRef = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = canvasRef.current, shadow = shadowRef.current;
    if (!canvas || !shadow) return;
    const forward = turn.direction === "forward";
    const renderer = createPageCurl(canvas, shadow, {
      width: turn.width, height: turn.height, forward, darkPaper,
      front: turn.before[forward ? 1 : 0], back: turn.after[forward ? 0 : 1],
    });
    // Unsupported GPUs fall back to the already rendered destination spread.
    if (!renderer) { onFinish(); return; }
    let frame = 0;
    let start = 0;
    let disposed = false;
    renderer.draw(0);
    const animate = (time: number) => {
      if (disposed) return;
      if (!start) start = time;
      const elapsed = time - start;
      const progress = Math.min(1, elapsed / 960);
      renderer.draw(progress * progress * (3 - 2 * progress));
      // Keep the landed sheet until both live PDF canvases are ready underneath.
      const ready = viewport?.querySelectorAll('.reader-paper canvas[data-rendered="true"]').length === 2;
      if (progress === 1 && (ready || elapsed > 3000)) onFinish();
      else frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    const contextLost = (event: Event) => { event.preventDefault(); onFinish(); };
    canvas.addEventListener("webglcontextlost", contextLost);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      canvas.removeEventListener("webglcontextlost", contextLost);
      renderer.dispose();
    };
  }, [turn, darkPaper, onFinish, viewport]);
  const forward = turn.direction === "forward";
  return (
    <div className="reader-turn" data-direction={turn.direction} aria-hidden="true"
      style={{ left: turn.left, top: turn.top, width: turn.width, height: turn.height }}>
      <div className="reader-turn-base reader-turn-left"><PageSnapshot source={forward ? turn.before[0] : turn.after[0]} /></div>
      <div className="reader-turn-base reader-turn-right"><PageSnapshot source={forward ? turn.after[1] : turn.before[1]} /></div>
      <canvas className="reader-curl-shadow" ref={shadowRef} />
      <canvas className="reader-curl-sheet" ref={canvasRef} />
    </div>
  );
}
