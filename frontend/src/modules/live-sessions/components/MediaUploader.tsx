import { useRef, useState } from "react";
import { resolveMediaUrl, optimizeImage, uploadMedia } from "../lib/media";
import type { MediaAsset } from "../lib/media";

export interface MediaUploaderProps {
  value: string | null | undefined;
  onChange: (url: string | null | undefined) => void;
  tenantId?: string | null;
  onUploaded?: (asset: MediaAsset) => void;
  maxMb?: number;
}

export function MediaUploader({ value, onChange, tenantId, onUploaded, maxMb = 5 }: MediaUploaderProps) {
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0]!;
    setError(null);
    setUploading(true);
    try {
      const optimized = await optimizeImage(file, { maxDim: 1600, quality: 0.82 });
      const asset = await uploadMedia(optimized, { tenantId: tenantId ?? undefined, purpose: "QUESTION" });
      onChange(resolveMediaUrl(`/api/v1/media/${asset.id}`));
      onUploaded?.(asset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`rounded-xl border-2 border-dashed p-4 transition ${
        drag ? "border-accent bg-accent/10" : "border-border bg-[var(--color-field)]"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />
      {value ? (
        <div className="flex flex-col items-center gap-3">
          <img src={value} alt="" className="max-h-48 w-full rounded-lg object-contain" />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-bold text-[#04211f] hover:brightness-110"
              disabled={uploading}
            >
              Reemplazar
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
            >
              Eliminar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
          <p className="font-semibold text-ink">Arrastra una imagen aquí o haz clic para subirla</p>
          <p className="text-xs text-ink-muted">JPG, PNG, WebP · Máx. {maxMb} MB</p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-[#04211f] hover:brightness-110"
            disabled={uploading}
          >
            {uploading ? "Subiendo…" : "Seleccionar imagen"}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-center text-sm text-danger-readable">{error}</p>}
    </div>
  );
}
