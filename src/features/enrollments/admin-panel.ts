// Matrículas L11 — painel administrativo de inscrições (migration 0463).
// Leitura só por `enr_admin_applications`/`enr_admin_application_history` (competência de rede ou escolar na escola escolhida);
// anotações, pendências e critérios só por `record_enr_application_analysis` (append-only, seq esperado). Nada aqui cria matrícula ou vaga.
import { supabase } from "@/integrations/supabase/client";

export type AdminApplication = {
  id: string; application_code: string; campaign_id: string; submitted_at: string; requester_kind: string; requester_name: string;
  requester_email: string | null; requester_phone: string | null; declared_kinship: string | null; student_name: string;
  student_birth_date: string; stage_id: string; modality_id: string; school_preferences: string[]; protocol_number: string | null;
  docs_total: number; docs_pending: number; open_pendencies: number; total_count: number;
};
export type AnalysisKind = "anotacao" | "pendencia-aberta" | "pendencia-resolvida" | "criterio-conferido" | "criterio-nao-comprovado";
export const ANALYSIS_LABEL: Record<AnalysisKind, string> = {
  anotacao: "Anotação", "pendencia-aberta": "Abrir pendência", "pendencia-resolvida": "Resolver pendência",
  "criterio-conferido": "Critério conferido", "criterio-nao-comprovado": "Critério não comprovado",
};
export const PAGE_SIZE = 50;

export function analysisProblems(d: { subject: string; note: string }): string[] {
  const e: string[] = [];
  const s = d.subject.trim().length, n = d.note.trim().length;
  if (s < 3 || s > 120) e.push("Assunto entre 3 e 120 caracteres.");
  if (n < 10 || n > 2000) e.push("Texto entre 10 e 2000 caracteres.");
  return e;
}

/** Situação mostrada na lista: nunca "aprovado"/"com vaga" — o painel só organiza análise. */
export function rowStatus(r: Pick<AdminApplication, "protocol_number" | "docs_pending" | "open_pendencies">): string {
  if (!r.protocol_number) return "Aguardando protocolo";
  if (r.open_pendencies > 0) return `${r.open_pendencies} pendência(s) aberta(s)`;
  if (r.docs_pending > 0) return `${r.docs_pending} documento(s) a conferir`;
  return "Em análise";
}

/** Total exato vindo do servidor; truncado quando a página não cobre tudo. */
export function pageInfo(rows: AdminApplication[], offset: number) {
  const total = rows[0]?.total_count ?? 0;
  return { total, from: rows.length ? offset + 1 : 0, to: offset + rows.length, hasMore: offset + rows.length < total };
}

export async function listApplications(campaign: string | null, school: string | null, offset: number): Promise<AdminApplication[]> {
  const { data, error } = await supabase.rpc("enr_admin_applications", { _campaign: campaign as string, _school: school as string, _limit: PAGE_SIZE, _offset: offset });
  if (error) throw new Error("Não foi possível carregar as inscrições.");
  return (data ?? []) as unknown as AdminApplication[];
}

export async function applicationHistory(id: string): Promise<{ at: string; kind: string; detail: string }[]> {
  const { data, error } = await supabase.rpc("enr_admin_application_history", { _app: id });
  if (error) throw new Error("Não foi possível carregar o histórico.");
  return (data ?? []) as { at: string; kind: string; detail: string }[];
}

export async function recordAnalysis(app: string, expectedSeq: number, kind: AnalysisKind, subject: string, note: string, key: string) {
  const { error } = await supabase.rpc("record_enr_application_analysis", { _app: app, _expected_seq: expectedSeq, _kind: kind, _subject: subject, _note: note, _key: key });
  if (error) throw new Error(/sem-competencia/.test(error.message) ? "Você não tem competência para este pedido." : /sequencia/.test(error.message) ? "Outra pessoa registrou antes. Atualize e tente de novo." : "Não foi possível registrar.");
}
