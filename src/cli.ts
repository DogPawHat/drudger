import { runAdd } from "./commands/add";
import { runExists } from "./commands/exists";
import { runFind } from "./commands/find";
import {
  getFormat,
  getQuiet,
  getStringOption,
  getVaultRoot,
  parseArgs,
  parseJsonInput,
} from "./commands/shared";
import { runUpdate } from "./commands/update";
import { CliError, toExitCode } from "./core/errors";
import { printError, printSuccess } from "./output/print";

function globalHelp(): string {
  return [
    "Usage: drudger <command> [options]",
    "",
    "Commands:",
    "  exists  Check for an existing job by Job Spec URL",
    "  add     Add a new job record",
    "  update  Update an existing job record by id",
    "  find    Search job records",
    "  help    Show help for command",
    "",
    "Global options:",
    "  --vault-root <path>   Vault root path (default: ~/obsidian/crabpot)",
    "  --format json|text    Output format (default: json)",
    "  --quiet               Suppress non-error logs in text mode",
    "  --help, -h            Show help",
  ].join("\n");
}

function commandHelp(command: string): string {
  if (command === "exists") {
    return [
      "Usage: drudger exists --job-spec-url <url> [options]",
      "",
      "Options:",
      "  --job-spec-url <url>",
      "  --canonical-source-url <url>   Deprecated alias",
      "  --vault-root <path>",
      "  --format json|text",
    ].join("\n");
  }

  if (command === "add") {
    return [
      "Usage: drudger add --input <json-or-file-ref> [options]",
      "",
      "Options:",
      "  --input <json-or-file-ref>",
      "  --vault-root <path>",
      "  --format json|text",
    ].join("\n");
  }

  if (command === "update") {
    return [
      "Usage: drudger update --id <id> --patch <json-or-file-ref> [options]",
      "",
      "Options:",
      "  --id <id>",
      "  --patch <json-or-file-ref>",
      "  --vault-root <path>",
      "  --format json|text",
    ].join("\n");
  }

  if (command === "find") {
    return [
      "Usage: drudger find --query <text> [options]",
      "",
      "Options:",
      "  --query <text>",
      "  --status <emoji>",
      "  --limit <n>",
      "  --vault-root <path>",
      "  --format json|text",
    ].join("\n");
  }

  return globalHelp();
}

function parseHelpRequest(argv: string[]): { show: boolean; command?: string } {
  if (argv.length === 0) {
    return { show: true };
  }

  const first = argv[0];
  const second = argv[1];
  const hasHelpFlag = argv.includes("--help") || argv.includes("-h");

  if (first === "help") {
    return { show: true, command: second };
  }

  if (first === "--help" || first === "-h") {
    return { show: true, command: second };
  }

  if (hasHelpFlag && first) {
    return { show: true, command: first };
  }

  return { show: false };
}

async function main(): Promise<number> {
  const rawArgs = Bun.argv.slice(2);
  const help = parseHelpRequest(rawArgs);

  if (help.show) {
    process.stdout.write(`${help.command ? commandHelp(help.command) : globalHelp()}\n`);
    return 0;
  }

  const args = parseArgs(rawArgs);
  const format = getFormat(args.options);
  const quiet = getQuiet(args.options);
  const vaultRoot = getVaultRoot(args.options);
  const suppressWarnings = format === "text" && quiet;

  if (args.command === "exists") {
    const jobSpecUrl = getStringOption(
      args.options,
      "--job-spec-url",
      "--canonical-source-url",
    );
    const usedAlias =
      !getStringOption(args.options, "--job-spec-url") &&
      Boolean(getStringOption(args.options, "--canonical-source-url"));

    if (!jobSpecUrl) {
      throw new CliError("VALIDATION_ERROR", "Missing --job-spec-url");
    }

    const payload = await runExists(vaultRoot, jobSpecUrl, usedAlias, { suppressWarnings });
    printSuccess(format, payload);
    return 0;
  }

  if (args.command === "add") {
    const inputRaw = getStringOption(args.options, "--input");
    if (!inputRaw) {
      throw new CliError("VALIDATION_ERROR", "Missing --input");
    }

    const payload = await runAdd(vaultRoot, await parseJsonInput(inputRaw), { suppressWarnings });
    printSuccess(format, payload);
    return 0;
  }

  if (args.command === "find") {
    const query = getStringOption(args.options, "--query");
    if (!query) {
      throw new CliError("VALIDATION_ERROR", "Missing --query");
    }

    const payload = await runFind(vaultRoot, {
      query,
      status: getStringOption(args.options, "--status"),
      limit: getStringOption(args.options, "--limit"),
    }, { suppressWarnings });
    printSuccess(format, payload);
    return 0;
  }

  if (args.command === "update") {
    const id = getStringOption(args.options, "--id");
    const patchRaw = getStringOption(args.options, "--patch");

    if (!id) {
      throw new CliError("VALIDATION_ERROR", "Missing --id");
    }

    if (!patchRaw) {
      throw new CliError("VALIDATION_ERROR", "Missing --patch");
    }

    const payload = await runUpdate(vaultRoot, id, await parseJsonInput(patchRaw), {
      suppressWarnings,
    });
    printSuccess(format, payload);
    return 0;
  }

  throw new CliError(
    "VALIDATION_ERROR",
    `Unknown command: ${args.command}. Available commands: exists, add, update, find, help`,
  );
}

main()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    let format: "json" | "text" = "json";

    try {
      format = getFormat(parseArgs(Bun.argv.slice(2)).options);
    } catch {
      format = "json";
    }

    printError(format, error);
    process.exit(toExitCode(error));
  });
