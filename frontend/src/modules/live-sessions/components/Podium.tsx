import { useEffect, useRef } from "react";
import type { PodiumEntry } from "../lib/protocol";
import { Avatar } from "./Avatar";
import { Confetti } from "./Confetti";
import { sound } from "../lib/sound";

const MEDALS = ["🥇", "🥈", "🥉"];
const PEDESTAL = ["h-44 sm:h-56", "h-32 sm:h-40", "h-24 sm:h-28"];
const PLACE_LABEL = ["1.º", "2.º", "3.º"];

/**
 * Final standings: a rising three-step podium (winner centre) plus the rest of
 * the ranking. Plays the fanfare once and rains confetti. Decorative and
 * animation-library-free.
 */
export function Podium({
  podium,
  leaderboard,
  playSound = true,
}: {
  podium: PodiumEntry[];
  leaderboard: PodiumEntry[];
  playSound?: boolean;
}) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!playSound || firedRef.current) return;
    firedRef.current = true;
    sound.stopMusic();
    sound.play("fanfare");
  }, [playSound]);

  const rest = leaderboard.slice(3);
  // Winner in the middle: 2nd, 1st, 3rd.
  const order = [podium[1], podium[0], podium[2]];

  return (
    <div className="relative space-y-8">
      <Confetti />

      <div className="relative flex items-end justify-center gap-3 sm:gap-6">
        {order.map((entry, position) => {
          if (!entry) return null;
          const placeIndex = position === 1 ? 0 : position === 0 ? 1 : 2;
          const isWinner = placeIndex === 0;
          return (
            <div
              key={entry.playerId}
              className="podium-rise flex w-24 flex-col items-center gap-2 sm:w-36"
              style={{ ["--i" as string]: placeIndex }}
            >
              <span className={isWinner ? "text-5xl" : "text-3xl"}>{MEDALS[placeIndex]}</span>
              <div className={isWinner ? "pulse-ring rounded-full" : ""}>
                <Avatar avatar={entry.avatar} size={isWinner ? "lg" : "md"} ring />
              </div>
              <div className="text-center">
                <p className={`truncate font-black text-white ${isWinner ? "text-lg sm:text-2xl" : "text-sm sm:text-base"}`}>
                  {entry.username}
                </p>
                <p className="text-sm font-bold tabular-nums text-amber-200 sm:text-lg">{entry.score} pts</p>
                <p className="text-[0.65rem] text-white/60 sm:text-xs">
                  {entry.correctAnswers}/{entry.totalAnswers} correctas
                </p>
              </div>
              <div
                className={`w-full rounded-t-xl ${PEDESTAL[placeIndex]} ${
                  isWinner
                    ? "bg-gradient-to-b from-amber-300 to-amber-500"
                    : placeIndex === 1
                      ? "bg-gradient-to-b from-slate-200 to-slate-400"
                      : "bg-gradient-to-b from-orange-300 to-orange-500"
                }`}
              >
                <span className="flex h-full items-start justify-center pt-2 text-2xl font-black text-black/50">
                  {PLACE_LABEL[placeIndex]}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <ol className="mx-auto max-w-md space-y-1">
          {rest.slice(0, 10).map((entry) => (
            <li key={entry.playerId} className="flex items-center gap-3 rounded-lg bg-white/10 px-3 py-1.5">
              <span className="w-6 text-center text-sm tabular-nums text-white/60">{entry.rank}</span>
              <Avatar avatar={entry.avatar} size="sm" />
              <span className="flex-1 truncate text-sm text-white">{entry.username}</span>
              <span className="text-sm font-semibold tabular-nums text-white">{entry.score}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
