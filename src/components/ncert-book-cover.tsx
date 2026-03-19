"use client";

import { Download, ExternalLink } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NcertCatalogBook } from "@/lib/ncert/types";

type NcertBookCoverProps = {
  book: NcertCatalogBook;
  onOpen: () => void;
  priority?: boolean;
};

const FALLBACK_COVER_STYLES = [
  {
    face: "from-stone-950 via-stone-900 to-stone-700",
    ink: "text-stone-50",
    foil: "text-amber-200/75",
    trim: "border-stone-200/20",
  },
  {
    face: "from-emerald-950 via-emerald-900 to-emerald-700",
    ink: "text-emerald-50",
    foil: "text-emerald-200/80",
    trim: "border-emerald-200/20",
  },
  {
    face: "from-sky-950 via-blue-900 to-sky-700",
    ink: "text-sky-50",
    foil: "text-sky-200/80",
    trim: "border-sky-200/20",
  },
  {
    face: "from-rose-950 via-red-900 to-orange-700",
    ink: "text-orange-50",
    foil: "text-amber-100/80",
    trim: "border-orange-100/20",
  },
  {
    face: "from-violet-950 via-fuchsia-900 to-purple-700",
    ink: "text-fuchsia-50",
    foil: "text-fuchsia-200/80",
    trim: "border-fuchsia-200/20",
  },
  {
    face: "from-amber-950 via-amber-900 to-yellow-700",
    ink: "text-amber-50",
    foil: "text-yellow-100/80",
    trim: "border-yellow-100/20",
  },
];

function getBookHash(book: NcertCatalogBook) {
  return [...book.id].reduce((total, value) => total + value.charCodeAt(0), 0);
}

export function NcertBookCover({ book, onOpen, priority = false }: NcertBookCoverProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const bookHash = getBookHash(book);
  const fallbackStyle = FALLBACK_COVER_STYLES[bookHash % FALLBACK_COVER_STYLES.length];
  const label = `${book.classLabel} ${book.subject} ${book.title}`;

  return (
    <div className="relative w-[108px] shrink-0 snap-start sm:w-[118px] lg:w-[128px]">
      <button
        aria-label={`Open ${label}`}
        className="group relative block aspect-[7/10] w-full translate-y-px overflow-visible border border-stone-900/16 bg-white text-left shadow-[0_14px_18px_-12px_rgba(42,28,20,0.42),0_2px_6px_rgba(34,24,19,0.14)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_22px_-12px_rgba(42,28,20,0.46),0_4px_10px_rgba(34,24,19,0.16)] focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/70"
        onClick={onOpen}
        type="button"
      >
        <div
          aria-hidden="true"
          className="absolute inset-[2px] overflow-hidden border border-stone-900/7 bg-white"
        >
          <div
            className={cn("absolute inset-0 bg-gradient-to-br", fallbackStyle.face)}
          >
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),transparent_20%,transparent_75%,rgba(17,12,8,0.18))]" />
          </div>

          <div className="absolute inset-x-[0.9rem] top-[0.95rem] bottom-[0.95rem] flex flex-col border border-white/10 bg-black/10 p-3 backdrop-blur-[1px]">
            <p className={cn("text-[0.58rem] uppercase tracking-[0.32em]", fallbackStyle.foil)}>
              {book.classLabel}
            </p>
            <div className="mt-3 h-px bg-white/15" />
            <p
              className={cn(
                "mt-3 text-[1.05rem] leading-[1.04] font-serif tracking-[0.01em] sm:text-[1.12rem]",
                fallbackStyle.ink,
              )}
            >
              {book.title}
            </p>
            <p className={cn("mt-auto pt-3 text-[0.64rem] uppercase tracking-[0.24em]", fallbackStyle.foil)}>
              {book.subject}
            </p>
          </div>
          <div className={cn("absolute inset-0 border", fallbackStyle.trim)} />

          {!imageError ? (
            <Image
              alt=""
              aria-hidden="true"
              className={cn(
                "object-cover transition duration-500",
                imageLoaded ? "opacity-100" : "opacity-0",
              )}
              fill
              onError={() => setImageError(true)}
              onLoad={() => setImageLoaded(true)}
              priority={priority}
              sizes="(max-width: 640px) 108px, (max-width: 1024px) 118px, 128px"
              src={`/api/books/${book.id}/cover`}
              unoptimized
            />
          ) : null}
        </div>

        <div className="pointer-events-none absolute inset-x-[2px] top-[2px] h-7 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),transparent)]" />
        <span className="pointer-events-none absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 bg-black/40 px-2 py-1 text-[0.6rem] uppercase tracking-[0.24em] text-white/90 opacity-0 transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          <ExternalLink className="size-3" />
          Open
        </span>
      </button>

      <Button
        asChild
        className="absolute right-2 top-2 z-10 border border-white/45 bg-white/92 text-stone-900 shadow-[0_10px_18px_-12px_rgba(15,10,7,0.75)] hover:bg-white"
        size="icon-xs"
        variant="outline"
      >
        <a
          aria-label={`Download ${label} PDF`}
          href={`/api/books/${book.id}/download`}
          onClick={(event) => event.stopPropagation()}
        >
          <Download className="size-3.5" />
        </a>
      </Button>
    </div>
  );
}
