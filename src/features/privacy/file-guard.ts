/** NFILE.1 — MIME real por assinatura (magic bytes) e relatório de órfãos (só reporta). */
export type RealMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
export function sniffMime(b: Uint8Array): RealMime | null {
  const h = (i: number) => b[i];
  if (b.length >= 3 && h(0) === 0xff && h(1) === 0xd8 && h(2) === 0xff) return "image/jpeg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => h(i) === v)) return "image/png";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  if (b.length >= 5 && String.fromCharCode(...b.slice(0, 5)) === "%PDF-") return "application/pdf";
  return null;
}
/** Aceita só se a assinatura real bate com o declarado e está na lista do domínio; fail-closed. */
export function checkUpload(bytes: Uint8Array, declared: string, allowed: readonly RealMime[], maxBytes: number):
  { ok: true; mime: RealMime } | { ok: false; reason: "vazio" | "grande-demais" | "tipo-nao-permitido" | "tipo-divergente" } {
  if (bytes.length === 0) return { ok: false, reason: "vazio" };
  if (bytes.length > maxBytes) return { ok: false, reason: "grande-demais" };
  const real = sniffMime(bytes);
  if (!real || !allowed.includes(real)) return { ok: false, reason: "tipo-nao-permitido" };
  if (declared && declared !== real) return { ok: false, reason: "tipo-divergente" };
  return { ok: true, mime: real };
}
export interface StoredObject { bucket: string; path: string; createdAt: string }
export interface OrphanFinding { bucket: string; path: string; kind: "sem-referencia" | "rascunho-abandonado"; safeToClean: boolean }
/** Só reporta. Limpeza segura só para caminhos de rascunho (`drafts/`) sem referência e mais velhos que o prazo; referência histórica nunca é órfã. */
export function orphanReport(objects: StoredObject[], referenced: Set<string>, now: Date, draftMaxAgeDays: number): OrphanFinding[] {
  const limit = now.getTime() - draftMaxAgeDays * 86_400_000;
  return objects.filter((o) => !referenced.has(`${o.bucket}/${o.path}`)).map((o) => {
    const draft = /(^|\/)drafts\//.test(o.path) && Date.parse(o.createdAt) < limit;
    return { bucket: o.bucket, path: o.path, kind: draft ? "rascunho-abandonado" : "sem-referencia", safeToClean: draft };
  });
}
