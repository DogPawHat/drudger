import { mkdir, rm } from "node:fs/promises";

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withFileLock<T>(lockPath: string, run: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();

  for (;;) {
    try {
      await mkdir(lockPath);
      break;
    } catch {
      if (Date.now() - startedAt > 5_000) {
        throw new Error(`Timed out waiting for lock: ${lockPath}`);
      }
      await sleep(20);
    }
  }

  try {
    return await run();
  } finally {
    await rm(lockPath, { recursive: true, force: true });
  }
}
