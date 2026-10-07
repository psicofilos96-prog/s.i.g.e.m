/**
 * NCFG.2 — plano de pré-importação determinístico. PURO: não grava, não abre ano, não homologa.
 * Cada linha vira uma decisão proposta (ligar | criar-candidato | rejeitar-*) com chave de idempotência
 * `adapter@versão:sha256DaFonte:chave`. Nada daqui é oficializado; a aplicação futura passa pelos writers canônicos.
 */
export type PlanAction = "ligar" | "criar-candidato" | "rejeitar-sem-chave" | "rejeitar-duplicado";
export type PlanRow = { key: string; action: PlanAction; idempotencyKey: string | null; existingId: string | null };

export function buildPreimportPlan(input: {
  adapter: string; version: number; sourceSha256: string;
  keys: ReadonlyArray<string | null | undefined>;
  existing: ReadonlyMap<string, string>;
}): PlanRow[] {
  const clean = input.keys.map((k) => (k == null ? "" : String(k).trim()));
  const count = new Map<string, number>();
  for (const k of clean) if (k) count.set(k, (count.get(k) ?? 0) + 1);
  const out: PlanRow[] = [];
  let missing = 0;
  for (const k of [...new Set(clean)].sort()) {
    if (!k) continue;
    const idem = `${input.adapter}@${input.version}:${input.sourceSha256}:${k}`;
    if ((count.get(k) ?? 0) > 1) { out.push({ key: k, action: "rejeitar-duplicado", idempotencyKey: null, existingId: null }); continue; }
    const ex = input.existing.get(k) ?? null;
    out.push({ key: k, action: ex ? "ligar" : "criar-candidato", idempotencyKey: idem, existingId: ex });
  }
  missing = clean.filter((k) => !k).length;
  for (let i = 0; i < missing; i++) out.push({ key: "", action: "rejeitar-sem-chave", idempotencyKey: null, existingId: null });
  return out;
}

export function planSummary(rows: readonly PlanRow[]): Record<PlanAction, number> {
  const s: Record<PlanAction, number> = { ligar: 0, "criar-candidato": 0, "rejeitar-sem-chave": 0, "rejeitar-duplicado": 0 };
  for (const r of rows) s[r.action]++;
  return s;
}
