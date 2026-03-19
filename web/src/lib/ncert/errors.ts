export class NcertServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "NcertServiceError";
    this.statusCode = statusCode;
  }
}

export function toNcertServiceError(error: unknown): NcertServiceError {
  if (error instanceof NcertServiceError) {
    return error;
  }

  if (error instanceof Error) {
    return new NcertServiceError(error.message, 500, { cause: error });
  }

  return new NcertServiceError("Unknown NCERT service error.", 500, { cause: error });
}
