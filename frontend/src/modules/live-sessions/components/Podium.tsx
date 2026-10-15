import type { PodiumEntry } from "../lib/protocol";
import { Avatar } from "./Avatar";

const MEDALS = ["🥇", "🥈", "🥉"];

/** Final standings for the host/presenter end screen. */
export function Podium({ podium, leaderboard }: { podium: PodiumEntry[]; leaderboard: PodiumEntry[] }) {
  const rest = leaderboard.slice(3);
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-center gap-4">
        {podium.map((entry, index) => (
          <div key={entry.playerId} className="flex w-28 flex-col items-center gap-2">
            <span className="text-3xl">{MEDALS[index] ?? "🎖️"}</span>
            <Avatar avatar={entry.avatar} size="lg" ring />
            <div className="text-center">
              <p className="truncate font-semibold text-white">{entry.username}</p>
              <p className="text-sm tabular-nums text-white/70">{entry.score} pts</p>
              <p className="text-xs text-white/50">
                {entry.correctAnswers}/{entry.totalAnswers} correctas
              </p>
            </div>
          </div>
        ))}
      </div>

      {rest.length > 0 && (
        <ol className="mx-auto max-w-md space-y-1">
          {rest.map((entry) => (
            <li key={entry.playerId} className="flex items-center gap-3 rounded-lg bg-white/10 px-3 py-1.5">
              <span className="w-6 text-center text-sm tabular-nums text-white/60">{entry.rank}</span>
              <span className="flex-1 truncate text-sm text-white">{entry.username}</span>
              <span className="text-sm font-semibold tabular-nums text-white">{entry.score}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
