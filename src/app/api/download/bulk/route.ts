import sanitizeFilename from "sanitize-filename";

import { createNcertErrorResponse } from "@/lib/ncert/route-response";
import { buildBulkZip } from "@/lib/ncert/service";

export const runtime = "nodejs";

type BulkDownloadPayload = {
  bookIds?: string[];
  downloadName?: string;
};

function getBookIds(values: Iterable<string>): string[] {
  return [
    ...new Set(
      [...values]
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

function getBulkZipFilename(bookIds: string[], downloadName?: string): string {
  const requestedName = downloadName?.trim();

  if (requestedName) {
    return sanitizeFilename(`NCERT - ${requestedName}.zip`) || "ncert-books.zip";
  }

  return sanitizeFilename(
    bookIds.length === 1 ? "ncert-book.zip" : `ncert-batch-${bookIds.length}-books.zip`,
  );
}

async function createBulkDownloadResponse(bookIds: string[], downloadName?: string) {
  if (bookIds.length === 0) {
    return Response.json({ error: "No books selected" }, { status: 400 });
  }

  const bytes = await buildBulkZip(bookIds);
  const filename = getBulkZipFilename(bookIds, downloadName);

  return new Response(new Uint8Array(bytes), {
    headers: {
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${filename}"`,
      "content-length": String(bytes.length),
      "content-type": "application/zip",
    },
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const bookIds = getBookIds(url.searchParams.getAll("bookId"));
    const downloadName = url.searchParams.get("downloadName") ?? undefined;

    return createBulkDownloadResponse(bookIds, downloadName);
  } catch (error) {
    return createNcertErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BulkDownloadPayload;
    const bookIds = getBookIds(body.bookIds ?? []);
    const downloadName = typeof body.downloadName === "string" ? body.downloadName : undefined;

    return createBulkDownloadResponse(bookIds, downloadName);
  } catch (error) {
    return createNcertErrorResponse(error);
  }
}
