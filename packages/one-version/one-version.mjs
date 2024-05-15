import { exec } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createReadStream, readFileSync, rmSync, writeFileSync } from "node:fs";
import path, { join as pathJoin } from "node:path";
import { promisify } from "node:util";
import { createDebug } from "./utils/create-debug.mjs";
import { parse } from "./utils/jsonc-parser.mjs";

let debug = createDebug("one-version");

function loadConfig({ rootDirectory }) {
  try {
    // prefer jsonc first, then fallback to .json
    if (existsSync(pathJoin(rootDirectory, "one-version.config.jsonc"))) {
      return parse(readFileSync(pathJoin(rootDirectory, "one-version.config.jsonc"), "utf8"));
    }
    return parse(readFileSync(pathJoin(rootDirectory, "one-version.config.json"), "utf8"));
  } catch (error) {
    debug("Error loading config", error);
    return {};
  }
}

function inferPackageManager({ rootDirectory }) {
  if (existsSync(pathJoin(rootDirectory, "yarn.lock"))) {
    if (existsSync(pathJoin(rootDirectory, ".yarnrc.yml"))) {
      return "yarn-berry";
    }
    return "yarn";
  }
  if (existsSync(pathJoin(rootDirectory, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (existsSync(pathJoin(rootDirectory, "package-lock.json"))) {
    return "npm";
  }
  if (existsSync(pathJoin(rootDirectory, "bun.lockb"))) {
    return "bun";
  }
  throw new Error("Could not infer package manager! Please specify one in the config file.");
}

let usageLogs = [
  "",
  `Usage:`,
  `  one-version check - Check the repo to ensure all dependencies are match the expected versions`,
  `  one-version help  - Display this help message!`,
  "",
];
export async function start({ rootDirectory, logger, args }) {
  let [firstArg] = args;

  switch (firstArg) {
    case "check": {
      let initialConfig = loadConfig({ rootDirectory });
      if (!initialConfig.packageManager) {
        initialConfig.packageManager = inferPackageManager({ rootDirectory });
      }
      // @TODO
      return;
    }
    case "help": {
      logger.log(`one-version - a strict dependency conformance tool for (mono)repos!`);
      for (let log of usageLogs) {
        logger.log(log);
      }
      return;
    }
    default: {
      logger.log(`Unknown command: ${firstArg}`);
      for (let log of usageLogs) {
        logger.log(log);
      }
      return;
    }
  }
}
