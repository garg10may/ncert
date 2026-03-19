"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";

import type { NcertCatalogBook } from "@/lib/ncert/types";

type NcertBookReaderProps = {
  activeBook: NcertCatalogBook | null;
  title: string;
  sourceUrl: string;
  loading: boolean;
};

export function NcertBookReader({
  activeBook,
  title,
  sourceUrl,
  loading,
}: NcertBookReaderProps) {
  const [loadedSourceUrl, setLoadedSourceUrl] = useState("");
  const frameLoading = Boolean(activeBook && sourceUrl && loadedSourceUrl !== sourceUrl);

  if (!activeBook) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50 p-6 text-sm leading-6 text-stone-600">
        Pick a book to start reading.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[620px] items-center justify-center rounded-[1.75rem] border border-stone-300 bg-stone-100 text-stone-600">
        <div className="flex items-center gap-3">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          <span>Loading book...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-stone-300 bg-stone-100">
      {frameLoading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-stone-100/90 text-stone-600">
          <div className="flex items-center gap-3">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            <span>Loading book...</span>
          </div>
        </div>
      ) : null}
      <iframe
        className="h-[72vh] min-h-[620px] w-full bg-white"
        key={sourceUrl}
        onLoad={() => setLoadedSourceUrl(sourceUrl)}
        src={sourceUrl}
        title={title}
      />
    </div>
  );
}
