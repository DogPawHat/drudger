import { CliError } from "../core/errors";
import { UpdatePatchSchema } from "../core/schema";
import { updateJob } from "../storage/markdown-store";

export async function runUpdate(
  vaultRoot: string,
  id: string,
  patchInput: Record<string, unknown>,
): Promise<unknown> {
  const parsed = UpdatePatchSchema.safeParse(patchInput);
  if (!parsed.success) {
    throw new CliError("VALIDATION_ERROR", "Invalid update patch", parsed.error.issues);
  }

  const updated = await updateJob(vaultRoot, id, parsed.data);

  return {
    ok: true,
    updated: {
      id: updated.id,
      dedupeKey: updated.dedupeKey,
      path: updated.path,
      record: updated.record,
      body: updated.body,
    },
  };
}
