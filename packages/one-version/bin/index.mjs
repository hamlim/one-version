#!/usr/bin/env node
import { start } from "../one-version.mjs";

start({ rootDirectory: process.cwd(), logger: console }).catch((e) => {
  console.error("Error running one-version:");
  console.error(e);
  process.exit(1);
});
