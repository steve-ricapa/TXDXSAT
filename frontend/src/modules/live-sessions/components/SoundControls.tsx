import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
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
        className="game-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-accent/60"
        aria-label={muted ? "Activar sonido" : "Silenciar"}
        title={muted ? "Activar sonido" : "Silenciar"}
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      {!compact && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="game-chip rounded-full px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-accent/60 hover:text-ink"
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
          className="h-1.5 w-28 cursor-pointer appearance-none rounded-full bg-border accent-accent"
          aria-label="Volumen"
        />
      )}
    </div>
  );
}
