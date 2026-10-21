import assert from "node:assert/strict";
import test from "node:test";
import { MixCompanyQuizzesUseCase } from "./live-session.usecases.ts";
import type { LiveSessionStore } from "./ports.ts";
import type { QuizDetail } from "../domain/types.ts";

const TENANT = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT = "22222222-2222-4222-8222-222222222222";
const QUIZ_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const QUIZ_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function quiz(id: string, tenantId: string, times: number[]): QuizDetail {
  return {
    id,
    tenantId,
    origin: "STANDARD",
    createdById: null,
    creatorName: null,
    title: id === QUIZ_A ? "Phishing" : "Correos maliciosos",
    description: null,
    createdAt: new Date(0).toISOString(),
    questions: times.map((timeSec, orderIndex) => ({
      id: `${id}:${orderIndex}`,
      orderIndex,
      type: "multiple_choice",
      text: `${id}:${orderIndex}`,
      options: ["A", "B"],
      correctIndex: 0,
      correctIndices: [],
      correctText: null,
      rangeMin: null,
      rangeMax: null,
      correctNumber: null,
      explanation: null,
      imageUrl: null,
      optionImages: [null, null],
      baseScore: 500,
      timeSec,
    })),
  };
}

function useCase(sources: QuizDetail[]) {
  const store = {
    getQuizDetail: async (id: string) => sources.find((source) => source.id === id) ?? null,
  } as LiveSessionStore;
  return new MixCompanyQuizzesUseCase(store);
}

test("mezcla preguntas sin mutar las fuentes y conserva sus tiempos", async () => {
  const sources = [quiz(QUIZ_A, TENANT, [10, 20]), quiz(QUIZ_B, TENANT, [15, 25])];
  const before = JSON.stringify(sources);
  const result = await useCase(sources).execute({ quizIds: [QUIZ_A, QUIZ_B], questionCount: 4 }, TENANT);
  assert.equal(result.questions.length, 4);
  assert.deepEqual(result.questions.map((question) => question.timeSec).sort((a, b) => a - b), [10, 15, 20, 25]);
  assert.deepEqual(result.sourceTitles, ["Phishing", "Correos maliciosos"]);
  assert.equal(JSON.stringify(sources), before);
});

test("aplica un tiempo nuevo solo a la mezcla", async () => {
  const sources = [quiz(QUIZ_A, TENANT, [10, 20]), quiz(QUIZ_B, TENANT, [15])];
  const result = await useCase(sources).execute({ quizIds: [QUIZ_A, QUIZ_B], questionCount: 2, timeSec: 30 }, TENANT);
  assert.deepEqual(result.questions.map((question) => question.timeSec), [30, 30]);
  assert.deepEqual(sources[0]?.questions.map((question) => question.timeSec), [10, 20]);
  assert.deepEqual(sources[1]?.questions.map((question) => question.timeSec), [15]);
  assert.equal(result.questions.some((question) => question.text.startsWith(QUIZ_A)), true);
  assert.equal(result.questions.some((question) => question.text.startsWith(QUIZ_B)), true);
});

test("combina un cuestionario de 10 y otro de 5 en exactamente 8 preguntas", async () => {
  const sources = [quiz(QUIZ_A, TENANT, Array(10).fill(20)), quiz(QUIZ_B, TENANT, Array(5).fill(10))];
  const result = await useCase(sources).execute({ quizIds: [QUIZ_A, QUIZ_B], questionCount: 8 }, TENANT);
  assert.equal(result.questions.length, 8);
  assert.equal(new Set(result.questions.map((question) => question.text)).size, 8);
  assert.equal(result.questions.some((question) => question.text.startsWith(QUIZ_A)), true);
  assert.equal(result.questions.some((question) => question.text.startsWith(QUIZ_B)), true);
  for (const question of result.questions) {
    assert.equal(question.timeSec, question.text.startsWith(QUIZ_A) ? 20 : 10);
  }
});

test("rechaza fuentes de otra empresa y totales mayores que lo disponible", async () => {
  const foreign = useCase([quiz(QUIZ_A, TENANT, [10]), quiz(QUIZ_B, OTHER_TENANT, [20])]);
  await assert.rejects(foreign.execute({ quizIds: [QUIZ_A, QUIZ_B], questionCount: 2 }, TENANT), { status: 403 });
  const local = useCase([quiz(QUIZ_A, TENANT, [10]), quiz(QUIZ_B, TENANT, [20])]);
  await assert.rejects(local.execute({ quizIds: [QUIZ_A, QUIZ_B], questionCount: 3 }, TENANT), { status: 422 });
});
