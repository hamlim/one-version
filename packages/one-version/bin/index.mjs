#!/usr/bin/env node
import { start } from "../one-version.mjs";

start({
  rootDirectory: process.cwd(),
  logger: console,
  args: process.argv.slice(2),
})
  .then((result) => {
    if (typeof result.statusCode === "number") {
      process.exit(result.statusCode);
    }
  })
  .catch((e) => {
    console.error("Error running one-version:");
    console.error(e);
    process.exit(1);
  });
