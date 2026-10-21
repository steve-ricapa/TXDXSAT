import assert from "node:assert/strict";
import test from "node:test";
import { clampMixQuestionCount, maxMixQuestionCount } from "./mix-limit.ts";

test("no permite 21 preguntas si tres fuentes suman 20", () => {
  assert.equal(clampMixQuestionCount(21, 3, 20), 20);
  assert.equal(clampMixQuestionCount(20, 3, 20), 20);
});

test("ajusta el total cuando se quita una fuente", () => {
  assert.equal(clampMixQuestionCount(15, 2, 8), 8);
  assert.equal(clampMixQuestionCount(1, 3, 20), 3);
});

test("respeta también el límite del editor de 100 preguntas", () => {
  assert.equal(maxMixQuestionCount(120), 100);
  assert.equal(clampMixQuestionCount(120, 3, 120), 100);
});
