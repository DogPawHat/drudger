import { CliError } from "../core/errors";
import { FindQuerySchema } from "../core/schema";
import { findJobs } from "../storage/markdown-store";

export async function runFind(
  vaultRoot: string,
  queryInput: Record<string, unknown>,
): Promise<unknown> {
  const parsed = FindQuerySchema.safeParse(queryInput);
  if (!parsed.success) {
    throw new CliError("VALIDATION_ERROR", "Invalid query input", parsed.error.issues);
  }

  const query = parsed.data;
  const jobs = await findJobs(vaultRoot, query.query, query.status, query.limit);

  return {
    ok: true,
    results: jobs.map((job) => ({
      id: job.id,
      path: job.path,
      company: job.record.Company,
      role: job.record.Role,
      status: job.record.Status,
      jobSpec: job.record["Job Spec"],
      notes: job.record.Notes,
    })),
  };
}
