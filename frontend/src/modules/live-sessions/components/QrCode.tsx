import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * QR code for the join URL. Generated locally (no external service) so the
 * stack keeps working fully offline / air-gapped.
 */
export function QrCode({ value, size = 200 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { margin: 1, width: size, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-white text-xs text-slate-400"
        style={{ width: size, height: size }}
      >
        QR
      </div>
    );
  }
  return <img src={dataUrl} alt="Código QR para unirse" width={size} height={size} className="rounded-xl bg-white p-1" />;
}
