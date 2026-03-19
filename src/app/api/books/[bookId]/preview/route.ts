import { NextResponse } from "next/server";

import { createNcertErrorResponse } from "@/lib/ncert/route-response";
import { getPreviewAsset } from "@/lib/ncert/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  try {
    const { bookId } = await context.params;
    const asset = await getPreviewAsset(bookId);

    return new NextResponse(new Uint8Array(asset.bytes), {
      headers: {
        "cache-control": "no-store",
        "content-type": asset.contentType,
      },
    });
  } catch (error) {
    return createNcertErrorResponse(error);
  }
}
