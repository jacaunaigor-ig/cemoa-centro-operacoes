import assert from "node:assert/strict";
import test from "node:test";
import { peekWeatherCache, WEATHER_TTL_MS } from "./weather-forecast.ts";

test("sem consulta a previsão não aparece como lote recente", () => {
  assert.equal(peekWeatherCache(), null);
  assert.equal(WEATHER_TTL_MS, 30 * 60_000);
});
