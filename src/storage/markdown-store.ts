import { mkdir, readdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { computeRecordId, computeUrlDedupeKey } from "../core/dedupe";
import { CliError } from "../core/errors";
import { type AddInput, type JobRecord, JobRecordSchema, type UpdatePatch } from "../core/schema";
import { parseMarkdownNote } from "./parser";
import { serializeMarkdownNote } from "./serializer";
import { buildJobFileBaseName, resolveJobsDirectory, toRelativeJobPath } from "./paths";
import { withFileLock } from "./lock";

export type StoredJob = {
  id: string;
  dedupeKey: string;
  path: string;
  fullPath: string;
  record: JobRecord;
  body: string;
};

async function atomicWrite(fullPath: string, content: string): Promise<void> {
  const tempPath = `${fullPath}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await Bun.write(tempPath, content);
  await rename(tempPath, fullPath);
}

async function readAllMarkdownFiles(vaultRoot: string): Promise<StoredJob[]> {
  const jobsDir = resolveJobsDirectory(vaultRoot);

  try {
    await mkdir(jobsDir, { recursive: true });
    const entries = await readdir(jobsDir, { withFileTypes: true });
    const jobs: StoredJob[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        continue;
      }

      const fullPath = join(jobsDir, entry.name);
      const content = await Bun.file(fullPath).text();
      const parsed = parseMarkdownNote(content);
      const recordParse = JobRecordSchema.safeParse(parsed.frontmatter);

      if (!recordParse.success) {
        continue;
      }

      const record = recordParse.data;
      const id = computeRecordId(record["Job Spec"]);
      const dedupeKey = computeUrlDedupeKey(record["Job Spec"]);

      jobs.push({
        id,
        dedupeKey,
        path: toRelativeJobPath(vaultRoot, fullPath),
        fullPath,
        record,
        body: parsed.body,
      });
    }

    return jobs;
  } catch (error) {
    throw new CliError(
      "STORAGE_READ_ERROR",
      error instanceof Error ? error.message : "Failed to read jobs",
    );
  }
}

async function chooseAvailableFilePath(
  jobsDir: string,
  baseName: string,
  currentFullPath?: string,
): Promise<string> {
  for (let index = 1; index < 10_000; index += 1) {
    const suffix = index === 1 ? "" : ` (${index})`;
    const candidate = join(jobsDir, `${baseName}${suffix}.md`);

    if (candidate === currentFullPath) {
      return candidate;
    }

    const exists = await Bun.file(candidate).exists();
    if (!exists) {
      return candidate;
    }
  }

  throw new CliError("STORAGE_WRITE_ERROR", "Could not find available filename");
}

function duplicateConflict(existing: StoredJob): never {
  throw new CliError("DUPLICATE_CONFLICT", "Job with this Job Spec already exists", [
    {
      id: existing.id,
      path: existing.path,
      company: existing.record.Company,
      role: existing.record.Role,
      status: existing.record.Status,
      jobSpec: existing.record["Job Spec"],
    },
  ]);
}

export async function findByJobSpec(vaultRoot: string, jobSpecUrl: string): Promise<StoredJob | null> {
  const id = computeRecordId(jobSpecUrl);
  const jobs = await readAllMarkdownFiles(vaultRoot);
  return jobs.find((job) => job.id === id) ?? null;
}

export async function addJob(vaultRoot: string, input: AddInput): Promise<StoredJob> {
  const jobsDir = resolveJobsDirectory(vaultRoot);
  const id = computeRecordId(input["Job Spec"]);
  const dedupeKey = computeUrlDedupeKey(input["Job Spec"]);

  return withFileLock(join(jobsDir, ".mutations.lock"), async () => {
    await mkdir(jobsDir, { recursive: true });
    const existing = await findByJobSpec(vaultRoot, input["Job Spec"]);
    if (existing) {
      duplicateConflict(existing);
    }

    const baseName = buildJobFileBaseName(input.Company, input.Role, dedupeKey);
    const fullPath = await chooseAvailableFilePath(jobsDir, baseName);

    const { body = "", ...record } = input;
    const markdown = serializeMarkdownNote(record, body);
    await atomicWrite(fullPath, markdown);

    return {
      id,
      dedupeKey,
      path: toRelativeJobPath(vaultRoot, fullPath),
      fullPath,
      record,
      body,
    };
  });
}

export async function findJobs(
  vaultRoot: string,
  query: string,
  status?: string,
  limit = 20,
): Promise<StoredJob[]> {
  const loweredQuery = query.toLowerCase();
  const jobs = await readAllMarkdownFiles(vaultRoot);

  return jobs
    .filter((job) => {
      if (status && job.record.Status !== status) {
        return false;
      }

      const fields = [
        job.record.Company,
        job.record.Role,
        job.record.Location,
        job.record.Notes,
        job.record["Found Via Ref"],
        job.record["Job Spec"],
      ];

      return fields.some((field) =>
        typeof field === "string" ? field.toLowerCase().includes(loweredQuery) : false,
      );
    })
    .slice(0, limit);
}

export async function updateJob(vaultRoot: string, id: string, patch: UpdatePatch): Promise<StoredJob> {
  const jobsDir = resolveJobsDirectory(vaultRoot);

  return withFileLock(join(jobsDir, `.record-${id}.lock`), async () => {
    const jobs = await readAllMarkdownFiles(vaultRoot);
    const current = jobs.find((job) => job.id === id);

    if (!current) {
      throw new CliError("NOT_FOUND", "Job not found");
    }

    const nextRecord = {
      ...current.record,
      ...patch,
    };

    const recordParse = JobRecordSchema.safeParse(nextRecord);
    if (!recordParse.success) {
      throw new CliError("VALIDATION_ERROR", "Invalid update patch", recordParse.error.issues);
    }

    const parsedRecord = recordParse.data;
    const nextId = computeRecordId(parsedRecord["Job Spec"]);
    const dedupeKey = computeUrlDedupeKey(parsedRecord["Job Spec"]);

    const conflict = jobs.find((job) => job.id === nextId && job.id !== current.id);
    if (conflict) {
      duplicateConflict(conflict);
    }

    const nextBody = typeof patch.body === "string" ? patch.body : current.body;
    const baseName = buildJobFileBaseName(parsedRecord.Company, parsedRecord.Role, dedupeKey);
    const targetPath = await chooseAvailableFilePath(jobsDir, baseName, current.fullPath);

    await atomicWrite(current.fullPath, serializeMarkdownNote(parsedRecord, nextBody));

    if (targetPath !== current.fullPath) {
      await rename(current.fullPath, targetPath);
    }

    return {
      id: nextId,
      dedupeKey,
      path: toRelativeJobPath(vaultRoot, targetPath),
      fullPath: targetPath,
      record: parsedRecord,
      body: nextBody,
    };
  });
}
