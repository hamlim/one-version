import assert from "node:assert";
import { exec as execCallback } from "node:child_process";
import { promises as fsPromises } from "node:fs";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { start } from "../one-version.mjs";

describe("one-version", () => {
  test("supports help command", async () => {
    let logs = [];
    const logger = {
      log: (...args) => {
        logs.push(args.join(" "));
      },
    };
    await start({ rootDirectory: process.cwd(), logger, args: ["help"] });

    assert.match(logs[0], /one-version/);
  });
});

let exec = promisify(execCallback);

let __filename = fileURLToPath(import.meta.url);
let __dirname = path.dirname(__filename);

describe("one-version integration tests", () => {
  // setup
  // copy the `__fixtures__/template-monorepo` into the following directories
  // - `__fixtures__/npm`
  // - `__fixtures__/pnpm`
  // - `__fixtures__/yarn`
  // - `__fixtures__/yarn-berry`
  // - `__fixtures__/bun`
  // - `__fixtures__/missing`
  before(async () => {
    let fixturesDir = path.join(__dirname, "..", "__fixtures__");
    let templateDir = path.join(fixturesDir, "template-monorepo");
    let targetDirs = [
      "npm",
      "pnpm",
      "yarn",
      "yarn-berry",
      "bun",
      "missing",
    ];

    async function copyDirectory(src, dest) {
      // Create the destination directory if it doesn't exist
      await fsPromises.mkdir(dest, { recursive: true });

      // Read all files and subdirectories from the source directory
      let entries = await fsPromises.readdir(src, { withFileTypes: true });

      // Copy each file and directory recursively
      for (let entry of entries) {
        let srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
          await copyDirectory(srcPath, destPath);
        } else {
          await fsPromises.copyFile(srcPath, destPath);
        }
      }
    }

    let lockFile = {
      npm: "package-lock.json",
      pnpm: "pnpm-lock.yaml",
      yarn: "yarn.lock",
      "yarn-berry": "yarn.lock",
      bun: "bun.lock",
    };

    for (const dir of targetDirs) {
      const targetDir = path.join(fixturesDir, dir);
      try {
        await copyDirectory(templateDir, targetDir);
        if (dir !== "missing") {
          await fsPromises.writeFile(lockFile[dir], "");
        }
        if (dir === "yarn-berry") {
          await fsPromises.writeFile(".yarnrc.yml", "nodeLinker: node-modules");
        }
      } catch (err) {
        throw err;
      }
    }
  });

  after(async () => {
    const fixturesDir = path.join(__dirname, "..", "__fixtures__");
    const targetDirs = [
      "npm",
      "pnpm",
      "yarn",
      "yarn-berry",
      "bun",
      "missing",
    ];

    async function removeDirectory(dir) {
      try {
        await fsPromises.rm(dir, { recursive: true, force: true });
      } catch (err) {
        throw err;
      }
    }

    for (const dir of targetDirs) {
      const targetDir = path.join(fixturesDir, dir);
      await removeDirectory(targetDir);
    }
  });

  test("npm", async () => {
    const targetDir = path.join(__dirname, "..", "__fixtures__", "npm");
    await start({ rootDirectory: targetDir, logger: console });
    // let { stdout } = await exec("npm run --silent --workspaces -- lerna version --json");
    // let versions = JSON.parse(stdout);
    // assert.equal(versions.length, 1);
    // assert.equal(versions[0].name, "one-version");
  });
  test("pnpm", async () => {
    const targetDir = path.join(__dirname, "..", "__fixtures__", "npm");
    await start({ rootDirectory: targetDir, logger: console });
    // let { stdout } = await exec("npm run --silent --workspaces -- lerna version --json");
    // let versions = JSON.parse(stdout);
    // assert.equal(versions.length, 1);
    // assert.equal(versions[0].name, "one-version");
  });
  test("yarn", async () => {
    const targetDir = path.join(__dirname, "..", "__fixtures__", "npm");
    await start({ rootDirectory: targetDir, logger: console });
    // let { stdout } = await exec("npm run --silent --workspaces -- lerna version --json");
    // let versions = JSON.parse(stdout);
    // assert.equal(versions.length, 1);
    // assert.equal(versions[0].name, "one-version");
  });
  test("yarn-berry", async () => {
    const targetDir = path.join(__dirname, "..", "__fixtures__", "npm");
    await start({ rootDirectory: targetDir, logger: console });
    // let { stdout } = await exec("npm run --silent --workspaces -- lerna version --json");
    // let versions = JSON.parse(stdout);
    // assert.equal(versions.length, 1);
    // assert.equal(versions[0].name, "one-version");
  });
  test("bun", async () => {
    const targetDir = path.join(__dirname, "..", "__fixtures__", "npm");
    await start({ rootDirectory: targetDir, logger: console });
    // let { stdout } = await exec("npm run --silent --workspaces -- lerna version --json");
    // let versions = JSON.parse(stdout);
    // assert.equal(versions.length, 1);
    // assert.equal(versions[0].name, "one-version");
  });
  test("missing", async () => {
    const targetDir = path.join(__dirname, "..", "__fixtures__", "npm");
    await start({ rootDirectory: targetDir, logger: console });
    // let { stdout } = await exec("npm run --silent --workspaces -- lerna version --json");
    // let versions = JSON.parse(stdout);
    // assert.equal(versions.length, 1);
    // assert.equal(versions[0].name, "one-version");
  });
});
