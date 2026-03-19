"use client";

import { useMemo, useState } from "react";

import { NcertBookCover } from "@/components/ncert-book-cover";
import { NcertReaderOverlay } from "@/components/ncert-reader-overlay";
import { Button } from "@/components/ui/button";
import { NCERT_CLASS_OPTIONS } from "@/lib/ncert/catalog";
import type { NcertCatalogBook } from "@/lib/ncert/types";

type DownloaderProps = {
  catalog: NcertCatalogBook[];
};

function getShelfId(classValue: number) {
  return `class-${classValue}`;
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

              <div className="bookshelf-nook relative px-2 pb-7 pt-1 sm:px-4 lg:px-6">
                <div className="no-scrollbar relative z-10 -mx-2 overflow-x-auto px-2 pb-[2px] sm:-mx-4 sm:px-4 lg:-mx-6 lg:px-6">
                  <div className="flex min-w-max items-end gap-4 sm:gap-5 lg:gap-6">
                    {shelf.books.map((book, bookIndex) => (
                      <NcertBookCover
                        book={book}
                        key={book.id}
                        onOpen={() => setActiveBookId(book.id)}
                        priority={shelfIndex < 2 && bookIndex < 2}
                      />
                    ))}
                  </div>
                </div>

                <div
                  aria-hidden="true"
                  className="bookshelf-ledge-shadow pointer-events-none absolute inset-x-10 bottom-[-0.25rem] h-7 sm:inset-x-14 lg:inset-x-20"
                />
                <div
                  aria-hidden="true"
                  className="bookshelf-ledge pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[1.5rem] sm:h-[1.6rem]"
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
