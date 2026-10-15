import { useEffect, useState } from "react";
import { resolveMediaUrl } from "../lib/media";
import { listMedia, type MediaAsset } from "../lib/media";

export interface MediaPickerProps {
  open: boolean;
  tenantId?: string | null;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
  onDelete?: (asset: MediaAsset) => void;
}

/** Picker/reuse gallery for previously uploaded media. */
export function MediaPicker({ open, tenantId, onClose, onSelect, onDelete }: MediaPickerProps) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    listMedia((tenantId ?? undefined) as any)
      .then((data) => setAssets(data))
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo cargar las imágenes"))
      .finally(() => setLoading(false));
  }, [open, tenantId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="flex w-full max-w-4xl flex-col gap-4 rounded-2xl border border-border bg-[var(--color-surface)] p-6 text-ink">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Seleccionar imagen</h2>
          <button onClick={onClose} className="text-sm text-ink-muted transition-colors hover:text-ink">
            Cerrar
          </button>
        </header>

        {loading && <p className="text-sm text-ink-muted">Cargando…</p>}
        {error && <p className="rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger-readable">{error}</p>}

        <div className="grid grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
          {assets.length === 0 && !loading && (
            <p className="col-span-full text-sm text-ink-soft">Aún no has subido imágenes.</p>
          )}
          {assets.map((asset) => {
            const url = resolveMediaUrl(`/api/v1/media/${asset.id}`);
            return (
              <div key={asset.id} className="game-inset flex flex-col rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    onSelect(asset);
                    onClose();
                  }}
                  className="block"
                >
                  <img src={url ?? ''} alt="" className="h-32 w-full rounded-t-xl object-cover" />
                </button>
                <div className="flex items-center justify-between px-2 py-2 text-xs text-ink-muted">
                  <span className="truncate">{asset.id.slice(0, 8)}…</span>
                  {onDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(asset);
                      }}
                      className="text-danger-readable hover:brightness-110"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
