import assert from "node:assert";
import { after, before, test } from "node:test";
import { parse } from "../utils/jsonc-parser.mjs";

test("parses plain old JSON fine", () => {
  let sample = {
    foo: {
      bar: ["baz", 1, 2, false, true, null],
    },
  };

  let result = parse(JSON.stringify(sample));

  assert.deepEqual(result, sample);
});
