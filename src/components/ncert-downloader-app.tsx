"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";

import { NcertBookCover } from "@/components/ncert-book-cover";
import { NcertReaderOverlay } from "@/components/ncert-reader-overlay";
import { Button } from "@/components/ui/button";
import { NCERT_CLASS_OPTIONS } from "@/lib/ncert/catalog";
import type { NcertCatalogBook } from "@/lib/ncert/types";
import { cn } from "@/lib/utils";

type DownloaderProps = {
  catalog: NcertCatalogBook[];
};

function getShelfId(classValue: number) {
  return `class-${classValue}`;
}

type ShelfScrollerProps = {
  books: NcertCatalogBook[];
  classLabel: string;
  onOpenBook: (bookId: string) => void;
  shelfIndex: number;
};

const AUTO_SCROLL_SPEED = 520;

function ShelfScroller({ books, classLabel, onOpenBook, shelfIndex }: ShelfScrollerProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollDirectionRef = useRef<"left" | "right" | null>(null);
  const lastAutoScrollTimeRef = useRef<number | null>(null);
  const [scrollState, setScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: false,
    hasOverflow: false,
  });

  useEffect(() => {
    const node = scrollRef.current;

    if (!node) {
      return;
    }

    const updateScrollState = () => {
      const maxScrollLeft = node.scrollWidth - node.clientWidth;

      setScrollState({
        canScrollLeft: node.scrollLeft > 6,
        canScrollRight: maxScrollLeft - node.scrollLeft > 6,
        hasOverflow: maxScrollLeft > 6,
      });
    };

    updateScrollState();

    node.addEventListener("scroll", updateScrollState, { passive: true });

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(node);

    const content = node.firstElementChild;
    if (content instanceof HTMLElement) {
      resizeObserver.observe(content);
    }

    window.addEventListener("resize", updateScrollState);

    return () => {
      node.removeEventListener("scroll", updateScrollState);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateScrollState);
    };
  }, [books.length]);

  useEffect(() => {
    return () => {
      if (autoScrollFrameRef.current !== null) {
        cancelAnimationFrame(autoScrollFrameRef.current);
      }
    };
  }, []);

  const scrollShelf = (direction: "left" | "right") => {
    const node = scrollRef.current;

    if (!node) {
      return;
    }

    const distance = Math.max(node.clientWidth * 0.72, 220);
    node.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  const stopAutoScroll = () => {
    autoScrollDirectionRef.current = null;
    lastAutoScrollTimeRef.current = null;

    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  };

  const stepAutoScroll = (timestamp: number) => {
    const node = scrollRef.current;
    const direction = autoScrollDirectionRef.current;

    if (!node || !direction) {
      autoScrollFrameRef.current = null;
      lastAutoScrollTimeRef.current = null;
      return;
    }

    const maxScrollLeft = node.scrollWidth - node.clientWidth;
    const remainingScroll =
      direction === "left" ? node.scrollLeft : maxScrollLeft - node.scrollLeft;

    if (remainingScroll <= 1) {
      stopAutoScroll();
      return;
    }

    const previousTimestamp = lastAutoScrollTimeRef.current ?? timestamp;
    const elapsed = timestamp - previousTimestamp;
    const distance = Math.min((AUTO_SCROLL_SPEED * elapsed) / 1000, remainingScroll);

    lastAutoScrollTimeRef.current = timestamp;
    node.scrollLeft += direction === "left" ? -distance : distance;
    autoScrollFrameRef.current = requestAnimationFrame(stepAutoScroll);
  };

  const startAutoScroll = (direction: "left" | "right") => {
    if (
      autoScrollDirectionRef.current === direction &&
      autoScrollFrameRef.current !== null
    ) {
      return;
    }

    autoScrollDirectionRef.current = direction;
    lastAutoScrollTimeRef.current = null;

    if (autoScrollFrameRef.current === null) {
      autoScrollFrameRef.current = requestAnimationFrame(stepAutoScroll);
    }
  };

  const updateAutoScrollFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") {
      stopAutoScroll();
      return;
    }

    const node = scrollRef.current;

    if (!node) {
      return;
    }

    const bounds = node.getBoundingClientRect();
    const edgeThreshold = Math.min(Math.max(bounds.width * 0.16, 56), 112);
    const maxScrollLeft = node.scrollWidth - node.clientWidth;

    if (event.clientX <= bounds.left + edgeThreshold && node.scrollLeft > 6) {
      startAutoScroll("left");
      return;
    }

    if (
      event.clientX >= bounds.right - edgeThreshold &&
      maxScrollLeft - node.scrollLeft > 6
    ) {
      startAutoScroll("right");
      return;
    }

    stopAutoScroll();
  };

  return (
    <div className="relative">
      <div
        className="no-scrollbar relative z-10 -mx-2 overflow-x-auto px-2 pb-[1.85rem] sm:-mx-4 sm:px-4 sm:pb-[1.95rem] lg:-mx-6 lg:px-6"
        onPointerCancel={stopAutoScroll}
        onPointerDown={stopAutoScroll}
        onPointerEnter={updateAutoScrollFromPointer}
        onPointerLeave={stopAutoScroll}
        onPointerMove={updateAutoScrollFromPointer}
        ref={scrollRef}
      >
        <div className="flex min-w-max items-end gap-4 sm:gap-5 lg:gap-6">
          {books.map((book, bookIndex) => (
            <NcertBookCover
              book={book}
              key={book.id}
              onOpen={() => onOpenBook(book.id)}
              priority={shelfIndex < 2 && bookIndex < 2}
            />
          ))}
        </div>
      </div>

      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 z-20 w-14 bg-gradient-to-r from-white/28 to-transparent transition-opacity sm:w-20",
          scrollState.canScrollLeft ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 z-20 w-14 bg-gradient-to-l from-white/28 to-transparent transition-opacity sm:w-20",
          scrollState.canScrollRight ? "opacity-100" : "opacity-0",
        )}
      />

      <div className="bookshelf-ledge-label absolute bottom-[0.18rem] left-1/2 z-20 -translate-x-1/2 sm:bottom-[0.2rem]">
        <button
          aria-label={`Scroll ${classLabel} shelf left`}
          className={cn(
            "bookshelf-ledge-control-button",
            scrollState.hasOverflow ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
          disabled={!scrollState.canScrollLeft}
          onClick={() => scrollShelf("left")}
          type="button"
        >
          <ChevronLeft className="size-3" />
        </button>

        <span className="bookshelf-ledge-control-text">{classLabel}</span>

        <button
          aria-label={`Scroll ${classLabel} shelf right`}
          className={cn(
            "bookshelf-ledge-control-button",
            scrollState.hasOverflow ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
          disabled={!scrollState.canScrollRight}
          onClick={() => scrollShelf("right")}
          type="button"
        >
          <ChevronRight className="size-3" />
        </button>
      </div>
    </div>
  );
}

export function NcertDownloaderApp({ catalog }: DownloaderProps) {
  const [activeBookId, setActiveBookId] = useState<string | null>(null);

  const shelves = useMemo(
    () =>
      NCERT_CLASS_OPTIONS.map(({ label, value }) => ({
        classLabel: label,
        classValue: value,
        books: catalog.filter((book) => book.classValue === value),
      })).filter((shelf) => shelf.books.length > 0),
    [catalog],
  );

  const activeBook = activeBookId
    ? catalog.find((book) => book.id === activeBookId) ?? null
    : null;

  return (
    <div className="library-wall min-h-screen text-stone-900">
      <div className="mx-auto w-full max-w-[1540px] px-4 pb-10 pt-5 sm:px-6 lg:px-10 lg:pt-8">
        <header className="sticky top-3 z-30 mb-8 rounded-[1.75rem] border border-white/65 bg-white/60 px-3 py-3 shadow-[0_16px_42px_-24px_rgba(48,29,12,0.38)] backdrop-blur-xl sm:px-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="px-1">
              <p className="text-[0.72rem] uppercase tracking-[0.34em] text-stone-500">
                NCERT Atlas
              </p>
            </div>

            <nav
              aria-label="Jump to class"
              className="no-scrollbar -mx-1 overflow-x-auto px-1"
            >
              <div className="flex w-max gap-2">
                {shelves.map((shelf) => (
                  <Button
                    asChild
                    className="rounded-full border border-stone-300/90 bg-white/80 text-stone-700 hover:border-stone-400 hover:bg-white"
                    key={shelf.classValue}
                    size="sm"
                    variant="outline"
                  >
                    <a href={`#${getShelfId(shelf.classValue)}`}>{shelf.classLabel}</a>
                  </Button>
                ))}
              </div>
            </nav>
          </div>
        </header>

        <main className="space-y-10 sm:space-y-12 lg:space-y-14">
          {shelves.map((shelf, shelfIndex) => (
            <section
              aria-label={shelf.classLabel}
              className="scroll-mt-28"
              id={getShelfId(shelf.classValue)}
              key={shelf.classValue}
            >
              <h2 className="sr-only">{shelf.classLabel}</h2>

              <div className="bookshelf-nook relative px-2 pb-0 pt-2 sm:px-4 lg:px-6">
                <ShelfScroller
                  books={shelf.books}
                  classLabel={shelf.classLabel}
                  onOpenBook={setActiveBookId}
                  shelfIndex={shelfIndex}
                />

                <div
                  aria-hidden="true"
                  className="bookshelf-ledge-shadow pointer-events-none absolute inset-x-12 bottom-[-0.2rem] h-8 sm:inset-x-16 sm:h-9 lg:inset-x-[5.5rem]"
                />
                <div
                  aria-hidden="true"
                  className="bookshelf-ledge-top pointer-events-none absolute inset-x-0 bottom-[1.18rem] z-0 h-[0.66rem] sm:bottom-[1.26rem] sm:h-[0.7rem]"
                />
                <div
                  aria-hidden="true"
                  className="bookshelf-ledge pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[1.26rem] sm:h-[1.36rem]"
                />
              </div>
            </section>
          ))}
        </main>
      </div>

      <NcertReaderOverlay
        book={activeBook}
        onOpenChange={(open) => {
          if (!open) {
            setActiveBookId(null);
          }
        }}
        open={Boolean(activeBook)}
      />
    </div>
  );
}
