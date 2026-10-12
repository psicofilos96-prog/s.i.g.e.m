// Matrículas L14 — distribuição de vagas (migration 0466). Proposta deriva de execução OFICIAL da classificação (L13);
// células = escola|etapa|modalidade da oferta publicada; disponível = autorizadas − reservas ativas, ambas com fonte (sem leitura ⇒ null).
// O banco recalcula conflitos; validação por pessoa ≠ executor/proponente com ato; publicação só depois. Nada cria vaga/reserva/matrícula.
import { supabase } from "@/integrations/supabase/client";
import type { CellSlots, RequestInput } from "./distribution-engine";

export type CellDeclaration = { schoolId: string; stageId: string; modalityId: string; authorized: number | null; reserved: number | null; sourceRef: string | null };
export type DistributionCell = CellSlots & { reserved: number | null; sourceRef: string | null };

export const cellKey = (school: string, stage: string, modality: string) => `${school}|${stage}|${modality}`;

/** Nunca presume zero: autorizadas/reservas não lidas ou sem fonte ⇒ available null (o motor e o banco recusam). */
export function buildCells(decls: CellDeclaration[]): DistributionCell[] {
  return decls.map((d) => {
    const ok = d.authorized !== null && d.reserved !== null && !!d.sourceRef && d.authorized >= 0 && d.reserved >= 0;
    return { cellKey: cellKey(d.schoolId, d.stageId, d.modalityId), available: ok ? Math.max(0, d.authorized! - d.reserved!) : null, reserved: d.reserved, sourceRef: d.sourceRef };
  });
}

/** Preferências do pedido viram células da sua etapa/modalidade; pedido de outra campanha não entra. */
export function requestFromApplication(a: { protocol: string | null; schools: string[]; stageId: string; modalityId: string; campaignId: string }, campaignId: string, facts: RequestInput["facts"]): RequestInput | null {
  if (!a.protocol || a.campaignId !== campaignId) return null;
  return { protocol: a.protocol, preferences: a.schools.map((s) => cellKey(s, a.stageId, a.modalityId)), facts };
}

export type DistAction = "validar" | "devolver" | "publicar";
export function distributionState(events: { seq: number; action: DistAction }[]): "proposta" | "validada" | "devolvida" | "publicada" {
  const last = [...events].sort((a, b) => b.seq - a.seq)[0]?.action;
  return last === "validar" ? "validada" : last === "devolver" ? "devolvida" : last === "publicar" ? "publicada" : "proposta";
}

export const DIST_NOTICE = "Distribuição é proposta até ser validada e publicada; mesmo publicada, a vaga só se confirma com a matrícula pela escola.";

export async function proposeFromRun(runId: string): Promise<string> {
  const { data, error } = await supabase.rpc("enr_propose_distribution", { _run: runId });
  if (error) throw new Error(/simulacao/.test(error.message) ? "Simulação não gera distribuição." : /sem-competencia/.test(error.message) ? "Sem competência." : "Não foi possível gerar a proposta.");
  return data as string;
}

export async function recordDistributionEvent(p: string, expectedSeq: number, action: DistAction, act: string | null, reason: string, key: string) {
  const { error } = await supabase.rpc("record_enr_distribution_event", { _proposal: p, _expected_seq: expectedSeq, _action: action, _act: act as string, _reason: reason, _key: key });
  if (!error) return;
  const m = error.message;
  throw new Error(/com-conflitos/.test(m) ? "Há conflitos: resolva antes de validar." : /igual-executor/.test(m) ? "Quem gerou ou rodou não pode validar." : /exige-validacao/.test(m) ? "Publicar exige validação." : /sequencia/.test(m) ? "Outra pessoa agiu antes. Atualize." : "Não foi possível registrar.");
}
