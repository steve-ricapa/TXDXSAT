import { useState } from "react";
import { sound } from "../lib/sound";

/**
 * Mute toggle + volume slider.
 *
 * Browsers block audio until the first user gesture; the first interaction with
 * these controls both unlocks the AudioContext and (for the host/presenter)
 * starts the lobby music.
 */
export function SoundControls({ compact = false }: { compact?: boolean }) {
  const [muted, setMuted] = useState(sound.isMuted());
  const [volume, setVolume] = useState(sound.getVolume());
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          const next = !muted;
          sound.setMuted(next);
          setMuted(next);
        }}
        className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25"
        aria-label={muted ? "Activar sonido" : "Silenciar"}
        title={muted ? "Activar sonido" : "Silenciar"}
      >
        {muted ? "🔇" : "🔊"}
      </button>

      {!compact && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/25"
        >
          Volumen
        </button>
      )}

      {open && !compact && (
        <input
          type="range"
          min={5}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(event) => {
            const value = Number(event.target.value) / 100;
            sound.setVolume(value);
            setVolume(value);
          }}
          className="h-1.5 w-28 cursor-pointer appearance-none rounded-full bg-white/30 accent-white"
          aria-label="Volumen"
        />
      )}
    </div>
  );
}
