import { runAdd } from "./commands/add";
import { runExists } from "./commands/exists";
import { runFind } from "./commands/find";
import {
  getFormat,
  getStringOption,
  getVaultRoot,
  parseArgs,
  parseJsonInput,
} from "./commands/shared";
import { runUpdate } from "./commands/update";
import { CliError, toExitCode } from "./core/errors";
import { printError, printSuccess } from "./output/print";

async function main(): Promise<number> {
  const args = parseArgs(Bun.argv.slice(2));
  const format = getFormat(args.options);
  const vaultRoot = getVaultRoot(args.options);

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

    const payload = await runExists(vaultRoot, jobSpecUrl, usedAlias);
    printSuccess(format, payload);
    return 0;
  }

  if (args.command === "add") {
    const inputRaw = getStringOption(args.options, "--input");
    if (!inputRaw) {
      throw new CliError("VALIDATION_ERROR", "Missing --input");
    }

    const payload = await runAdd(vaultRoot, await parseJsonInput(inputRaw));
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
    });
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

    const payload = await runUpdate(vaultRoot, id, await parseJsonInput(patchRaw));
    printSuccess(format, payload);
    return 0;
  }

  throw new CliError("VALIDATION_ERROR", `Unknown command: ${args.command}`);
}

main()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    const format = getFormat(parseArgs(Bun.argv.slice(2)).options);
    printError(format, error);
    process.exit(toExitCode(error));
  });
