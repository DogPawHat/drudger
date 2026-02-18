import { readFile } from "node:fs/promises";
import { CliError } from "../core/errors";

export type ParsedArgs = {
  command: string;
  options: Map<string, string | true>;
};

export function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;

  if (!command) {
    throw new CliError("VALIDATION_ERROR", "Missing command");
  }

  const options = new Map<string, string | true>();

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (!token) {
      continue;
    }

    if (!token.startsWith("--")) {
      continue;
    }

    const next = rest[index + 1];

    if (!next || next.startsWith("--")) {
      options.set(token, true);
      continue;
    }

    options.set(token, next);
    index += 1;
  }

  return {
    command,
    options,
  };
}

export function getStringOption(
  options: Map<string, string | true>,
  name: string,
  alias?: string,
): string | undefined {
  const value = options.get(name);
  if (typeof value === "string") {
    return value;
  }

  if (alias) {
    const aliasValue = options.get(alias);
    if (typeof aliasValue === "string") {
      return aliasValue;
    }
  }

  return undefined;
}

export function getFormat(options: Map<string, string | true>): "json" | "text" {
  const format = getStringOption(options, "--format");
  if (format === "text") {
    return "text";
  }
  return "json";
}

export function getVaultRoot(options: Map<string, string | true>): string {
  const fromFlag = getStringOption(options, "--vault-root");
  if (fromFlag) {
    return fromFlag;
  }

  return `${process.env.HOME ?? ""}/obsidian/crabpot`;
}

export async function parseJsonInput(value: string): Promise<Record<string, unknown>> {
  const raw = value.startsWith("@") ? await readFile(value.slice(1), "utf-8") : value;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Input must be a JSON object");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new CliError(
      "PARSE_ERROR",
      error instanceof Error ? error.message : "Failed to parse JSON input",
    );
  }
}
