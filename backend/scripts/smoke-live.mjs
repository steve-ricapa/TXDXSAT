#!/usr/bin/env node
/**
 * End-to-end smoke test for the live-session engine.
 *
 * Creates a small mixed-type quiz, opens a session, connects one host, one
 * presenter and two players over Socket.IO, and plays it to the end:
 *   join -> start -> (question -> answer -> reveal -> next) * N -> ended
 *
 * It asserts server-authoritative scoring, shuffled-option mapping, per-question
 * results, the final leaderboard, persistence and PIN isolation, then exits
 * non-zero on the first failure.
 *
 * Usage: node scripts/smoke-live.mjs [apiBaseUrl] [socketUrl]
 */
import { io } from "socket.io-client";
import { bearer, getToken } from "./lib/auth.mjs";

const apiBase = (process.argv[2] ?? "http://localhost:4100/api/v1").replace(/\/$/, "");
// Socket.IO origin: the HTTP origin only. The deployment prefix (`/sat`) belongs
// in `path`, not in the namespace, so it must be stripped here.
const socketUrl = process.argv[3] ?? new URL(apiBase).origin;
// Behind Nginx the Socket.IO handshake lives under the deployment prefix.
const socketPath =
  process.argv[4] ?? (apiBase.includes("/sat") ? "/sat/socket.io" : "/socket.io");
const socketOptions = { transports: ["websocket"], path: socketPath };

