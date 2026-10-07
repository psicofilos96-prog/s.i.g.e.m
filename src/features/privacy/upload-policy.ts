/**
 * NFILE.1.1 — política única de upload: todo arquivo passa por guardUpload antes de tocar o armazenamento.
 * Tipos permitidos e limite por área (bucket) são explícitos; MIME real por assinatura; fail-closed.
 */
import { checkUpload, type RealMime } from "./file-guard";

const MB = 1024 * 1024;
export const UPLOAD_POLICY = {
  "fotos-estudantes": { allowed: ["image/jpeg", "image/png", "image/webp"], maxBytes: 5 * MB },
  "inclusao-sensivel": { allowed: ["image/jpeg", "image/png", "image/webp", "application/pdf"], maxBytes: 10 * MB },
  "planejamento-docente": { allowed: ["image/jpeg", "image/png", "image/webp", "application/pdf"], maxBytes: 10 * MB },
  "avaliacao-docente": { allowed: ["image/jpeg", "image/png", "image/webp", "application/pdf"], maxBytes: 10 * MB },
  "alimentacao-evidencias": { allowed: ["image/jpeg", "image/png", "image/webp", "application/pdf"], maxBytes: 10 * MB },
} as const satisfies Record<string, { allowed: readonly RealMime[]; maxBytes: number }>;
export type UploadBucket = keyof typeof UPLOAD_POLICY;

export class UploadRefused extends Error {
  constructor(readonly reason: string) { super(`upload:${reason}`); }
}

/** Lança UploadRefused se vazio, grande, tipo fora da lista ou declarado ≠ real. Devolve o MIME real. */
export function guardUpload(bucket: UploadBucket, bytes: Uint8Array, declared: string): RealMime {
  const p = UPLOAD_POLICY[bucket];
  const r = checkUpload(bytes, declared, p.allowed, p.maxBytes);
  if (!r.ok) throw new UploadRefused(r.reason);
  return r.mime;
}

/** Rótulo exibível: sem caminho, sem controle, sem "..", até 160 caracteres. Nunca vira caminho. */
export function safeLabel(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").replace(/\.{2,}/g, ".").replace(/^\.+/, "").trim();
  return clean.slice(0, 160) || "arquivo";
}

/** Caminho só de segmentos gerados (uuid/ids); recusa traversal ou segmento vazio. */
export function assertSafePath(path: string): string {
  if (!path || path.split("/").some((s) => !s || s === "." || s === ".." || /[\\\u0000]/.test(s))) throw new UploadRefused("caminho-invalido");
  return path;
}

export const UPLOAD_REFUSAL_TEXT: Record<string, string> = {
  vazio: "O arquivo está vazio.",
  "grande-demais": "O arquivo passa do tamanho permitido.",
  "tipo-nao-permitido": "Tipo de arquivo não aceito. Use JPG, PNG, WEBP ou PDF quando permitido.",
  "tipo-divergente": "O conteúdo do arquivo não corresponde ao tipo informado.",
  "caminho-invalido": "Não foi possível guardar o arquivo.",
};
export function uploadRefusalText(e: unknown): string | null {
  const m = /upload:([a-z-]+)/.exec(String((e as Error)?.message ?? e));
  return m ? UPLOAD_REFUSAL_TEXT[m[1]!] ?? null : null;
}
