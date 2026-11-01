"use client";

import { Download, LoaderCircle, X } from "lucide-react";

import { NcertBookReader } from "@/components/ncert-book-reader";
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
  isDownloading: boolean;
  onDownload: (book: NcertCatalogBook) => void;
  onOpenChange: (open: boolean) => void;
};

export function NcertReaderOverlay({
  book,
  open,
  isDownloading,
  onDownload,
  onOpenChange,
}: NcertReaderOverlayProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="reader-dialog top-0 left-0 translate-x-0 translate-y-0" showCloseButton={false}>
        {book ? <>
          <DialogTitle className="sr-only">{book.title}</DialogTitle>
          <DialogDescription className="sr-only">
            Read {book.title}, {book.classLabel}. Choose a reading layout, open the contents, or use the arrow keys to turn pages.
          </DialogDescription>
          <NcertBookReader book={book} key={book.id} actions={<>
            <button type="button" className="reader-icon-button reader-download" disabled={isDownloading}
              onClick={() => onDownload(book)}
              aria-label={isDownloading ? "Preparing PDF download" : "Download PDF"}
              title={isDownloading ? "Preparing PDF download" : "Download PDF"}>
              {isDownloading ? <LoaderCircle size={17} className="animate-spin" /> : <Download size={17} />}
            </button>
            <DialogClose asChild>
              <button type="button" className="reader-icon-button reader-close" aria-label={`Close ${book.title}`} title="Back to bookshelf (Esc)"><X size={19} /></button>
            </DialogClose>
          </>} />
        </> : null}
      </DialogContent>
    </Dialog>
  );
}
