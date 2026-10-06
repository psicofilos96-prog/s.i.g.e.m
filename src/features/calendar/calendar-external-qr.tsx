/**
 * CAL.EXT.1.1 — QR code local e determinístico (qrcode-generator, MIT, sem rede). Só recebe URL https já
 * validada por `safeQrUrl`; a URL nunca é inventada. Mesmo SVG na prévia e na impressão.
 */
import qrcode from "qrcode-generator";

export function qrModules(value: string): boolean[][] {
  const q = qrcode(0, "M"); q.addData(value, "Byte"); q.make();
  const n = q.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));
}

export function QrCode({ value, sizeMm }: { value: string; sizeMm: number }) {
  const m = qrModules(value); const n = m.length; const q = 4; // zona de silêncio
  let d = "";
  m.forEach((row, r) => row.forEach((dark, c) => { if (dark) d += `M${c + q} ${r + q}h1v1h-1z`; }));
  return (
    <svg data-testid="cx-qr-svg" role="img" aria-label={`QR code para ${value}`} viewBox={`0 0 ${n + 2 * q} ${n + 2 * q}`}
      width={`${sizeMm}mm`} height={`${sizeMm}mm`} shapeRendering="crispEdges">
      <rect width="100%" height="100%" fill="#FFFFFF" /><path d={d} fill="#000000" />
    </svg>
  );
}
