import { NextResponse } from "next/server";

import { createNcertErrorResponse } from "@/lib/ncert/route-response";
import { getBookManifest } from "@/lib/ncert/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  try {
    const { bookId } = await context.params;
    const manifest = await getBookManifest(bookId);

    return NextResponse.json(manifest);
  } catch (error) {
    return createNcertErrorResponse(error);
  }
}
