import { expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTempVault } from "../src/testing/tempVault";

const TEST_FILE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(TEST_FILE_DIR, "..");
const CLI_PATH = join(REPO_ROOT, "src", "cli.ts");

type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

function runCli(args: string[]): CliResult {
  const proc = Bun.spawnSync({
    cmd: ["bun", "run", CLI_PATH, ...args],
    cwd: REPO_ROOT,
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

test("add in text mode prints a human summary", async () => {
  const vault = await createTempVault();

  try {
    const add = runCli([
      "add",
      "--vault-root",
      vault.rootPath,
      "--format",
      "text",
      "--input",
      JSON.stringify({
        Company: "Acme",
        Role: "Engineer",
        "Job Spec": "https://example.com/jobs/text-add",
      }),
    ]);

    expect(add.exitCode).toBe(0);
    expect(add.stdout).not.toBe("ok");
    expect(add.stdout.includes("Acme")).toBe(true);
    expect(add.stdout.includes("Engineer")).toBe(true);
    expect(add.stdout.includes("Job Search/Jobs/")).toBe(true);
  } finally {
    await vault.cleanup();
  }
});

test("find in text mode prints result count summary", async () => {
  const vault = await createTempVault();

  try {
    const add = runCli([
      "add",
      "--vault-root",
      vault.rootPath,
      "--input",
      JSON.stringify({
        Company: "Toast",
        Role: "Senior Engineer",
        "Job Spec": "https://example.com/jobs/text-find",
      }),
    ]);
    expect(add.exitCode).toBe(0);

    const found = runCli([
      "find",
      "--vault-root",
      vault.rootPath,
      "--format",
      "text",
      "--query",
      "Toast",
    ]);

    expect(found.exitCode).toBe(0);
    expect(found.stdout).not.toBe("ok");
    expect(found.stdout.includes("1")).toBe(true);
    expect(found.stdout.toLowerCase().includes("result")).toBe(true);
  } finally {
    await vault.cleanup();
  }
});

test("--quiet suppresses non-error warnings in text mode", async () => {
  const vault = await createTempVault();

  try {
    await vault.writeJobNote(
      "InvalidCo - Engineer - badbadbad1.md",
      [
        "---",
        "Company: InvalidCo",
        "Role: Engineer",
        "Job Spec: https://example.com/jobs/invalid-quiet",
        "Status: not-an-emoji",
        "---",
      ].join("\n"),
    );

    const noisy = runCli([
      "find",
      "--vault-root",
      vault.rootPath,
      "--format",
      "text",
      "--query",
      "anything",
    ]);

    expect(noisy.exitCode).toBe(0);
    expect(noisy.stderr.includes("Warning: skipped invalid job note")).toBe(true);

    const quiet = runCli([
      "find",
      "--vault-root",
      vault.rootPath,
      "--format",
      "text",
      "--quiet",
      "--query",
      "anything",
    ]);

    expect(quiet.exitCode).toBe(0);
    expect(quiet.stderr).toBe("");
  } finally {
    await vault.cleanup();
  }
});

test("exists in text mode prints no-match summary", async () => {
  const vault = await createTempVault();

  try {
    const exists = runCli([
      "exists",
      "--vault-root",
      vault.rootPath,
      "--format",
      "text",
      "--job-spec-url",
      "https://example.com/jobs/missing",
    ]);

    expect(exists.exitCode).toBe(0);
    expect(exists.stdout).not.toBe("ok");
    expect(exists.stdout.toLowerCase().includes("no match")).toBe(true);
  } finally {
    await vault.cleanup();
  }
});

test("update in text mode prints updated record summary", async () => {
  const vault = await createTempVault();

  try {
    const add = runCli([
      "add",
      "--vault-root",
      vault.rootPath,
      "--input",
      JSON.stringify({
        Company: "Acme",
        Role: "Engineer",
        "Job Spec": "https://example.com/jobs/text-update",
      }),
    ]);
    expect(add.exitCode).toBe(0);
    const id = parseJsonOutput(add.stdout).created.id;

    const update = runCli([
      "update",
      "--vault-root",
      vault.rootPath,
      "--format",
      "text",
      "--id",
      id,
      "--patch",
      JSON.stringify({ Notes: "Follow up" }),
    ]);

    expect(update.exitCode).toBe(0);
    expect(update.stdout).not.toBe("ok");
    expect(update.stdout.includes(id)).toBe(true);
    expect(update.stdout.includes("Follow up")).toBe(true);
  } finally {
    await vault.cleanup();
  }
});
