import assert from "node:assert";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { getUnpinnedDependencies, start } from "../one-version.mjs";

describe("one-version unit tests", () => {
  test("supports help command", async () => {
    let logs = [];
    let logger = {
      log: (...args) => {
        logs.push(args.join(" "));
      },
    };
    let { statusCode } = await start({
      rootDirectory: process.cwd(),
      logger,
      args: ["help"],
    });

    assert.equal(statusCode, 0);

    assert.match(logs[0], /one-version/);
  });

  test("bails on unknown commands", async () => {
    let logs = [];
    let logger = {
      log: (...args) => {
        logs.push(args.join(" "));
      },
    };
    let { statusCode } = await start({
      rootDirectory: process.cwd(),
      logger,
      args: [],
    });

    assert.equal(statusCode, 1);

    assert.match(logs[0], /Unknown command:/);
  });

  describe("getUnpinnedDependencies", () => {
    test("returns empty array when no dependencies are found", () => {
      let workspaceDependencies = [
        {
          name: "testing",
          dependencies: {},
          devDependencies: {},
          peerDependencies: {},
        },
      ];
      let result = getUnpinnedDependencies({
        workspaceDependencies,
        overrides: undefined,
      });

      assert.deepEqual(result, {});
    });

    test("Covers the core edge cases", () => {
      let workspaceDependencies = [
        {
          name: "testing",
          dependencies: {
            foo: "^1.0.0",
          },
          devDependencies: {
            bar: "2.0.x",
            baz: "3.X",
            react: "17.0.0 - 18.0.0",
            "react-dom": "17.0.0 || 18.0.0",
            "react-native": ">=0.64.0",
            "react-native-web": "<0.17.0",
            "one-version": "workspace:^*",
            turbo: "workspace:~*",
            next: "canary",
            abc: "next",
            def: "beta",
            ghi: "alpha",
            jkl: "rc",
            mno: "dev",
            // All below shouldn't show up!
            hohoro: "workspace:*",
            "react-router": "file:../react-router",
            "left-pad": "git://github.com/jonschlinkert/left-pad.git#1.2.0",
            "right-pad": "link:../right-pad",
            "top-pad": "url:../top-pad",
          },
          peerDependencies: {
            "peer-dep": "*",
          },
        },
      ];
      let result = getUnpinnedDependencies({
        workspaceDependencies,
        overrides: undefined,
      });

      // peer-dep is omitted because it's a peer dependency
      assert.deepEqual(result, {
        testing: [
          "foo@^1.0.0",
          "bar@2.0.x",
          "baz@3.X",
          "react@17.0.0 - 18.0.0",
          "react-dom@17.0.0 || 18.0.0",
          "react-native@>=0.64.0",
          "react-native-web@<0.17.0",
          "one-version@workspace:^*",
          "turbo@workspace:~*",
          "next@canary",
          "abc@next",
          "def@beta",
          "ghi@alpha",
          "jkl@rc",
          "mno@dev",
        ],
      });
    });

    test("Allows overriding dependencies", () => {
      let workspaceDependencies = [
        {
          name: "testing",
          dependencies: {
            foo: "^1.0.0",
          },
          devDependencies: {},
          peerDependencies: {
            next: "canary",
          },
        },
      ];
      let result = getUnpinnedDependencies({
        workspaceDependencies,
        overrides: {
          next: {
            canary: ["*"],
          },
        },
      });

      // Next not included because it's overridden
      assert.deepEqual(result, {
        testing: ["foo@^1.0.0"],
      });
    });
  });
});

let __filename = fileURLToPath(import.meta.url);
let __dirname = path.dirname(__filename);

