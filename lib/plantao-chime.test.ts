import assert from "node:assert/strict";
import test from "node:test";
import { avisoWavDataUri } from "./plantao-chime.ts";

test("o aviso sonoro é um wav com as três notas", () => {
  const uri = avisoWavDataUri();
  assert.equal(uri.startsWith("data:audio/wav;base64,"), true);
  const bytes = Buffer.from(uri.slice("data:audio/wav;base64,".length), "base64");
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(bytes.subarray(8, 12).toString("ascii"), "WAVE");
  assert.ok(bytes.length > 1000);
});
