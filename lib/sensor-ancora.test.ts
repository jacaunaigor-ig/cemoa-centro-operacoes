import assert from "node:assert/strict";
import test from "node:test";
import { ancoraMunicipal } from "./sensor-ancora.ts";

test("SEMA_DCAM_44 conta como monitor de Nhamundá", () => {
  assert.equal(ancoraMunicipal("SEMA_DCAM_44")?.municipioId, "1303007");
  assert.equal(ancoraMunicipal("SEMA_DCAM_07"), null);
});
