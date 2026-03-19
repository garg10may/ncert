import { createHash } from "node:crypto";

import { createNcertErrorResponse } from "@/lib/ncert/route-response";
import { getDownloadFilename, getCompiledBook } from "@/lib/ncert/service";

export const runtime = "nodejs";

const PDF_CACHE_CONTROL = "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(
  request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  try {
    const { bookId } = await context.params;
    const url = new URL(request.url);
    const disposition = url.searchParams.get("inline") === "1" ? "inline" : "attachment";
    const bytes = await getCompiledBook(bookId);
    const etag = `"${createHash("sha1").update(bytes).digest("hex")}"`;

    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          "cache-control": PDF_CACHE_CONTROL,
          "content-disposition": `${disposition}; filename="${getDownloadFilename(bookId)}"`,
          etag,
        },
      });
    }

    return new Response(new Uint8Array(bytes), {
      headers: {
        "cache-control": PDF_CACHE_CONTROL,
        "content-disposition": `${disposition}; filename="${getDownloadFilename(bookId)}"`,
        "content-length": String(bytes.length),
        "content-type": "application/pdf",
        etag,
      },
    });
  } catch (error) {
    return createNcertErrorResponse(error);
  }
}
