#!/usr/bin/env node
/**
 * Live-session load test.
 *
 * Spins up a host and N players on a freshly created session, plays a short
 * quiz to completion, and reports latency/throughput for the realtime path:
 *   - connection + join time for N players
 *   - per-answer round-trip ack latency (avg / p95 / max)
 *   - time for the last player to answer each question
 *   - errors observed, and that results persisted for every player
 *
 * Usage:
 *   node scripts/load-test.mjs [apiBase] [socketUrl] [socketPath] [counts]
 *   node scripts/load-test.mjs http://localhost:8080/sat/api/v1 http://localhost:8080 /sat/socket.io 20,50,100
 */
import { io } from "socket.io-client";
import { bearer, getToken } from "./lib/auth.mjs";

const apiBase = (process.argv[2] ?? "http://localhost:4100/api/v1").replace(/\/$/, "");
// Socket.IO origin: the HTTP origin only (see smoke-live.mjs for the rationale).
const socketUrl = process.argv[3] ?? new URL(apiBase).origin;
const socketPath =
  process.argv[4] ?? (apiBase.includes("/sat") ? "/sat/socket.io" : "/socket.io");
const counts = (process.argv[5] ?? "20,50,100")
  .split(",")
  .map((value) => Number.parseInt(value.trim(), 10))
  .filter((value) => Number.isFinite(value) && value > 0);

const socketOptions = { transports: ["websocket"], path: socketPath };

let TOKEN = null;

const quiz = {
  title: "Load Test Quiz",
  questions: [
    { type: "multiple_choice", text: "Q1", options: ["a", "b", "c", "d"], correctIndex: 0, timeSec: 30 },
    { type: "multiple_choice", text: "Q2", options: ["a", "b", "c", "d"], correctIndex: 2, timeSec: 30 },
    { type: "multiple_choice", text: "Q3", options: ["a", "b", "c", "d"], correctIndex: 1, timeSec: 30 },
  ],
};

async function post(path, body) {
  const res = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...bearer(TOKEN) },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

function connect(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("connect timeout")), 15_000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function once(socket, event, { timeout = 60_000, filter = () => true } = {}) {
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

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

async function runCount(playerCount) {
  const created = await post("/live/quizzes", quiz);
  const session = await post("/live/sessions", { quizId: created.id });
  const stats = { connectMs: 0, joinMs: 0, ackLatencies: [], perQuestionMs: [], errors: 0 };

  const host = io(socketUrl, socketOptions);
  const players = Array.from({ length: playerCount }, () => io(socketUrl, socketOptions));

  const t0 = Date.now();
  await Promise.all([connect(host), ...players.map(connect)]);
  stats.connectMs = Date.now() - t0;

  host.emit("host:join", { sessionId: session.sessionId, hostToken: session.hostToken });
  await once(host, "session:state", { filter: (s) => s.sessionId === session.sessionId });

  const t1 = Date.now();
  const joinAcks = players.map((socket, index) =>
    new Promise((resolve, reject) => {
      const name = `Player${index}`;
      const timer = setTimeout(() => reject(new Error(`join timeout ${name}`)), 20_000);
      const cleanup = () => {
        socket.off("player:joined", onJoined);
        socket.off("error", onError);
      };
      const onJoined = () => {
        clearTimeout(timer);
        cleanup();
        resolve();
      };
      const onError = (payload) => {
        clearTimeout(timer);
        cleanup();
        stats.errors++;
        reject(new Error(`${name}: ${payload?.message}`));
      };
      socket.on("player:joined", onJoined);
      socket.on("error", onError);
      socket.emit("player:join", { pin: session.pin, username: name, avatar: "shield" });
    }),
  );
  await Promise.all(joinAcks);
  stats.joinMs = Date.now() - t1;

  // Auto-answer whenever a question is broadcast, recording ack latency.
  players.forEach((socket) => {
    socket.on("game:question", (payload) => {
      const startedAt = Date.now();
      socket.emit("player:answer", { questionId: payload.questionId, chosenIndex: 0 });
      socket.once("player:answer-ack", (ack) => {
        if (ack?.questionId === payload.questionId) {
          stats.ackLatencies.push(Date.now() - startedAt);
        }
      });
      socket.once("player:error", () => {
        stats.errors++;
      });
    });
  });

  const started = once(host, "game:started");
  host.emit("host:start", { sessionId: session.sessionId });
  await started;

  const questionCount = quiz.questions.length;
  let broadcast = await once(host, "game:question", {
    filter: (q) => q.index === 0,
    timeout: 30_000,
  });
  for (let index = 0; index < questionCount; index++) {
    const qStart = Date.now();
    console.log(`  [q${index}] open (${broadcast.questionId}) — waiting for ${playerCount} answers…`);
    // Wait until every player's answer has been counted by the server.
    await once(host, "game:answer-count", {
      filter: (payload) => payload.answeredCount === playerCount,
      timeout: 30_000,
    });
    stats.perQuestionMs.push(Date.now() - qStart);
    console.log(`  [q${index}] all answered in ${Date.now() - qStart} ms`);

    const revealed = once(host, "game:results", { filter: (r) => r.questionId, timeout: 10_000 });
    host.emit("host:reveal", { sessionId: session.sessionId });
    await revealed;

    if (index + 1 < questionCount) {
      const next = once(host, "game:question", { filter: (q) => q.index === index + 1, timeout: 30_000 });
      host.emit("host:next", { sessionId: session.sessionId });
      broadcast = await next;
    } else {
      const ended = once(host, "game:ended", { timeout: 15_000 });
      host.emit("host:next", { sessionId: session.sessionId });
      const final = await ended;
      stats.finishedPlayers = final.leaderboard.length;
    }
  }

  for (const socket of players) socket.close();
  host.close();

  const avg = stats.ackLatencies.length
    ? Math.round(stats.ackLatencies.reduce((a, b) => a + b, 0) / stats.ackLatencies.length)
    : 0;

  console.log(`\n=== ${playerCount} players ===`);
  console.log(`  connect all         : ${stats.connectMs} ms`);
  console.log(`  join all            : ${stats.joinMs} ms`);
  console.log(`  answer ack latency  : avg ${avg} ms · p95 ${percentile(stats.ackLatencies, 95)} ms · max ${stats.ackLatencies.length ? Math.max(...stats.ackLatencies) : 0} ms (${stats.ackLatencies.length} samples)`);
  console.log(`  per-question (all replied): ${stats.perQuestionMs.join(" ms, ")} ms`);
  console.log(`  players in final board: ${stats.finishedPlayers ?? 0}/${playerCount}`);
  console.log(`  errors              : ${stats.errors}`);

  return { playerCount, ...stats, avgAckMs: avg };
}

async function main() {
  console.log(`Load test -> ${apiBase} (socket path ${socketPath})`);
  console.log(`Player counts: ${counts.join(", ")}`);
  TOKEN = await getToken(apiBase);
  const summary = [];
  for (const count of counts) {
    // eslint-disable-next-line no-await-in-loop
    summary.push(await runCount(count));
  }
  console.log("\n=== summary ===");
  for (const row of summary) {
    console.log(
      `  ${String(row.playerCount).padStart(3)} players · connect ${row.connectMs}ms · join ${row.joinMs}ms · avg ack ${row.avgAckMs}ms · errors ${row.errors} · finished ${row.finishedPlayers ?? 0}`,
    );
  }
}

main().catch((error) => {
  console.error("load test crashed:", error);
  process.exit(1);
});
