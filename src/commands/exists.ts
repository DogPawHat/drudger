import { CliError } from "../core/errors";
import { normalizeUrl } from "../core/normalize";
import { findByJobSpec } from "../storage/markdown-store";

export async function runExists(vaultRoot: string, jobSpecUrl: string, usedAlias: boolean): Promise<unknown> {
  try {
    normalizeUrl(jobSpecUrl);
  } catch {
    throw new CliError("VALIDATION_ERROR", "Invalid job spec URL");
  }

  const match = await findByJobSpec(vaultRoot, jobSpecUrl);

  return {
    ok: true,
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
