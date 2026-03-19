import { NextResponse } from "next/server";

import { createNcertErrorResponse } from "@/lib/ncert/route-response";
import { getSectionAsset } from "@/lib/ncert/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ bookId: string; sectionId: string }> },
) {
  try {
    const { bookId, sectionId } = await context.params;
    const asset = await getSectionAsset(bookId, sectionId);

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
