import sanitizeFilename from "sanitize-filename";

import { createNcertErrorResponse } from "@/lib/ncert/route-response";
import { buildBulkZip } from "@/lib/ncert/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { bookIds?: string[] };
    const bookIds = [...new Set((body.bookIds ?? []).filter(Boolean))];

    if (bookIds.length === 0) {
      return Response.json({ error: "No books selected" }, { status: 400 });
    }

    const bytes = await buildBulkZip(bookIds);
    const filename = sanitizeFilename(
      bookIds.length === 1 ? "ncert-book.zip" : `ncert-batch-${bookIds.length}-books.zip`,
    );

    return new Response(new Uint8Array(bytes), {
      headers: {
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="${filename}"`,
        "content-length": String(bytes.length),
        "content-type": "application/zip",
      },
    });
  } catch (error) {
    return createNcertErrorResponse(error);
  }
}
