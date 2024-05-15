import assert from "node:assert";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { start } from "../one-version.mjs";

describe("one-version", () => {
  test("supports help command", async () => {
    let logs = [];
    const logger = {
      log: (...args) => {
        logs.push(args.join(" "));
      },
    };
    let { statusCode } = await start({ rootDirectory: process.cwd(), logger, args: ["help"] });

    assert.equal(statusCode, 0);

    assert.match(logs[0], /one-version/);
  });

  test("bails on unknown commands", async () => {
    let logs = [];
    const logger = {
      log: (...args) => {
        logs.push(args.join(" "));
      },
    };
    let { statusCode } = await start({ rootDirectory: process.cwd(), logger, args: [] });

    assert.equal(statusCode, 1);

    assert.match(logs[0], /Unknown command:/);
  });
});

let __filename = fileURLToPath(import.meta.url);
let __dirname = path.dirname(__filename);

describe("one-version integration tests", () => {
  test("bun", async () => {
    const targetDir = path.join(__dirname, "..", "__fixtures__", "bun");
    let logs = [];
    let errors = [];
    let logger = {
      log(...args) {
        logs.push(args.join(" "));
      },
      error(...args) {
        errors.push(args.join(" "));
      },
    };
    let { statusCode } = await start({ rootDirectory: targetDir, logger, args: ["check"] });

    // should fail - mismatch of typescript dependencies
    assert.equal(statusCode, 1);
    assert.match(errors[0], /More than one version of dependencies found. See above output/);
    // single log line with multiple new-lines
    assert.match(logs[0], /One Version Rule Failure/);
    assert.match(logs[0], /typescript/);
  });

  test("npm", async () => {
    const targetDir = path.join(__dirname, "..", "__fixtures__", "npm");
    let logs = [];
    let errors = [];
    let logger = {
      log(...args) {
        logs.push(args.join(" "));
      },
      error(...args) {
        errors.push(args.join(" "));
      },
    };
    let { statusCode } = await start({ rootDirectory: targetDir, logger, args: ["check"] });

    // should fail - mismatch of typescript dependencies
    assert.equal(statusCode, 1);
    assert.match(errors[0], /More than one version of dependencies found. See above output/);
    // single log line with multiple new-lines
    assert.match(logs[0], /One Version Rule Failure/);
    assert.match(logs[0], /typescript/);
  });

  test("yarn-classic", async () => {
    const targetDir = path.join(__dirname, "..", "__fixtures__", "yarn-classic");
    let logs = [];
    let errors = [];
    let logger = {
      log(...args) {
        logs.push(args.join(" "));
      },
      error(...args) {
        errors.push(args.join(" "));
      },
    };
    let { statusCode } = await start({ rootDirectory: targetDir, logger, args: ["check"] });

    // should fail - mismatch of typescript dependencies
    assert.equal(statusCode, 1);
    assert.match(errors[0], /More than one version of dependencies found. See above output/);
    // single log line with multiple new-lines
    assert.match(logs[0], /One Version Rule Failure/);
    assert.match(logs[0], /typescript/);
  });

  test("yarn-berry", async () => {
    const targetDir = path.join(__dirname, "..", "__fixtures__", "yarn-berry");
    let logs = [];
    let errors = [];
    let logger = {
      log(...args) {
        logs.push(args.join(" "));
      },
      error(...args) {
        errors.push(args.join(" "));
      },
    };
    let { statusCode } = await start({ rootDirectory: targetDir, logger, args: ["check"] });

    // should fail - mismatch of typescript dependencies
    assert.equal(statusCode, 1);
    assert.match(errors[0], /More than one version of dependencies found. See above output/);
    // single log line with multiple new-lines
    assert.match(logs[0], /One Version Rule Failure/);
    assert.match(logs[0], /typescript/);
  });

  test("pnpm", async () => {
    const targetDir = path.join(__dirname, "..", "__fixtures__", "pnpm");
    let logs = [];
    let errors = [];
    let logger = {
      log(...args) {
        logs.push(args.join(" "));
      },
      error(...args) {
        errors.push(args.join(" "));
      },
    };
    let { statusCode } = await start({ rootDirectory: targetDir, logger, args: ["check"] });

    // should fail - mismatch of typescript dependencies
    assert.equal(statusCode, 1);
    assert.match(errors[0], /More than one version of dependencies found. See above output/);
    // single log line with multiple new-lines
    assert.match(logs[0], /One Version Rule Failure/);
    assert.match(logs[0], /typescript/);
  });

  test("missing", async () => {
    const targetDir = path.join(__dirname, "..", "__fixtures__", "missing");
    let logs = [];
    let errors = [];
    let logger = {
      log(...args) {
        logs.push(args.join(" "));
      },
      error(...args) {
        errors.push(args.join(" "));
      },
    };
    let { statusCode } = await start({ rootDirectory: targetDir, logger, args: ["check"] });

    // should fail - mismatch of typescript dependencies
    assert.equal(statusCode, 1);
    assert.match(errors[0], /Could not infer package manager!/);
  });

  test("bun - configured and allowed", async () => {
    const targetDir = path.join(__dirname, "..", "__fixtures__", "bun-configured");
    let logs = [];
    let errors = [];
    let logger = {
      log(...args) {
        logs.push(args.join(" "));
      },
      error(...args) {
        errors.push(args.join(" "));
      },
    };
    let { statusCode } = await start({ rootDirectory: targetDir, logger, args: ["check"] });

    // should pass - configured overrides for typescript dependency
    assert.equal(statusCode, 0);

    assert.equal(errors.length, 0);
    // single log line with multiple new-lines
    assert.match(logs[0], /One Version Rule Success/);
  });
});
