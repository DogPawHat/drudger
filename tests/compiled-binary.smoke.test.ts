import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTempVault } from "../src/testing/tempVault";

const TEST_FILE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(TEST_FILE_DIR, "..");

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes).trim();
}

test("compiled binary supports add/exists workflow", async () => {
  const compileDir = await mkdtemp(join(REPO_ROOT, ".tmp-job-tracker-binary-test-"));
  const binaryPath = join(compileDir, "job-tracker-smoke");
  const vault = await createTempVault();

  try {
    const build = Bun.spawnSync({
      cmd: ["bun", "build", "./src/cli.ts", "--compile", "--outfile", binaryPath],
      cwd: REPO_ROOT,
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(build.exitCode).toBe(0);

    const add = Bun.spawnSync({
      cmd: [
        binaryPath,
        "add",
        "--vault-root",
        vault.rootPath,
        "--input",
        JSON.stringify({
          Company: "Binary Smoke Co",
          Role: "Engineer",
          "Job Spec": "https://example.com/jobs/binary-smoke-1?utm_source=test",
        }),
      ],
      cwd: REPO_ROOT,
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(add.exitCode).toBe(0);
    const addPayload = JSON.parse(decode(add.stdout));
    expect(addPayload.ok).toBe(true);

    const exists = Bun.spawnSync({
      cmd: [
        binaryPath,
        "exists",
        "--vault-root",
        vault.rootPath,
        "--job-spec-url",
        "https://example.com/jobs/binary-smoke-1",
      ],
      cwd: REPO_ROOT,
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(exists.exitCode).toBe(0);
    const existsPayload = JSON.parse(decode(exists.stdout));
    expect(existsPayload.ok).toBe(true);
    expect(existsPayload.exists).toBe(true);
    expect(existsPayload.match.company).toBe("Binary Smoke Co");
  } finally {
    await vault.cleanup();
    await rm(compileDir, { recursive: true, force: true });
  }
});
