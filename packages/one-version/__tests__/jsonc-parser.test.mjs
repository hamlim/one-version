import assert from "node:assert";
import { after, before, describe, test } from "node:test";
import { parse } from "../utils/jsonc-parser.mjs";

describe("jsonc-parser", () => {
  test("parses plain old JSON fine", () => {
    let sample = {
      foo: {
        bar: ["baz", 1, 2, false, true, null],
      },
    };

    let result = parse(JSON.stringify(sample));

    assert.deepEqual(result, sample);
  });

  test("parses JSON with comments", () => {
    let sample = {
      foo: {
        bar: ["baz", 1, 2, false, true, null],
      },
    };

    let result = parse(`{
// comment
  "foo": {
    "bar": [
      // another comment
      "baz",
      /* block comments too */
      1,
      2,
      false,
      true,
      null
    ]
  }
}`);

    assert.deepEqual(result, sample);
  });
});
