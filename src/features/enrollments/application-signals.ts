// Matrículas L12 — sinais de inscrição (migration 0464). Sinal é projeção na hora; só a decisão humana é gravada.
// Nunca exclui, funde nem altera pedido/estudante/matrícula. "Já matriculado" só com reconciliação humana (L06), nunca por nome.
import { supabase } from "@/integrations/supabase/client";

export type SignalKind = "inscricao-repetida" | "ja-matriculado" | "identificador-inconsistente" | "responsaveis-multiplos";
export type Decision = "legitimo" | "procede" | "indeterminado";
export type Signal = { signal_kind: SignalKind; related_key: string; evidence: string; strength: "forte" | "fraca" | "indeterminada"; decision: Decision | null; decided_at: string | null };

export const SIGNAL_LABEL: Record<SignalKind, string> = {
  "inscricao-repetida": "Inscrição repetida",
  "ja-matriculado": "Estudante já matriculado",
  "identificador-inconsistente": "Identificadores inconsistentes",
  "responsaveis-multiplos": "Mais de um responsável pedindo",
};
export const DECISION_LABEL: Record<Decision, string> = {
  legitimo: "Verificado: situação legítima",
  procede: "Verificado: procede (encaminhar pelo fluxo próprio)",
  indeterminado: "Não foi possível concluir",
};
export const NO_AUTO_ACTION = "Nada é excluído nem unificado automaticamente. A decisão fica registrada com seu nome e motivo.";

export function resolutionProblems(reason: string): string[] {
  return reason.trim().length < 20 ? ["Explique a decisão com pelo menos 20 caracteres."] : [];
}

/** Sinais em aberto = sem decisão ou com decisão "indeterminado". */
export function openSignals(s: Signal[]): Signal[] {
  return s.filter((x) => x.decision === null || x.decision === "indeterminado");
}

export async function fetchSignals(app: string): Promise<Signal[]> {
  const { data, error } = await supabase.rpc("enr_application_signals", { _app: app });
  if (error) throw new Error("Não foi possível verificar os sinais.");
  return (data ?? []) as Signal[];
}

export async function resolveSignal(app: string, s: Signal, decision: Decision, reason: string, key: string) {
  const { count, error: e1 } = await supabase.from("enr_signal_resolutions").select("id", { count: "exact", head: true })
    .eq("application_id", app).eq("signal_kind", s.signal_kind).eq("related_key", s.related_key);
  if (e1) throw new Error("Não foi possível registrar.");
  const { error } = await supabase.rpc("record_enr_signal_resolution", {
    _app: app, _kind: s.signal_kind, _related: s.related_key, _expected_seq: count ?? 0, _decision: decision, _reason: reason, _key: key,
  });
  if (error) throw new Error(/sem-competencia/.test(error.message) ? "Você não tem competência para este pedido."
    : /sequencia/.test(error.message) ? "Outra pessoa decidiu antes. Atualize." : /sinal-inexistente/.test(error.message) ? "Este sinal não existe mais." : "Não foi possível registrar.");
}
