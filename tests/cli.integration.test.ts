import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
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

async function runCliAsync(args: string[]): Promise<CliResult> {
  const proc = Bun.spawn({
    cmd: ["bun", "run", CLI_PATH, ...args],
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  return {
    exitCode,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

function parseJsonOutput(stdout: string): any {
  return JSON.parse(stdout);
}

test("add creates a note under Job Search/Jobs and exists finds it", async () => {
  const vault = await createTempVault();

  try {
    const add = runCli([
      "add",
      "--vault-root",
      vault.rootPath,
      "--input",
      JSON.stringify({
        Company: "Acme/Corp",
        Role: "Engineer",
        "Job Spec": "https://Example.com/jobs/123/?utm_source=mail",
        Status: "🔍",
      }),
    ]);

    expect(add.exitCode).toBe(0);
    const addPayload = parseJsonOutput(add.stdout);
    expect(addPayload.ok).toBe(true);
    expect(addPayload.created.path.startsWith("Job Search/Jobs/")).toBe(true);
    expect(addPayload.created.path.includes("Acme-Corp - Engineer - ")).toBe(true);

    const filePath = join(vault.rootPath, addPayload.created.path);
    expect(existsSync(filePath)).toBe(true);

    const exists = runCli([
      "exists",
      "--vault-root",
      vault.rootPath,
      "--job-spec-url",
      "https://example.com/jobs/123",
    ]);

    expect(exists.exitCode).toBe(0);
    const existsPayload = parseJsonOutput(exists.stdout);
    expect(existsPayload.ok).toBe(true);
    expect(existsPayload.exists).toBe(true);
    expect(existsPayload.match.company).toBe("Acme/Corp");
  } finally {
    await vault.cleanup();
  }
});

test("exists alias --canonical-source-url behaves the same", async () => {
  const vault = await createTempVault();

  try {
    runCli([
      "add",
      "--vault-root",
      vault.rootPath,
      "--input",
      JSON.stringify({
        Company: "Acme",
        Role: "Engineer",
        "Job Spec": "https://example.com/jobs/1",
      }),
    ]);

    const usingPrimary = runCli([
      "exists",
      "--vault-root",
      vault.rootPath,
      "--job-spec-url",
      "https://example.com/jobs/1",
    ]);
    const usingAlias = runCli([
      "exists",
      "--vault-root",
      vault.rootPath,
      "--canonical-source-url",
      "https://example.com/jobs/1",
    ]);

    expect(usingPrimary.exitCode).toBe(0);
    expect(usingAlias.exitCode).toBe(0);
    expect(parseJsonOutput(usingPrimary.stdout).exists).toBe(true);
    expect(parseJsonOutput(usingAlias.stdout).exists).toBe(true);
  } finally {
    await vault.cleanup();
  }
});

test("duplicate add returns conflict and exit code 3", async () => {
  const vault = await createTempVault();

  try {
    runCli([
      "add",
      "--vault-root",
      vault.rootPath,
      "--input",
      JSON.stringify({
        Company: "Acme",
        Role: "Engineer",
        "Job Spec": "https://example.com/jobs/2?utm_source=foo",
      }),
    ]);

    const duplicate = runCli([
      "add",
      "--vault-root",
      vault.rootPath,
      "--input",
      JSON.stringify({
        Company: "Acme",
        Role: "Engineer II",
        "Job Spec": "https://example.com/jobs/2",
      }),
    ]);

    expect(duplicate.exitCode).toBe(3);
    const payload = parseJsonOutput(duplicate.stdout);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("DUPLICATE_CONFLICT");
  } finally {
    await vault.cleanup();
  }
});

test("find performs case-insensitive search and status filter", async () => {
  const vault = await createTempVault();

  try {
    runCli([
      "add",
      "--vault-root",
      vault.rootPath,
      "--input",
      JSON.stringify({
        Company: "Toast",
        Role: "Senior Engineer",
        "Job Spec": "https://example.com/jobs/toast",
        Status: "🔍",
      }),
    ]);
    runCli([
      "add",
      "--vault-root",
      vault.rootPath,
      "--input",
      JSON.stringify({
        Company: "Acme",
        Role: "Designer",
        "Job Spec": "https://example.com/jobs/acme",
        Status: "✅",
      }),
    ]);

    const all = runCli([
      "find",
      "--vault-root",
      vault.rootPath,
      "--query",
      "senior",
    ]);
    const filtered = runCli([
      "find",
      "--vault-root",
      vault.rootPath,
      "--query",
      "engineer",
      "--status",
      "🔍",
    ]);

    expect(all.exitCode).toBe(0);
    expect(filtered.exitCode).toBe(0);
    expect(parseJsonOutput(all.stdout).results.length).toBe(1);
    expect(parseJsonOutput(filtered.stdout).results.length).toBe(1);
  } finally {
    await vault.cleanup();
  }
});

test("update patches record, preserves body, and handles not found", async () => {
  const vault = await createTempVault();

  try {
    const added = runCli([
      "add",
      "--vault-root",
      vault.rootPath,
      "--input",
      JSON.stringify({
        Company: "Acme",
        Role: "Engineer",
        "Job Spec": "https://example.com/jobs/3",
        body: "Initial body text\n",
      }),
    ]);
    const id = parseJsonOutput(added.stdout).created.id;

    const updated = runCli([
      "update",
      "--vault-root",
      vault.rootPath,
      "--id",
      id,
      "--patch",
      JSON.stringify({
        Notes: "Follow up",
      }),
    ]);

    expect(updated.exitCode).toBe(0);
    const updatePayload = parseJsonOutput(updated.stdout);
    expect(updatePayload.ok).toBe(true);
    expect(updatePayload.updated.record.Notes).toBe("Follow up");
    expect(updatePayload.updated.body).toBe("Initial body text\n");

    const missing = runCli([
      "update",
      "--vault-root",
      vault.rootPath,
      "--id",
      "does-not-exist",
      "--patch",
      JSON.stringify({ Notes: "x" }),
    ]);
    expect(missing.exitCode).toBe(4);
  } finally {
    await vault.cleanup();
  }
});

test("update detects conflict when Job Spec changes to existing one", async () => {
  const vault = await createTempVault();

  try {
    runCli([
      "add",
      "--vault-root",
      vault.rootPath,
      "--input",
      JSON.stringify({
        Company: "Acme",
        Role: "Engineer",
        "Job Spec": "https://example.com/jobs/4",
      }),
    ]);
    const second = runCli([
      "add",
      "--vault-root",
      vault.rootPath,
      "--input",
      JSON.stringify({
        Company: "Acme",
        Role: "Engineer II",
        "Job Spec": "https://example.com/jobs/5",
      }),
    ]);

    const secondId = parseJsonOutput(second.stdout).created.id;

    const conflict = runCli([
      "update",
      "--vault-root",
      vault.rootPath,
      "--id",
      secondId,
      "--patch",
      JSON.stringify({
        "Job Spec": "https://example.com/jobs/4",
      }),
    ]);

    expect(conflict.exitCode).toBe(3);
    expect(parseJsonOutput(conflict.stdout).error.code).toBe("DUPLICATE_CONFLICT");
  } finally {
    await vault.cleanup();
  }
});

test("update renames file and applies collision fallback suffix", async () => {
  const vault = await createTempVault();

  try {
    const added = runCli([
      "add",
      "--vault-root",
      vault.rootPath,
      "--input",
      JSON.stringify({
        Company: "OldCo",
        Role: "OldRole",
        "Job Spec": "https://example.com/jobs/6",
      }),
    ]);

    const payload = parseJsonOutput(added.stdout);
    const id = payload.created.id;
    const dedupeKey = payload.created.dedupeKey;
    const jobsDir = join(vault.rootPath, "Job Search", "Jobs");
    const collisionPath = join(jobsDir, `NewCo - NewRole - ${dedupeKey}.md`);
    await Bun.write(collisionPath, "---\nCompany: Placeholder\nRole: Placeholder\nJob Spec: https://example.com/jobs/placeholder\n---\n\n");

    const updated = runCli([
      "update",
      "--vault-root",
      vault.rootPath,
      "--id",
      id,
      "--patch",
      JSON.stringify({
        Company: "NewCo",
        Role: "NewRole",
      }),
    ]);

    expect(updated.exitCode).toBe(0);
    const updatedPayload = parseJsonOutput(updated.stdout);
    expect(updatedPayload.updated.path.endsWith(`NewCo - NewRole - ${dedupeKey} (2).md`)).toBe(
      true,
    );
  } finally {
    await vault.cleanup();
  }
});

test("invalid args return validation error envelope and exit code 2", async () => {
  const vault = await createTempVault();

  try {
    const exists = runCli([
      "exists",
      "--vault-root",
      vault.rootPath,
      "--job-spec-url",
      "not-a-url",
    ]);

    expect(exists.exitCode).toBe(2);
    const payload = parseJsonOutput(exists.stdout);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("VALIDATION_ERROR");
  } finally {
    await vault.cleanup();
  }
});

test("concurrent updates do not corrupt markdown", async () => {
  const vault = await createTempVault();

  try {
    const added = runCli([
      "add",
      "--vault-root",
      vault.rootPath,
      "--input",
      JSON.stringify({
        Company: "Acme",
        Role: "Engineer",
        "Job Spec": "https://example.com/jobs/7",
      }),
    ]);
    const id = parseJsonOutput(added.stdout).created.id;

    const first = runCliAsync([
        "update",
        "--vault-root",
        vault.rootPath,
        "--id",
        id,
        "--patch",
        JSON.stringify({ Notes: "A" }),
      ]);
    const second = runCliAsync([
        "update",
        "--vault-root",
        vault.rootPath,
        "--id",
        id,
        "--patch",
        JSON.stringify({ Notes: "B" }),
      ]);

    const [a, b] = await Promise.all([first, second]);
    expect(a.exitCode).toBe(0);
    expect(b.exitCode).toBe(0);

    const found = runCli([
      "find",
      "--vault-root",
      vault.rootPath,
      "--query",
      "Acme",
    ]);

    expect(found.exitCode).toBe(0);
    const payload = parseJsonOutput(found.stdout);
    expect(payload.results.length).toBe(1);
    expect(["A", "B"]).toContain(payload.results[0].notes);
  } finally {
    await vault.cleanup();
  }
});

test("unknown command returns available command hint", () => {
  const result = runCli(["bogus"]);

  expect(result.exitCode).toBe(2);
  const payload = parseJsonOutput(result.stdout);
  expect(payload.ok).toBe(false);
  expect(payload.error.code).toBe("VALIDATION_ERROR");
  expect(payload.error.message.includes("Available commands")).toBe(true);
});

test("root help prints usage and exits successfully", () => {
  const result = runCli(["--help"]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout.includes("Usage: job-tracker <command> [options]")).toBe(true);
  expect(result.stdout.includes("Commands:")).toBe(true);
  expect(result.stdout.includes("exists")).toBe(true);
  expect(result.stdout.includes("add")).toBe(true);
  expect(result.stdout.includes("update")).toBe(true);
  expect(result.stdout.includes("find")).toBe(true);
});

test("subcommand help prints command-specific usage", () => {
  const result = runCli(["add", "--help"]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout.includes("Usage: job-tracker add --input <json-or-file-ref>")).toBe(true);
  expect(result.stdout.includes("--input")).toBe(true);
});
