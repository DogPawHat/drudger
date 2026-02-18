import { CliError } from "../core/errors";
import { AddInputSchema } from "../core/schema";
import { addJob } from "../storage/markdown-store";

type CommandOptions = {
  suppressWarnings?: boolean;
};

export async function runAdd(
  vaultRoot: string,
  input: Record<string, unknown>,
  options: CommandOptions = {},
): Promise<unknown> {
  const parsed = AddInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new CliError("VALIDATION_ERROR", "Invalid add input", parsed.error.issues);
  }

  const created = await addJob(vaultRoot, parsed.data, options);
  const message = `Created ${created.record.Company} - ${created.record.Role} at ${created.path}`;

  return {
    ok: true,
    message,
    created: {
      id: created.id,
      dedupeKey: created.dedupeKey,
      path: created.path,
      company: created.record.Company,
      role: created.record.Role,
      status: created.record.Status,
      jobSpec: created.record["Job Spec"],
      record: created.record,
      body: created.body,
    },
  };
}
