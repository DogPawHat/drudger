import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const JOBS_DIRECTORY = "Job Search/Jobs";

export type TempVault = {
  rootPath: string;
  writeJobNote: (fileName: string, content: string) => Promise<string>;
  readJobNote: (relativePath: string) => Promise<string>;
  cleanup: () => Promise<void>;
};

export async function createTempVault(): Promise<TempVault> {
  const rootPath = await mkdtemp(join(tmpdir(), "job-tracker-vault-"));
  const jobsPath = join(rootPath, JOBS_DIRECTORY);

  await mkdir(jobsPath, { recursive: true });

  return {
    rootPath,
    async writeJobNote(fileName, content) {
      const relativePath = `${JOBS_DIRECTORY}/${fileName}`;
      const fullPath = join(rootPath, relativePath);

      await Bun.write(fullPath, content);

      return relativePath;
    },
    async readJobNote(relativePath) {
      const fullPath = join(rootPath, relativePath);

      return Bun.file(fullPath).text();
    },
    async cleanup() {
      await rm(rootPath, { recursive: true, force: true });
    },
  };
}
