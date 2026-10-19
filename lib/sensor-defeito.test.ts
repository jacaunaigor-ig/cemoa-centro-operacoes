import assert from "node:assert/strict";
import test from "node:test";
import { sensorDesconsiderado } from "./sensor-defeito.ts";

test("o monitor da promotoria de Boca do Acre fica fora da classificação", () => {
  assert.equal(sensorDesconsiderado("MPAM_BCA_01_promotoria"), true);
  assert.equal(sensorDesconsiderado("SEMA_DCAM_07"), false);
});
