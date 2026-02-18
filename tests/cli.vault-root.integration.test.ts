import { expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TEST_FILE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(TEST_FILE_DIR, "..");
const CLI_PATH = join(REPO_ROOT, "src", "cli.ts");

type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

function runCliWithoutHome(args: string[]): CliResult {
  const proc = Bun.spawnSync({
    cmd: ["bun", "run", CLI_PATH, ...args],
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      HOME: "",
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: proc.exitCode,
    stdout: new TextDecoder().decode(proc.stdout).trim(),
    stderr: new TextDecoder().decode(proc.stderr).trim(),
  };
}

function parseJsonOutput(stdout: string): any {
  return JSON.parse(stdout);
}

test("missing HOME without --vault-root returns clear validation error", () => {
  const result = runCliWithoutHome(["exists", "--job-spec-url", "https://example.com/jobs/123"]);

  expect(result.exitCode).toBe(2);
  const payload = parseJsonOutput(result.stdout);
  expect(payload.ok).toBe(false);
  expect(payload.error.code).toBe("VALIDATION_ERROR");
  expect(payload.error.message.includes("--vault-root")).toBe(true);
  expect(payload.error.message.includes("HOME")).toBe(true);
});
