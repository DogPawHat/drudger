export type ErrorCode =
  | "VALIDATION_ERROR"
  | "DUPLICATE_CONFLICT"
  | "NOT_FOUND"
  | "STORAGE_READ_ERROR"
  | "STORAGE_WRITE_ERROR"
  | "PARSE_ERROR"
  | "INTERNAL_ERROR";

export class CliError extends Error {
  code: ErrorCode;
  details: unknown[];

  constructor(code: ErrorCode, message: string, details: unknown[] = []) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function toExitCode(error: unknown): number {
  if (!(error instanceof CliError)) {
    return 5;
  }

  if (error.code === "VALIDATION_ERROR") {
    return 2;
  }

  if (error.code === "DUPLICATE_CONFLICT") {
    return 3;
  }

  if (error.code === "NOT_FOUND") {
    return 4;
  }

  return 5;
}
