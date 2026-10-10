/**
 * LOTE 6/14 — Conciliação assistida: registros administrativos de pessoal 2026 × pessoas do Censo.
 * A correspondência nominal (staff_reconciliation_candidates) é só SUGESTÃO; confirmação é decisão
 * humana gravada só por `record_staff_reconciliation_decision` (capability `conciliar-pessoal-administrativo`,
 * evidência obrigatória, base esperada, append-only). Confirmar nunca cria vínculo, lotação, atuação ou acesso.
 */
import { supabase } from "@/integrations/supabase/client";
import { readPages } from "@/lib/list-paging";
import { neutralize } from "@/features/reports/report-engine";

export type ReconGroup = "confirmado" | "sugestao" | "ambiguo" | "sem-correspondencia" | "pendente-de-chave";
export const GROUP_LABEL: Record<ReconGroup, string> = {
  confirmado: "Confirmado", sugestao: "Sugestão a conferir", ambiguo: "Ambíguo",
  "sem-correspondencia": "Sem correspondência", "pendente-de-chave": "Pendente de chave",
};

export type ReconRecord = { id: string; full_name: string; school_name_source: string | null; sector: string | null; cargo: string | null; funcao: string | null; sheet: string; row_no: number; source_kind: string };
export type ReconCandidate = { staff_record_id: string; outcome: string; candidate_person_id: string | null; rule: string };
export type ReconDecision = { id: string; staff_record_id: string; decision: "confirmado" | "rejeitado" | "pendente-de-chave"; person_id: string | null; supersedes_id: string | null; decided_at: string };
export type ReconItem = Readonly<{ record: ReconRecord; group: ReconGroup; suggestedPersonId: string | null; rule: string | null; head: ReconDecision | null; competingRecords: number }>;

/** Cabeça da cadeia = decisão sem sucessora. */
export function decisionHeads(ds: readonly ReconDecision[]): Map<string, ReconDecision> {
  const superseded = new Set(ds.map((d) => d.supersedes_id).filter(Boolean));
  const m = new Map<string, ReconDecision>();
  for (const d of ds) if (!superseded.has(d.id)) m.set(d.staff_record_id, d);
  return m;
}

export function classify(records: readonly ReconRecord[], cands: readonly ReconCandidate[], decisions: readonly ReconDecision[]): ReconItem[] {
  const byRec = new Map(cands.map((c) => [c.staff_record_id, c]));
  const heads = decisionHeads(decisions);
  const perPerson = new Map<string, number>();
  for (const c of cands) if (c.outcome === "candidato-unico" && c.candidate_person_id) perPerson.set(c.candidate_person_id, (perPerson.get(c.candidate_person_id) ?? 0) + 1);
  return records.map((record) => {
    const c = byRec.get(record.id) ?? null; const head = heads.get(record.id) ?? null;
    const suggested = c?.outcome === "candidato-unico" ? c.candidate_person_id : null;
    const competing = suggested ? (perPerson.get(suggested) ?? 0) : 0;
    let group: ReconGroup;
    if (head?.decision === "confirmado") group = "confirmado";
    else if (head?.decision === "pendente-de-chave") group = "pendente-de-chave";
    else if (head?.decision === "rejeitado" || !suggested) group = "sem-correspondencia";
    else group = competing > 1 ? "ambiguo" : "sugestao";
    return { record, group, suggestedPersonId: suggested, rule: c?.rule ?? null, head, competingRecords: competing };
  });
}

export function groupCounts(items: readonly ReconItem[]): Record<ReconGroup, number> {
  const out: Record<ReconGroup, number> = { confirmado: 0, sugestao: 0, ambiguo: 0, "sem-correspondencia": 0, "pendente-de-chave": 0 };
  for (const i of items) out[i.group]++;
  return out;
}

/** Pendências sem CPF, matrícula funcional, vínculo, situação ou ids técnicos: só o necessário para conferir. */
export const EXPORT_COLUMNS = ["Situação da conciliação", "Nome na planilha", "Escola/setor", "Cargo", "Função", "Aba", "Linha"] as const;
const PENDING_DEF: ReportDefinition = {
  id: "conciliacao-pendencias", version: 1, title: "Conciliação de pessoal — pendências", description: "Pendências sem CPF nem ids técnicos.", source: "staff_reconciliation (projeção)", params: [],
  columns: EXPORT_COLUMNS.map((label, i) => ({ id: `c${i}`, label, kind: "text" as const })), formats: ["csv"], reproducible: false, syncRowLimit: 10000,
};
/** Sai pelo motor comum (toCsv: neutralização de fórmula, ausência = "não disponível"). */
export function pendingCsv(items: readonly ReconItem[]): string {
  const rows = items.filter((i) => i.group !== "confirmado").map((i) => Object.fromEntries([GROUP_LABEL[i.group], i.record.full_name, i.record.school_name_source ?? i.record.sector, i.record.cargo, i.record.funcao, i.record.sheet, i.record.row_no].map((v, k) => [`c${k}`, v ?? null])) as Record<string, CellValue>);
  return toCsv(runReport(PENDING_DEF, { params: {} }, rows), { headerLines: ["SIGEM"], title: PENDING_DEF.title });
}

export async function loadReconciliation(signal?: AbortSignal) {
  const sig = <T extends { abortSignal: (s: AbortSignal) => T }>(b: T) => (signal ? b.abortSignal(signal) : b);
  const [r, c, d] = await Promise.all([
    readPages<ReconRecord>((f, t) => sig(supabase.from("staff_administrative_records").select("id, full_name, school_name_source, sector, cargo, funcao, sheet, row_no, source_kind").order("id").range(f, t)) as never, 5000),
    readPages<ReconCandidate>((f, t) => sig(supabase.from("staff_reconciliation_candidates").select("staff_record_id, outcome, candidate_person_id, rule").order("id").range(f, t)) as never, 5000),
    readPages<ReconDecision>((f, t) => sig(supabase.from("staff_reconciliation_decisions").select("id, staff_record_id, decision, person_id, supersedes_id, decided_at").order("decided_at").range(f, t)) as never, 10000),
  ]);
  if (r.error || c.error || d.error) throw new Error((r.error ?? c.error ?? d.error)!.message);
  return { items: classify(r.data ?? [], c.data ?? [], d.data ?? []), truncated: r.truncated || c.truncated || d.truncated };
}

export async function recordDecision(args: { staffRecordId: string; decision: "confirmado" | "rejeitado" | "pendente-de-chave"; personId: string | null; evidence: string; expectedHead: string | null }) {
  const { data, error } = await supabase.rpc("record_staff_reconciliation_decision", {
    _staff_record_id: args.staffRecordId, _decision: args.decision, _person_id: args.personId as string, _evidence: args.evidence, _expected_head: args.expectedHead as string,
  });
  if (error) throw new Error(/sem-competencia/.test(error.message) ? "Sua conta não tem competência para conciliar pessoal." : /base-desatualizada/.test(error.message) ? "Outra decisão foi registrada antes. Recarregue." : /evidencia/.test(error.message) ? "Descreva a evidência (mín. 10 caracteres)." : "Não foi possível registrar a decisão.");
  return data;
}
