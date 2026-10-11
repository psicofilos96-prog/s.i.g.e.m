/**
 * SIA.READ.1 — regras puras da conferência de cartão: QR prova+versão, confiança por resposta,
 * estado por questão (não lida ≠ errada), discursiva com nota manual e pontuação pelos pesos da versão.
 * Espelha `record_sia_card_correction_v2`; o banco recalcula e é quem decide.
 */
import type { QuestionRead } from "./answer-card";
import type { VariantMap } from "./variant-key";

/** QR do cartão: só ids técnicos da versão aprovada e a letra; nunca dado do estudante. */
export const qrPayload = (instrumentVersionId: string, letter: string) => `sia1:${instrumentVersionId}:${letter || "O"}`;
export function parseQr(raw: string): { instrumentVersionId: string; letter: string } | null {
  const m = /^sia1:([0-9a-f-]{36}):([A-HO])$/.exec(raw.trim());
  return m ? { instrumentVersionId: m[1]!, letter: m[2] === "O" ? "" : m[2]! } : null;
}

/** Confiança 0–1: distância entre a bolha mais escura e a segunda; leitura ambígua/múltipla nunca passa de 0,5. */
export function readConfidence(r: QuestionRead): number {
  const v = Object.values(r.fill).sort((a, b) => b - a);
  if (!v.length) return 0;
  const top = v[0]!, second = v[1] ?? 0;
  const base = r.state === "em-branco" ? 1 - top / 0.45 : Math.min(1, (top - second) / 0.5);
  const c = Math.max(0, Math.min(1, base));
  return Math.round((r.state === "ambigua" || r.state === "multipla" ? Math.min(c, 0.5) : c) * 100) / 100;
}

export type LineStatus = "certa" | "errada" | "em-branco" | "nao-lida" | "anulada" | "pontuada";
export type HumanDecision = { option?: string | null; status?: "anulada" | "nao-lida"; points?: number };
export type ScoredLine = { number: number; itemVersionId: string; answered: string | null; status: LineStatus | null; points?: number; confidence: number | null; reason: string | null };

/**
 * `reads` nulo = foto não lida: toda objetiva fica "não lida" até decisão humana.
 * Objetiva sem gabarito, ambígua ou múltipla exige decisão; discursiva exige pontos.
 */
export function scoreLines(map: VariantMap, keys: ReadonlyMap<string, string>, reads: readonly QuestionRead[] | null, dec: Readonly<Record<number, HumanDecision>>, objective: ReadonlySet<string>): ScoredLine[] {
  return map.entries.map((e) => {
    const d = dec[e.number]; const base = { number: e.number, itemVersionId: e.itemVersionId };
    if (d?.status) return { ...base, answered: null, status: d.status, confidence: null, reason: "decisão humana" };
    if (!objective.has(e.itemVersionId)) {
      return d?.points !== undefined ? { ...base, answered: null, status: "pontuada", points: d.points, confidence: null, reason: "nota manual" }
        : { ...base, answered: null, status: null, confidence: null, reason: "Discursiva: informe a nota" };
    }
    const r = reads?.find((x) => x.question === e.number) ?? null;
    const human = d && "option" in d;
    if (!human && (!r || !reads)) return { ...base, answered: null, status: "nao-lida", confidence: null, reason: "Foto não lida" };
    if (!human && (r!.state === "ambigua" || r!.state === "multipla")) return { ...base, answered: null, status: null, confidence: readConfidence(r!), reason: r!.state === "multipla" ? "Dupla marcação — decidir" : "Rasura/marca fraca — decidir" };
    const ans = human ? d!.option ?? null : r!.option;
    const conf = human ? null : readConfidence(r!);
    if (!ans) return { ...base, answered: null, status: "em-branco", confidence: conf, reason: null };
    const ck = keys.get(e.itemVersionId); const canon = e.displayToKey[ans.toUpperCase()];
    if (!ck) return { ...base, answered: ans, status: null, confidence: conf, reason: "Sem gabarito — decidir" };
    if (!canon) return { ...base, answered: ans, status: null, confidence: conf, reason: "Alternativa inexistente" };
    return { ...base, answered: ans, status: canon === ck ? "certa" : "errada", confidence: conf, reason: null };
  });
}

/** Mesma conta do banco: anulada sai do máximo; não lida impede nota; peso ausente impede nota (nunca vira 1). */
export function scoreSummary(lines: readonly ScoredLine[], weights: ReadonlyMap<string, number | null>) {
  const pending = lines.filter((l) => l.status === null).map((l) => l.number);
  const unread = lines.filter((l) => l.status === "nao-lida").length;
  let score = 0, max = 0, missing = false, badPoints = false;
  for (const l of lines) {
    if (l.status === "nao-lida" || l.status === "anulada" || l.status === null) continue;
    const w = weights.get(l.itemVersionId) ?? null; if (w === null) missing = true; max += w ?? 0;
    if (l.status === "certa") score += w ?? 0;
    if (l.status === "pontuada") { if (w === null || l.points! < 0 || l.points! > w) badPoints = true; else score += l.points!; }
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return { pending, unread, hits: lines.filter((l) => l.status === "certa").length, score: missing || unread || pending.length ? null : r2(score), max: missing ? null : r2(max), weightsMissing: missing, badPoints,
    canSave: pending.length === 0 && !badPoints, canLaunch: pending.length === 0 && !badPoints && unread === 0 && !missing };
}
export const toWire = (lines: readonly ScoredLine[]) => lines.map((l) => ({ number: l.number, itemVersionId: l.itemVersionId, answered: l.answered, status: l.status, ...(l.status === "pontuada" ? { points: l.points } : {}), confidence: l.confidence }));
