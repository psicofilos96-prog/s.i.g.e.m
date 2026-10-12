// Matrículas L13 — classificação determinística e versionada (migration 0465).
// Reusa o motor canônico `distribution-engine` (primitivas, desempates declarados, empate remanescente nunca decidido).
// Entradas viram snapshot canônico (chaves ordenadas, pedidos por protocolo); o banco recalcula os hashes do texto enviado.
// Simulação é isolada: modo 'simulacao' nunca produz efeito; nada aqui contempla vaga, reserva ou matrícula.
import { supabase } from "@/integrations/supabase/client";
import { proposeDistribution, type CellSlots, type CriterionRule, type Proposal, type RequestInput } from "./distribution-engine";

export const ENGINE_VERSION = "enr-class-1.0.0";

export type ApprovedCriteria = { id: string; campaignId: string; version: number; editalActVersionId: string; approved: boolean; rules: CriterionRule[]; tiebreaks: CriterionRule[] };
export type Snapshot = { criteriaId: string; criteriaVersion: number; editalActVersionId: string; takenAt: string; requests: RequestInput[]; cells: CellSlots[] };

/** JSON canônico: chaves ordenadas em todo nível, sem espaços. Mesmo dado ⇒ mesmo texto ⇒ mesmo hash. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}

export function buildSnapshot(c: ApprovedCriteria, requests: RequestInput[], cells: CellSlots[], takenAt: string): Snapshot {
  const reqs = [...requests].sort((a, b) => (a.protocol < b.protocol ? -1 : a.protocol > b.protocol ? 1 : 0));
  const cs = [...cells].sort((a, b) => (a.cellKey < b.cellKey ? -1 : 1));
  return { criteriaId: c.id, criteriaVersion: c.version, editalActVersionId: c.editalActVersionId, takenAt, requests: reqs, cells: cs };
}

export type RunResult = { items: Proposal["items"]; indeterminate: Proposal["indeterminate"]; unresolvedTies: Proposal["unresolvedTies"]; conflicts: string[]; engine: string };

/** Função pura sobre o snapshot: horário e autor vêm do snapshot, nunca do relógio, para reprocessar igual. */
export async function classify(c: ApprovedCriteria, s: Snapshot, opts: { mode: "simulacao" | "oficial" }): Promise<{ ok: true; result: RunResult } | { ok: false; reason: string }> {
  if (s.criteriaId !== c.id || s.criteriaVersion !== c.version) return { ok: false, reason: "Snapshot de outro critério." };
  // Simulação pode usar critério ainda não aprovado; oficial nunca.
  if (opts.mode === "oficial" && !c.approved) return { ok: false, reason: "Critério não aprovado: execução oficial recusada." };
  const r = await proposeDistribution({ criterionId: c.id, version: c.version, homologated: true, rules: c.rules, tiebreaks: c.tiebreaks }, s.requests, s.cells, { generatedBy: "snapshot", generatedAt: s.takenAt });
  if (!r.ok) return r;
  const p = r.proposal;
  return { ok: true, result: { items: p.items, indeterminate: p.indeterminate, unresolvedTies: p.unresolvedTies, conflicts: p.conflicts, engine: ENGINE_VERSION } };
}

/** Justificativa por pedido em português simples, a partir da explicação do motor. */
export function explain(item: Proposal["items"][number], rules: CriterionRule[]): string {
  const parts = item.explanation.map((e) => {
    const rule = rules.find((r) => r.factKey === e.factKey);
    return `${e.factKey} = ${String(e.value)} (${rule?.primitive ?? "desempate"}; fundamento: ${e.basis}; evidência: ${e.evidenceRef})`;
  });
  const end = item.outcome === "contemplado" ? `indicado à ${(item.preferenceIndex ?? 0) + 1}ª opção (proposta, não é vaga)` : "em espera";
  return `Posição ${item.position}: ${end}. ${parts.join("; ")}.`;
}

export async function recordRun(c: ApprovedCriteria, s: Snapshot, result: RunResult, mode: "simulacao" | "oficial", key: string, reprocessOf: string | null) {
  const { data, error } = await supabase.rpc("record_enr_classification_run", {
    _criteria: c.id, _mode: mode, _engine: ENGINE_VERSION, _snapshot_text: canonical(s), _result_text: canonical(result), _reprocess_of: reprocessOf as string, _key: key,
  });
  if (error) throw new Error(/sem-competencia/.test(error.message) ? "Sem competência para classificar." : /nao-aprovado/.test(error.message) ? "Critério não aprovado." : /entrada-diferente/.test(error.message) ? "Reprocessamento exige o mesmo snapshot." : "Não foi possível registrar.");
  return (data as { run_id: string; input_hash: string; result_hash: string; reprocess_matches: boolean | null }[])[0]!;
}
