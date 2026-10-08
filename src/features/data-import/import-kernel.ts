/**
 * NIMPORT.2 — núcleo comum de importações. PURO e sem regra de domínio:
 * hash/impressão digital, chave de idempotência, leitura segura de arquivo, contagem,
 * duplicidade na fonte, relatório de exceções, plano de compensação e proveniência.
 * Cada domínio (escolas, alunos, turmas, profissionais, Censo, avaliações, pré-importação)
 * mantém validação, matching e writer próprios; este módulo só oferece as primitivas.
 */

/** FNV-1a 32 bits em hex — determinístico, sem dependência de runtime (prova de reexecução). */
export function stableHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

export async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const d = await crypto.subtle.digest("SHA-256", buf as BufferSource);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Chave canônica `adaptador@versão:sha256DaFonte:chave` — mesma fonte e linha ⇒ mesma chave. */
export function idempotencyKey(adapter: string, version: number, sourceSha256: string, key: string): string {
  return `${adapter}@${version}:${sourceSha256}:${key}`;
}

export type Provenance = Readonly<{ adapter: string; version: number; sourceName: string; sourceSha256: string; locator: string }>;
export const provenanceLabel = (p: Provenance) => `${p.sourceName} (${p.adapter}@${p.version}, sha256 ${p.sourceSha256.slice(0, 12)}…) — ${p.locator}`;

/** Arquivo inválido nunca vira lote vazio: falha de leitura é resultado explícito. */
export type FileReadResult<T> = Readonly<{ ok: true; rows: T[] } | { ok: false; code: "arquivo-vazio" | "arquivo-ilegivel"; message: string }>;
export function readFileSafely<T>(text: string, parse: (t: string) => T[]): FileReadResult<T> {
  if (!text || !text.trim()) return { ok: false, code: "arquivo-vazio", message: "O arquivo está vazio." };
  try {
    const rows = parse(text);
    if (!rows.length) return { ok: false, code: "arquivo-vazio", message: "O arquivo não tem linhas de dados reconhecíveis." };
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, code: "arquivo-ilegivel", message: `O arquivo não pôde ser lido: ${String((e as Error)?.message ?? e)}` };
  }
}

/** Conta ocorrências de uma chave (vazio é ignorado) — base de "duplicada na fonte". */
export function keyCounts(keys: ReadonlyArray<string | null | undefined>): Map<string, number> {
  const c = new Map<string, number>();
  for (const k of keys) { const t = k == null ? "" : String(k).trim(); if (t) c.set(t, (c.get(t) ?? 0) + 1); }
  return c;
}

export function countBy<T, K extends string>(rows: readonly T[], key: (r: T) => K, zero: readonly K[] = []): Record<K, number> {
  const out = Object.fromEntries(zero.map((k) => [k, 0])) as Record<K, number>;
  for (const r of rows) { const k = key(r); out[k] = (out[k] ?? 0) + 1; }
  return out;
}

/** Relatório de exceções: toda linha não aceita, com motivos; nunca some do resultado. */
export type ExceptionRow = Readonly<{ locator: string; outcome: string; reasons: string }>;
export function exceptionReport<T>(rows: readonly T[], view: (r: T) => { locator: string; outcome: string; reasons: readonly string[] }, accepted: readonly string[]): ExceptionRow[] {
  return rows.map(view).filter((r) => !accepted.includes(r.outcome))
    .map((r) => ({ locator: r.locator, outcome: r.outcome, reasons: r.reasons.join("; ") || "sem motivo informado" }));
}

const csvCell = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
/** CSV pt-BR (separador `;`, BOM UTF-8) do relatório de exceções. */
export function exceptionReportCsv(rows: readonly ExceptionRow[]): string {
  const lines = ["Linha;Resultado;Motivos", ...rows.map((r) => [r.locator, r.outcome, r.reasons].map(csvCell).join(";"))];
  return "\uFEFF" + lines.join("\r\n");
}

/**
 * Rollback = compensação: só linhas aplicadas e ainda não compensadas, cada uma pelo writer do domínio.
 * Nada é apagado; fato aplicado continua no histórico.
 */
export function compensationPlan<E extends { row_id: string | null; kind: string }>(events: readonly E[]): string[] {
  const applied = new Set<string>(), compensated = new Set<string>();
  for (const e of events) {
    if (!e.row_id) continue;
    if (e.kind === "aplicada") applied.add(e.row_id);
    if (e.kind === "compensacao") compensated.add(e.row_id);
  }
  return [...applied].filter((id) => !compensated.has(id)).sort();
}
