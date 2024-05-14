import assert from "node:assert";
import { after, before, test } from "node:test";
import { start } from "../one-version.mjs";

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
