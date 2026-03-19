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

function getFallbackStyle(book: NcertCatalogBook) {
  const hash = [...book.id].reduce((total, value) => total + value.charCodeAt(0), 0);
  return FALLBACK_COVER_STYLES[hash % FALLBACK_COVER_STYLES.length];
}

export function NcertBookCover({ book, onOpen, priority = false }: NcertBookCoverProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const fallbackStyle = getFallbackStyle(book);
  const label = `${book.classLabel} ${book.subject} ${book.title}`;

  return (
    <div className="relative w-[106px] shrink-0 snap-start sm:w-[118px] lg:w-[132px]">
      <button
        aria-label={`Open ${label}`}
        className="group relative block aspect-[7/10] w-full overflow-hidden rounded-[1.2rem] border border-black/10 text-left shadow-[0_18px_28px_-16px_rgba(51,31,14,0.45),0_2px_6px_rgba(30,22,16,0.18)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_38px_-18px_rgba(51,31,14,0.54),0_8px_14px_rgba(30,22,16,0.18)] focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/70"
        onClick={onOpen}
        type="button"
      >
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 overflow-hidden rounded-[1.2rem] bg-gradient-to-br",
            fallbackStyle.face,
          )}
        >
          <div className="absolute inset-[3px] rounded-[1rem] border bg-[linear-gradient(180deg,rgba(255,255,255,0.18),transparent_24%,transparent_68%,rgba(17,12,8,0.18))] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]" />
          <div className="absolute inset-y-[4%] left-[8px] w-[10px] rounded-full bg-black/18 shadow-[inset_-1px_0_0_rgba(255,255,255,0.18)]" />
          <div className="absolute inset-x-[1.1rem] top-[1rem] bottom-[1rem] flex flex-col rounded-[0.95rem] border border-white/10 bg-black/10 p-3 backdrop-blur-[1px]">
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
          <div className={cn("absolute inset-[3px] rounded-[1rem] border", fallbackStyle.trim)} />
        </div>

        {!imageError ? (
          <Image
            alt=""
            aria-hidden="true"
            className={cn(
              "absolute inset-0 h-full w-full rounded-[1.2rem] object-cover transition duration-500",
              imageLoaded ? "opacity-100" : "opacity-0",
            )}
            fill
            onError={() => setImageError(true)}
            onLoad={() => setImageLoaded(true)}
            priority={priority}
            sizes="(max-width: 640px) 106px, (max-width: 1024px) 118px, 132px"
            src={`/api/books/${book.id}/cover`}
            unoptimized
          />
        ) : null}

        <div className="pointer-events-none absolute inset-0 rounded-[1.2rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.18),transparent_18%,transparent_55%,rgba(15,10,7,0.16))]" />
        <div className="pointer-events-none absolute bottom-0 left-[14%] right-[14%] h-4 rounded-full bg-black/18 blur-md" />
        <span className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-1 text-[0.62rem] uppercase tracking-[0.24em] text-white/90 opacity-0 transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          <ExternalLink className="size-3" />
          Open
        </span>
      </button>

      <Button
        asChild
        className="absolute right-2 top-2 z-10 rounded-full border border-white/45 bg-white/92 text-stone-900 shadow-[0_10px_18px_-12px_rgba(15,10,7,0.75)] hover:bg-white"
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
