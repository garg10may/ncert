"use client";

import { Download, X } from "lucide-react";

import { NcertBookReader } from "@/components/ncert-book-reader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { NcertCatalogBook } from "@/lib/ncert/types";

type NcertReaderOverlayProps = {
  book: NcertCatalogBook | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NcertReaderOverlay({
  book,
  open,
  onOpenChange,
}: NcertReaderOverlayProps) {
  const sourceUrl = book ? `/api/books/${book.id}/download?inline=1` : "";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="top-auto bottom-0 left-0 right-0 grid h-[min(92vh,920px)] w-full translate-x-0 translate-y-0 gap-0 rounded-t-[2rem] rounded-b-none border-stone-300 bg-[linear-gradient(180deg,rgba(248,241,230,0.98),rgba(241,232,218,0.98))] p-0 shadow-[0_-18px_60px_-18px_rgba(37,24,14,0.45)] sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:h-[min(92vh,980px)] sm:w-[min(1120px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[2rem] sm:border sm:shadow-[0_28px_80px_-22px_rgba(37,24,14,0.55)]"
        showCloseButton={false}
      >
        {book ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-start gap-3 border-b border-stone-300/80 bg-white/65 px-4 py-4 backdrop-blur-sm sm:px-6 sm:py-5">
              <div className="min-w-0 flex-1">
                <p className="text-[0.68rem] uppercase tracking-[0.28em] text-stone-500">
                  {book.classLabel} • {book.subject}
                </p>
                <DialogTitle className="mt-2 font-serif text-2xl leading-tight text-stone-900 sm:text-3xl">
                  {book.title}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Read {book.title} in the browser or download the compiled PDF.
                </DialogDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  asChild
                  className="rounded-full bg-stone-950 text-stone-50 hover:bg-stone-800"
                  size="sm"
                >
                  <a href={`/api/books/${book.id}/download`}>
                    <Download className="size-4" />
                    <span className="hidden sm:inline">Download</span>
                    <span className="sr-only sm:not-sr-only"> PDF</span>
                  </a>
                </Button>

                <DialogClose asChild>
                  <Button
                    aria-label={`Close ${book.title}`}
                    className="rounded-full"
                    size="icon-sm"
                    variant="outline"
                  >
                    <X className="size-4" />
                  </Button>
                </DialogClose>
              </div>
            </div>

            <div className="min-h-0 flex-1 p-3 sm:p-5">
              <NcertBookReader
                activeBook={book}
                className="h-full min-h-0 rounded-[1.6rem] border-stone-300 bg-stone-100"
                frameClassName="h-full min-h-0 rounded-[1.6rem] bg-white"
                loading={false}
                sourceUrl={sourceUrl}
                title={book.title}
              />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