describe("one-version integration tests", () => {
  test("bun-monorepo", async () => {
    let targetDir = path.join(__dirname, "..", "__fixtures__", "bun-monorepo");
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
    let { statusCode } = await start({
      rootDirectory: targetDir,
      logger,
      args: ["check"],
    });

    // should fail - mismatch of typescript dependencies
    assert.equal(statusCode, 1);
    // single log line with multiple new-lines
    assert.match(logs[0], /One Version Rule Failure/);
    assert.match(logs[0], /typescript/);
  });

  test("npm-monorepo", async () => {
    let targetDir = path.join(__dirname, "..", "__fixtures__", "npm-monorepo");
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
    let { statusCode } = await start({
      rootDirectory: targetDir,
      logger,
      args: ["check"],
    });

    // should fail - mismatch of typescript dependencies
    assert.equal(statusCode, 1);
    // single log line with multiple new-lines
    assert.match(logs[0], /One Version Rule Failure/);
    assert.match(logs[0], /typescript/);
  });

  test("npm-single-package", async () => {
    let targetDir = path.join(
      __dirname,
      "..",
      "__fixtures__",
      "npm-single-package",
    );
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
    let { statusCode } = await start({
      rootDirectory: targetDir,
      logger,
      args: ["check"],
    });

    assert.equal(statusCode, 0);
    assert.match(logs[0], /One Version Rule Success/);
  });

  test("yarn-classic-monorepo", async () => {
    let targetDir = path.join(
      __dirname,
      "..",
      "__fixtures__",
      "yarn-classic-monorepo",
    );
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
    let { statusCode } = await start({
      rootDirectory: targetDir,
      logger,
      args: ["check"],
    });

    // should fail - mismatch of typescript dependencies
    assert.equal(statusCode, 1);
    // single log line with multiple new-lines
    assert.match(logs[0], /One Version Rule Failure/);
    assert.match(logs[0], /typescript/);
  });

  test("yarn-classic-single-package", async () => {
    let targetDir = path.join(
      __dirname,
      "..",
      "__fixtures__",
      "yarn-classic-single-package",
    );
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
    let { statusCode } = await start({
      rootDirectory: targetDir,
      logger,
      args: ["check"],
    });

    assert.equal(statusCode, 0);
    assert.match(logs[0], /One Version Rule Success/);
  });

  test("yarn-berry-monorepo", async () => {
    let targetDir = path.join(
      __dirname,
      "..",
      "__fixtures__",
      "yarn-berry-monorepo",
    );
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
    let { statusCode } = await start({
      rootDirectory: targetDir,
      logger,
      args: ["check"],
    });

    // should fail - mismatch of typescript dependencies
    assert.equal(statusCode, 1);
    // single log line with multiple new-lines
    assert.match(logs[0], /One Version Rule Failure/);
    assert.match(logs[0], /typescript/);
  });

  test("yarn-berry-single-package", async () => {
    let targetDir = path.join(
      __dirname,
      "..",
      "__fixtures__",
      "yarn-berry-single-package",
    );
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
    let { statusCode } = await start({
      rootDirectory: targetDir,
      logger,
      args: ["check"],
    });

    assert.equal(statusCode, 0);
    assert.match(logs[0], /One Version Rule Success/);
  });

  test("pnpm-monorepo", async () => {
    let targetDir = path.join(__dirname, "..", "__fixtures__", "pnpm-monorepo");
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
    let { statusCode } = await start({
      rootDirectory: targetDir,
      logger,
      args: ["check"],
    });

    // should fail - mismatch of typescript dependencies
    assert.equal(statusCode, 1);
    // single log line with multiple new-lines
    assert.match(logs[0], /One Version Rule Failure/);
    assert.match(logs[0], /typescript/);
  });

  test("pnpm-single-package", async () => {
    let targetDir = path.join(
      __dirname,
      "..",
      "__fixtures__",
      "pnpm-single-package",
    );
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
    let { statusCode } = await start({
      rootDirectory: targetDir,
      logger,
      args: ["check"],
    });

    assert.equal(statusCode, 0);
    assert.match(logs[0], /One Version Rule Success/);
  });

  test("missing-package-manager-monorepo", async () => {
    let targetDir = path.join(
      __dirname,
      "..",
      "__fixtures__",
      "missing-package-manager-monorepo",
    );
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
    let { statusCode } = await start({
      rootDirectory: targetDir,
      logger,
      args: ["check"],
    });

    // should fail - mismatch of typescript dependencies
    assert.equal(statusCode, 1);
    assert.match(errors[0], /Could not infer package manager!/);
  });

  test("missing-package-manager-single-package", async () => {
    let targetDir = path.join(
      __dirname,
      "..",
      "__fixtures__",
      "missing-package-manager-single-package",
    );
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
    let { statusCode } = await start({
      rootDirectory: targetDir,
      logger,
      args: ["check"],
    });

    // should fail - mismatch of typescript dependencies
    assert.equal(statusCode, 1);
    assert.match(errors[0], /Could not infer package manager!/);
  });

  test("bun - configured and allowed - monorepo", async () => {
    let targetDir = path.join(
      __dirname,
      "..",
      "__fixtures__",
      "bun-configured-monorepo",
    );
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
    let { statusCode } = await start({
      rootDirectory: targetDir,
      logger,
      args: ["check"],
    });

    // should pass - configured overrides for typescript dependency
    assert.equal(statusCode, 0);

    assert.equal(errors.length, 0);
    // single log line with multiple new-lines
    assert.match(logs[0], /One Version Rule Success/);
  });

  test("bun - configured and allowed - single package", async () => {
    let targetDir = path.join(
      __dirname,
      "..",
      "__fixtures__",
      "bun-configured-single-package",
    );
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
    let { statusCode } = await start({
      rootDirectory: targetDir,
      logger,
      args: ["check"],
    });

    // should pass - configured overrides for typescript dependency
    assert.equal(statusCode, 0);

    assert.equal(errors.length, 0);
    // single log line with multiple new-lines
    assert.match(logs[0], /One Version Rule Success/);
  });

  test("bun - configured and pinned versions - monorepo", async () => {
    let targetDir = path.join(
      __dirname,
      "..",
      "__fixtures__",
      "bun-configured-pinned-monorepo",
    );
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
    let { statusCode } = await start({
      rootDirectory: targetDir,
      logger,
      args: ["check"],
    });

    // should fail because of loose deps
    assert.equal(statusCode, 1);

    assert.equal(logs.length, 2);
    assert.match(logs[0], /One Version Rule Failure/);
  });

  test("bun - configured and pinned versions - single package", async () => {
    let targetDir = path.join(
      __dirname,
      "..",
      "__fixtures__",
      "bun-configured-pinned-single-package",
    );
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
    let { statusCode } = await start({
      rootDirectory: targetDir,
      logger,
      args: ["check"],
    });

    // should fail because of loose deps
    assert.equal(statusCode, 1);

    assert.equal(logs.length, 1);
    assert.match(logs[0], /One Version Rule Failure/);
  });
});
