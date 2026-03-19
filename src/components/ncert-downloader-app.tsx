"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  startTransition,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { NcertBookCover } from "@/components/ncert-book-cover";
import { NcertReaderOverlay } from "@/components/ncert-reader-overlay";
import { NCERT_CLASS_OPTIONS } from "@/lib/ncert/catalog";
import type { NcertCatalogBook } from "@/lib/ncert/types";
import { cn } from "@/lib/utils";

type DownloaderProps = {
  catalog: NcertCatalogBook[];
};

type ShelfArrangement = "class" | "subject";

type Shelf = {
  id: string;
  label: string;
  books: NcertCatalogBook[];
};

type ShelfScrollerProps = {
  books: NcertCatalogBook[];
  hoverBadgeFor: ShelfArrangement;
  shelfLabel: string;
  onOpenBook: (bookId: string) => void;
  shelfIndex: number;
};

const AUTO_SCROLL_SPEED = 520;
const SHELF_ARRANGEMENT_OPTIONS: ReadonlyArray<{ label: string; value: ShelfArrangement }> = [
  { label: "Subjects", value: "subject" },
  { label: "Classes", value: "class" },
];

function slugifyShelfLabel(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function sortBooksWithinClass(left: NcertCatalogBook, right: NcertCatalogBook) {
  return (
    left.canonicalSubject.localeCompare(right.canonicalSubject) ||
    left.title.localeCompare(right.title)
  );
}

function sortBooksWithinSubject(left: NcertCatalogBook, right: NcertCatalogBook) {
  return (
    left.classValue - right.classValue ||
    left.subject.localeCompare(right.subject) ||
    left.title.localeCompare(right.title)
  );
}

function getClassShelves(catalog: NcertCatalogBook[]): Shelf[] {
  return NCERT_CLASS_OPTIONS.map(({ label, value }) => {
    const books = catalog.filter((book) => book.classValue === value).sort(sortBooksWithinClass);

    if (books.length === 0) {
      return null;
    }

    return {
      id: `class-${value}`,
      label,
      books,
    };
  }).filter((shelf): shelf is Shelf => shelf !== null);
}

function getSubjectShelves(catalog: NcertCatalogBook[]): Shelf[] {
  const booksBySubject = new Map<string, NcertCatalogBook[]>();

  for (const book of catalog) {
    const existingBooks = booksBySubject.get(book.canonicalSubject);

    if (existingBooks) {
      existingBooks.push(book);
      continue;
    }

    booksBySubject.set(book.canonicalSubject, [book]);
  }

  return [...booksBySubject.entries()]
    .sort(([leftLabel], [rightLabel]) => leftLabel.localeCompare(rightLabel))
    .map(([label, books]) => ({
      id: `subject-${slugifyShelfLabel(label)}`,
      label,
      books: [...books].sort(sortBooksWithinSubject),
    }));
}

function ShelfScroller({
  books,
  hoverBadgeFor,
  shelfLabel,
  onOpenBook,
  shelfIndex,
}: ShelfScrollerProps) {
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
              hoverBadgeLabel={hoverBadgeFor === "subject" ? book.classLabel : book.subject}
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
          aria-label={`Scroll ${shelfLabel} shelf left`}
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

        <span className="bookshelf-ledge-control-text" title={shelfLabel}>
          {shelfLabel}
        </span>

        <button
          aria-label={`Scroll ${shelfLabel} shelf right`}
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
  const [shelfArrangement, setShelfArrangement] = useState<ShelfArrangement>("subject");

  const shelves = useMemo(
    () => (shelfArrangement === "subject" ? getSubjectShelves(catalog) : getClassShelves(catalog)),
    [catalog, shelfArrangement],
  );

  const activeBook = activeBookId
    ? catalog.find((book) => book.id === activeBookId) ?? null
    : null;

  const handleShelfArrangementChange = (nextArrangement: ShelfArrangement) => {
    if (nextArrangement === shelfArrangement) {
      return;
    }

    startTransition(() => {
      setShelfArrangement(nextArrangement);
    });
  };

  return (
    <div className="library-wall min-h-screen text-stone-900">
      <div className="mx-auto w-full max-w-[1540px] px-4 pb-10 pt-5 sm:px-6 lg:px-10 lg:pt-8">
        <div className="sticky top-3 z-30 mb-7 flex justify-center sm:mb-8 sm:justify-end">
          <div
            aria-label="Arrange shelves by"
            className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/72 p-1 shadow-[0_16px_36px_-22px_rgba(48,29,12,0.38)] backdrop-blur-xl"
            role="group"
          >
            <span className="hidden px-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-stone-500 sm:inline">
              Arrange by
            </span>

            {SHELF_ARRANGEMENT_OPTIONS.map((option) => {
              const isActive = shelfArrangement === option.value;

              return (
                <button
                  aria-pressed={isActive}
                  className={cn(
                    "rounded-full px-3.5 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.16em] transition sm:px-4",
                    isActive
                      ? "bg-stone-900 text-stone-50 shadow-[0_10px_20px_-14px_rgba(28,18,10,0.7)]"
                      : "text-stone-600 hover:bg-white/80 hover:text-stone-900",
                  )}
                  key={option.value}
                  onClick={() => handleShelfArrangementChange(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <main className="space-y-10 sm:space-y-12 lg:space-y-14">
          {shelves.map((shelf, shelfIndex) => (
            <section aria-label={shelf.label} key={shelf.id}>
              <h2 className="sr-only">{shelf.label}</h2>

              <div className="bookshelf-nook relative px-2 pb-0 pt-2 sm:px-4 lg:px-6">
                <ShelfScroller
                  books={shelf.books}
                  hoverBadgeFor={shelfArrangement}
                  shelfLabel={shelf.label}
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
