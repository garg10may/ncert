import { NextResponse } from "next/server";

import { toNcertServiceError } from "@/lib/ncert/errors";

export function createNcertErrorResponse(error: unknown) {
  const serviceError = toNcertServiceError(error);

  return NextResponse.json(
    {
      error: serviceError.message,
    },
    {
      status: serviceError.statusCode,
    },
  );
}
