import { Avatar } from "./Avatar";

export interface LeaderboardRow {
  rank: number;
  playerId: string;
  username: string;
  avatar: string;
  score: number;
}

export function Leaderboard({
  entries,
  highlightPlayerId,
  compact = false,
}: {
  entries: LeaderboardRow[];
  highlightPlayerId?: string | undefined;
  compact?: boolean;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-white/50">Aún no hay jugadores.</p>;
  }
  const shown = compact ? entries.slice(0, 5) : entries;
  return (
    <ol className="space-y-1.5">
      {shown.map((entry) => (
        <li
          key={entry.playerId}
          className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
            entry.playerId === highlightPlayerId ? "bg-white/25 ring-2 ring-white/50" : "bg-white/10"
          }`}
        >
          <span className="w-6 text-center text-sm font-bold tabular-nums text-white/70">{entry.rank}</span>
          <Avatar avatar={entry.avatar} size="sm" />
          <span className="flex-1 truncate font-medium text-white">{entry.username}</span>
          <span className="font-bold tabular-nums text-white">{entry.score}</span>
        </li>
      ))}
    </ol>
  );
}
