"use client";

import { Download } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type { NcertCatalogBook } from "@/lib/ncert/types";

type NcertBookCoverProps = {
  book: NcertCatalogBook;
  onOpen: () => void;
  priority?: boolean;
  hoverBadgeLabel?: string;
};

const FALLBACK_COVER_STYLES = [
  {
    face: "from-stone-950 via-stone-900 to-stone-700",
    ink: "text-stone-50",
    foil: "text-amber-200/75",
  },
  {
    face: "from-emerald-950 via-emerald-900 to-emerald-700",
    ink: "text-emerald-50",
    foil: "text-emerald-200/80",
  },
  {
    face: "from-sky-950 via-blue-900 to-sky-700",
    ink: "text-sky-50",
    foil: "text-sky-200/80",
  },
  {
    face: "from-rose-950 via-red-900 to-orange-700",
    ink: "text-orange-50",
    foil: "text-amber-100/80",
  },
  {
    face: "from-violet-950 via-fuchsia-900 to-purple-700",
    ink: "text-fuchsia-50",
    foil: "text-fuchsia-200/80",
  },
  {
    face: "from-amber-950 via-amber-900 to-yellow-700",
    ink: "text-amber-50",
    foil: "text-yellow-100/80",
  },
];

function getBookHash(book: NcertCatalogBook) {
  return [...book.id].reduce((total, value) => total + value.charCodeAt(0), 0);
}

export function NcertBookCover({
  book,
  onOpen,
  priority = false,
  hoverBadgeLabel,
}: NcertBookCoverProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const bookHash = getBookHash(book);
  const fallbackStyle = FALLBACK_COVER_STYLES[bookHash % FALLBACK_COVER_STYLES.length];
  const label = `${book.classLabel} ${book.subject} ${book.title}`;

  return (
    <div className="group relative w-[108px] shrink-0 snap-start sm:w-[118px] lg:w-[128px]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[18%] -bottom-[0.12rem] z-0 h-[0.6rem] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(48,31,21,0.22)_0%,rgba(48,31,21,0.1)_50%,rgba(48,31,21,0)_82%)] blur-[3px]"
      />
      <button
        aria-label={`Open ${label}`}
        className="relative z-10 block aspect-[7/10] w-full translate-y-px overflow-visible text-left transition duration-300 hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/65"
        onClick={onOpen}
        type="button"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[0.45rem_-0.28rem_0.3rem_0.45rem] rounded-[2px] bg-[linear-gradient(180deg,rgba(44,29,20,0.22),rgba(24,16,12,0.42))] blur-[2px]"
        />

        <div
          aria-hidden="true"
          className="absolute inset-0 overflow-hidden rounded-[2px] bg-white shadow-[4px_0_0_rgba(54,38,28,0.14),0_14px_18px_-14px_rgba(42,28,20,0.42),0_2px_5px_rgba(34,24,19,0.12)]"
        >
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-br transition duration-500",
              fallbackStyle.face,
              imageLoaded && !imageError ? "opacity-0" : "opacity-100",
            )}
          >
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),transparent_20%,transparent_75%,rgba(17,12,8,0.18))]" />
          </div>

          <div
            className={cn(
              "absolute inset-x-[0.9rem] top-[0.95rem] bottom-[0.95rem] flex flex-col border border-white/10 bg-black/10 p-3 backdrop-blur-[1px] transition duration-500",
              imageLoaded && !imageError ? "opacity-0" : "opacity-100",
            )}
          >
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

          <div className="pointer-events-none absolute inset-x-0 top-0 h-7 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),transparent)]" />
        </div>

        {hoverBadgeLabel ? (
          <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex justify-end opacity-0 transition duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
            <span className="rounded-full border border-white/16 bg-black/56 px-2 py-1 text-[0.56rem] font-semibold uppercase tracking-[0.2em] text-white/95 shadow-[0_10px_20px_-16px_rgba(17,12,8,0.9)] backdrop-blur-sm">
              {hoverBadgeLabel}
            </span>
          </div>
        ) : null}
      </button>

      <a
        aria-label={`Download ${label} PDF`}
        className="absolute bottom-2.5 left-2.5 z-20 inline-flex items-center gap-1 rounded-[999px] border border-white/12 bg-black/42 px-2 py-1 text-[0.6rem] uppercase tracking-[0.24em] text-white/90 opacity-0 shadow-[0_8px_18px_-14px_rgba(17,12,8,0.8)] transition duration-300 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 hover:bg-black/56 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/80"
        href={`/api/books/${book.id}/download`}
      >
        <Download className="size-3" />
        Download
      </a>
    </div>
  );
}
