import { parse } from "./utils/jsonc-parser.mjs";

async function _loadConfig({ rootDirectory }) {
}

export async function start({ rootDirectory, logger, args, loadConfig = _loadConfig }) {
  let [firstArg] = args;

  let usageLogs = [
    "",
    `Usage:`,
    `  one-version check - Check the repo to ensure all dependencies are match the expected versions`,
    `  one-version help  - Display this help message!`,
    "",
  ];

  switch (firstArg) {
    case "check": {
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
