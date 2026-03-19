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
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="top-auto bottom-0 left-0 right-0 grid h-[100dvh] w-full translate-x-0 translate-y-0 gap-0 rounded-none border-0 bg-[linear-gradient(180deg,rgba(248,241,230,0.98),rgba(241,232,218,0.98))] p-0 shadow-none sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:h-[min(97vh,1100px)] sm:w-[min(1180px,calc(100vw-1.25rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[1.9rem] sm:border-0 sm:shadow-[0_28px_80px_-22px_rgba(37,24,14,0.42)]"
        showCloseButton={false}
      >
        {book ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-start gap-3 bg-white/62 px-4 py-3 backdrop-blur-sm sm:px-5 sm:py-4">
              <div className="min-w-0 flex-1">
                <p className="text-[0.68rem] uppercase tracking-[0.28em] text-stone-500">
                  {book.classLabel} • {book.subject}
                </p>
                <DialogTitle className="mt-2 font-serif text-2xl leading-tight text-stone-900 sm:text-3xl">
                  {book.title}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Read {book.title} in the custom in-app reader or download the compiled PDF.
                </DialogDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  asChild
                  className="rounded-full border-stone-300/80 bg-white/72 text-stone-700 hover:bg-white"
                  size="icon-sm"
                  variant="outline"
                >
                  <a
                    aria-label={`Download ${book.title} PDF`}
                    href={`/api/books/${book.id}/download`}
                    title="Download PDF"
                  >
                    <Download className="size-4" />
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

            <div className="min-h-0 flex-1 px-2 pb-2 pt-1 sm:px-3 sm:pb-3 sm:pt-1.5">
              <NcertBookReader book={book} className="h-full min-h-0" key={book.id} />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
