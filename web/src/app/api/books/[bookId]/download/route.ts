import { createNcertErrorResponse } from "@/lib/ncert/route-response";
import { getDownloadFilename, getCompiledBook } from "@/lib/ncert/service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  try {
    const { bookId } = await context.params;
    const url = new URL(request.url);
    const disposition = url.searchParams.get("inline") === "1" ? "inline" : "attachment";
    const bytes = await getCompiledBook(bookId);

    return new Response(new Uint8Array(bytes), {
      headers: {
        "cache-control": "no-store",
        "content-disposition": `${disposition}; filename="${getDownloadFilename(bookId)}"`,
        "content-length": String(bytes.length),
        "content-type": "application/pdf",
      },
    });
  } catch (error) {
    return createNcertErrorResponse(error);
  }
}
