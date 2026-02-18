import { CliError } from "../core/errors";

export type OutputFormat = "json" | "text";

export function printSuccess(format: OutputFormat, payload: unknown): void {
  if (format === "json") {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
    return;
  }

  if (typeof payload === "object" && payload !== null && "message" in payload) {
    process.stdout.write(`${String((payload as { message: unknown }).message)}\n`);
    return;
  }

  process.stdout.write("ok\n");
}

export function printError(format: OutputFormat, error: unknown): void {
  const normalized =
    error instanceof CliError
      ? {
          ok: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        }
      : {
          ok: false,
          error: {
            code: "INTERNAL_ERROR",
            message: error instanceof Error ? error.message : "Unexpected error",
            details: [],
          },
        };

  if (format === "json") {
    process.stdout.write(`${JSON.stringify(normalized)}\n`);
    return;
  }

  process.stderr.write(`${normalized.error.code}: ${normalized.error.message}\n`);
}
