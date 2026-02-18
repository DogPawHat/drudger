import { join } from "node:path";

export const JOBS_RELATIVE_DIRECTORY = join("Job Search", "Jobs");

export function resolveJobsDirectory(vaultRoot: string): string {
  return join(vaultRoot, JOBS_RELATIVE_DIRECTORY);
}

export function toRelativeJobPath(vaultRoot: string, fullPath: string): string {
  if (!fullPath.startsWith(vaultRoot)) {
    return fullPath;
  }

  const suffix = fullPath.slice(vaultRoot.length).replace(/^\//, "");
  return suffix;
}

export function buildJobFileBaseName(company: string, role: string, dedupeKey: string): string {
  const safeCompany = company.replaceAll("/", "-");
  const safeRole = role.replaceAll("/", "-");
  return `${safeCompany} - ${safeRole} - ${dedupeKey}`;
}