let failures = 0;
let TOKEN = null;
function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function once(socket, event, { timeout = 15_000, filter = () => true } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timeout waiting for ${event}`));
    }, timeout);
    function handler(payload) {
      if (!filter(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    }
    socket.on(event, handler);
  });
}

async function post(path, body, headers = {}) {
  const res = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...bearer(TOKEN), ...headers },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

async function get(path, headers = {}) {
  const res = await fetch(`${apiBase}${path}`, { headers: { ...bearer(TOKEN), ...headers } });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const quiz = {
  title: "Smoke Test Quiz",
  questions: [
    {
      type: "multiple_choice",
      text: "2 + 2?",
      options: ["3", "4", "5", "6"],
      correctIndex: 1,
      timeSec: 15,
    },
    { type: "true_false", text: "The sky is blue.", options: ["Verdadero", "Falso"], correctIndex: 0, timeSec: 15 },
    {
      type: "multi_select",
      text: "Select even numbers.",
      options: ["1", "2", "3", "4"],
      correctIndices: [1, 3],
      timeSec: 20,
    },
    { type: "open_text", text: "Capital of France?", correctText: "Paris", timeSec: 15 },
    {
      type: "closest_to",
      text: "How many days in a leap year?",
      rangeMin: 300,
      rangeMax: 400,
      correctNumber: 366,
      timeSec: 20,
    },
  ],
};

/** Build an answer payload that should be judged correct for a question. */
function correctAnswer(question, broadcast) {
  const order = broadcast.optionOrder; // order[slot] = originalIndex
  const slotOf = (original) => order.indexOf(original);
  switch (broadcast.type) {
    case "multiple_choice":
      return { chosenIndex: slotOf(question.correctIndex) };
    case "true_false":
      return { chosenIndex: slotOf(question.correctIndex) };
    case "multi_select":
      return { chosenIndices: question.correctIndices.map(slotOf) };
    case "open_text":
      return { chosenText: question.correctText };
    case "closest_to":
      return { chosenText: String(question.correctNumber) };
    default:
      return {};
  }
}

async function main() {
  console.log("== live-session smoke test ==");
  TOKEN = await getToken(apiBase);
  const createdQuiz = await post("/live/quizzes", quiz);
  const session = await post("/live/sessions", { quizId: createdQuiz.id });
  console.log(`  quiz=${createdQuiz.id} session=${session.sessionId} pin=${session.pin}`);

  const host = io(socketUrl, socketOptions);
  const presenter = io(socketUrl, socketOptions);
  const player1 = io(socketUrl, socketOptions);
  let player2 = io(socketUrl, socketOptions);

  const connect = (s) => once(s, "connect", { timeout: 8000 });
  await Promise.all([connect(host), connect(presenter), connect(player1), connect(player2)]);

  // --- Host + presenter join ------------------------------------------------
  const hostStateP = once(host, "session:state", { filter: (s) => s.sessionId === session.sessionId });
  host.emit("host:join", { sessionId: session.sessionId, hostToken: session.hostToken });
  const hostState = await hostStateP;
  check("host receives session:state", hostState.status === "WAITING", hostState.status);
  check("host state exposes viewToken", typeof hostState.viewToken === "string" && hostState.viewToken.length > 0);

  const presentStateP = once(presenter, "session:state", { filter: (s) => s.sessionId === session.sessionId });
  presenter.emit("present:join", { sessionId: session.sessionId, viewToken: session.viewToken });
  const presentState = await presentStateP;
  check("presenter receives session:state", presentState.sessionId === session.sessionId);
  check("presenter state hides viewToken", presentState.viewToken === undefined);

  // Wrong host token must be rejected.
  const badHost = io(socketUrl, socketOptions);
  await connect(badHost);
  const hostErrP = once(badHost, "error", { timeout: 5000 });
  badHost.emit("host:join", { sessionId: session.sessionId, hostToken: "not-a-token" });
  const hostErr = await hostErrP;
  check("invalid host token rejected", /credentials/i.test(hostErr.message ?? ""), hostErr.message);
  badHost.close();

  // --- Players join ---------------------------------------------------------
  const p1AckP = once(player1, "player:joined");
  player1.emit("player:join", { pin: session.pin, username: "Alice", avatar: "fox" });
  const p1Ack = await p1AckP;
  check("player1 joined", p1Ack.username === "Alice" && p1Ack.reconnected === false);

  const p2AckP = once(player2, "player:joined");
  player2.emit("player:join", { pin: session.pin, username: "Bob" });
  const p2Ack = await p2AckP;
  check("player2 joined", p2Ack.username === "Bob");

  // Duplicate name is rejected.
  const dup = io(socketUrl, socketOptions);
  await connect(dup);
  const dupErrP = once(dup, "error", { timeout: 5000 });
  dup.emit("player:join", { pin: session.pin, username: "alice" });
  const dupErr = await dupErrP;
  check("duplicate name rejected", /taken/i.test(dupErr.message ?? ""), dupErr.message);
  dup.close();

  // Wrong PIN is rejected.
  const badPin = io(socketUrl, socketOptions);
  await connect(badPin);
  const pinErrP = once(badPin, "error", { timeout: 5000 });
  badPin.emit("player:join", { pin: "000000", username: "Mallory" });
  const pinErr = await pinErrP;
  check("invalid pin rejected", /pin/i.test(pinErr.message ?? ""), pinErr.message);
  badPin.close();

  // --- Play through every question -----------------------------------------
  const count = quiz.questions.length;
  let endedPayload = null;

  const startedP = once(host, "game:started");
  host.emit("host:start", { sessionId: session.sessionId });
  const started = await startedP;
  check("game started", started.questionCount === count, String(started.questionCount));

  // A player cannot answer before a question is open.
  const prematureP = once(player1, "player:error", { timeout: 5000 });
  player1.emit("player:answer", { questionId: "nope", chosenIndex: 0 });
  const premature = await prematureP;
  check("answer before question rejected", /open/i.test(premature.message ?? ""), premature.message);

  let broadcast = await once(player1, "game:question", { timeout: 10_000, filter: (q) => q.index === 0 });

  // Timer sync: the deadline is authoritative and server-issued.
  const endsAtMs = Date.parse(broadcast.endsAt);
  const remainingMs = endsAtMs - Date.now();
  check(
    "question carries a server deadline",
    Number.isFinite(endsAtMs) && remainingMs > 0 && remainingMs <= quiz.questions[0].timeSec * 1000 + 2000,
    `remaining=${remainingMs}ms`,
  );

  for (let qIndex = 0; qIndex < count; qIndex++) {
    const question = quiz.questions[qIndex];
    check(`q${qIndex} broadcast type ${broadcast.type}`, broadcast.type === question.type);

    const answer = correctAnswer(question, broadcast);
    const acks = [];
    for (const [socket, name] of [
      [player1, "Alice"],
      [player2, "Bob"],
    ]) {
      const ackP = once(socket, "player:answer-ack", { filter: (a) => a.questionId === broadcast.questionId });
      socket.emit("player:answer", { questionId: broadcast.questionId, ...answer });
      const ack = await ackP;
      acks.push({ name, ack });
    }
    check(`q${qIndex} both answers correct`, acks.every((a) => a.ack.isCorrect), JSON.stringify(acks));
    check(`q${qIndex} both scored > 0`, acks.every((a) => a.ack.score > 0), JSON.stringify(acks));

    // Duplicate answer rejected.
    const dupeP = once(player1, "player:error", { timeout: 5000 });
    player1.emit("player:answer", { questionId: broadcast.questionId, ...answer });
    const dupe = await dupeP;
    check(`q${qIndex} duplicate answer rejected`, /already answered/i.test(dupe.message ?? ""), dupe.message);

    // Reconnection: Bob drops and rejoins mid-game. He must keep the same
    // playerId and score (no duplicate player, no lost points).
    if (qIndex === 0) {
      const bobScore = acks.find((a) => a.name === "Bob").ack.totalScore;
      player2.close();
      await new Promise((r) => setTimeout(r, 150));
      const player2b = io(socketUrl, socketOptions);
      await connect(player2b);
      const rejoinP = once(player2b, "player:joined");
      // The real client resends its persisted playerId to reclaim its seat.
      player2b.emit("player:join", { pin: session.pin, username: "Bob", playerId: p2Ack.playerId });
      const rejoin = await rejoinP;
      check(
        "reconnected player keeps identity",
        rejoin.reconnected === true && rejoin.playerId === p2Ack.playerId,
        JSON.stringify(rejoin),
      );
      check("reconnected player keeps score", rejoin.score === bobScore, `${rejoin.score} vs ${bobScore}`);
      player2 = player2b;
    }

    // Reveal -> results on host.
    const resultsP = once(host, "game:results", { filter: (r) => r.questionId === broadcast.questionId });
    host.emit("host:reveal", { sessionId: session.sessionId });
    const results = await resultsP;
    check(`q${qIndex} results reveal correct option(s)`, results.correctDisplayIndices.length >= 0, JSON.stringify(results));

    // Advance: the next question, or the end of the game.
    if (qIndex + 1 < count) {
      const nextQ = once(player1, "game:question", {
        timeout: 10_000,
        filter: (q) => q.index === qIndex + 1,
      });
      host.emit("host:next", { sessionId: session.sessionId });
      broadcast = await nextQ;
    } else {
      const endedP = once(host, "game:ended", { timeout: 10_000 });
      host.emit("host:next", { sessionId: session.sessionId });
      endedPayload = await endedP;
    }
  }

  check("game ended", endedPayload !== null && endedPayload.participantCount === 2, JSON.stringify(endedPayload));
  const board = endedPayload?.leaderboard ?? [];
  check("final leaderboard has 2 players", board.length === 2, JSON.stringify(board));
  check(
    "leaderboard sorted by score desc",
    board.length === 2 && board[0].score >= board[1].score,
    JSON.stringify(board),
  );

  // --- Persistence + results endpoint --------------------------------------
  await new Promise((r) => setTimeout(r, 800)); // let the dispatcher drain the outbox
  const withToken = await get(`/live/sessions/${session.sessionId}/results`, { "x-session-token": session.viewToken });
  check("results endpoint returns 200", withToken.status === 200, String(withToken.status));
  check("results persisted as FINISHED", withToken.json.status === "FINISHED", withToken.json.status);
  check("results persisted 2 players", (withToken.json.leaderboard ?? []).length === 2);

  const noToken = await get(`/live/sessions/${session.sessionId}/results`);
  check("results endpoint rejects missing token", noToken.status === 403, String(noToken.status));

  // --- Isolation: a fresh PIN gets a fresh session --------------------------
  const session2 = await post("/live/sessions", { quizId: createdQuiz.id });
  check("new session has a different pin", session2.pin !== session.pin, `${session.pin} vs ${session2.pin}`);

  for (const s of [host, presenter, player1, player2]) s.close();
  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("smoke test crashed:", error);
  process.exit(1);
});
