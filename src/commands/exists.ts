import { CliError } from "../core/errors";
import { normalizeUrl } from "../core/normalize";
import { findByJobSpec } from "../storage/markdown-store";

type CommandOptions = {
  suppressWarnings?: boolean;
};

export async function runExists(
  vaultRoot: string,
  jobSpecUrl: string,
  usedAlias: boolean,
  options: CommandOptions = {},
): Promise<unknown> {
  try {
    normalizeUrl(jobSpecUrl);
  } catch {
    throw new CliError("VALIDATION_ERROR", "Invalid job spec URL");
  }

  const match = await findByJobSpec(vaultRoot, jobSpecUrl, options);
  const message = match
    ? `Match found: ${match.record.Company} - ${match.record.Role} (${match.path})`
    : "No match found";

  return {
    ok: true,
    message,
    ...(usedAlias ? { warning: "--canonical-source-url is deprecated" } : {}),
    exists: Boolean(match),
    match: match
      ? {
          id: match.id,
          path: match.path,
          company: match.record.Company,
          role: match.record.Role,
          status: match.record.Status,
          jobSpec: match.record["Job Spec"],
        }
      : null,
  };
}
