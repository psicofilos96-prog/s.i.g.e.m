/**
 * Banco de Solicitação de Vagas da escola (0555). Pedido não é matrícula nem promessa de vaga.
 * Estado é projeção do último evento; ordem padrão = ordem de protocolo (Padrão do sistema).
 */
import type { ReportDefinition } from "@/features/reports/report-engine";

export type VacancyRequestAction = "convocar" | "matriculado" | "desistiu" | "nao-compareceu" | "cancelar" | "voltar-a-fila";
export type VacancyRequestState = "aguardando" | "convocada" | "matriculada" | "desistiu" | "nao-compareceu" | "cancelada";

export type VacancyRequestRow = {
  id: string; protocol_code: string; protocol_seq: number; desired_stage: string; desired_shift: string | null;
  student_name: string; student_birth_date: string; guardian_name: string; guardian_phone: string | null; note: string | null;
  recorded_at: string; last_seq: number; last_action: VacancyRequestAction | null; due_on: string | null; last_note: string | null; last_at: string | null;
};

export function requestState(last: VacancyRequestAction | null): VacancyRequestState {
  switch (last) {
    case null: case "voltar-a-fila": return "aguardando";
    case "convocar": return "convocada";
    case "matriculado": return "matriculada";
    case "desistiu": return "desistiu";
    case "nao-compareceu": return "nao-compareceu";
    case "cancelar": return "cancelada";
  }
}

export const STATE_LABEL: Record<VacancyRequestState, string> = {
  aguardando: "Aguardando vaga", convocada: "Convocada", matriculada: "Matriculada",
  desistiu: "Desistiu", "nao-compareceu": "Não compareceu", cancelada: "Cancelada",
};

/** Ações permitidas a partir de cada estado — o banco aplica a mesma tabela. */
export const ALLOWED: Record<VacancyRequestState, readonly VacancyRequestAction[]> = {
  aguardando: ["convocar", "desistiu", "cancelar"],
  convocada: ["matriculado", "nao-compareceu", "voltar-a-fila", "desistiu", "cancelar"],
  "nao-compareceu": ["voltar-a-fila"],
  matriculada: [], desistiu: [], cancelada: [],
};

export const isOpen = (s: VacancyRequestState) => s === "aguardando" || s === "convocada";

/** Posição na fila: só pedidos abertos, por ordem de protocolo; voltar à fila mantém o protocolo original. */
export function queuePositions(rows: readonly VacancyRequestRow[]): Map<string, number> {
  const open = rows.filter((r) => isOpen(requestState(r.last_action)))
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at) || a.protocol_seq - b.protocol_seq);
  const byStage = new Map<string, number>(); const out = new Map<string, number>();
  for (const r of open) { const n = (byStage.get(r.desired_stage) ?? 0) + 1; byStage.set(r.desired_stage, n); out.set(r.id, n); }
  return out;
}

/** Prazo padrão de comparecimento após a convocação (Padrão do sistema, editável no ato). */
export const DEFAULT_CALL_DAYS = 5;
export function defaultDueOn(today: string, days = DEFAULT_CALL_DAYS): string {
  const d = new Date(today + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}

export const STAGE_OPTIONS = ["Creche", "Pré-escola I", "Pré-escola II", "1º ano", "2º ano", "3º ano", "4º ano", "5º ano", "6º ano", "7º ano", "8º ano", "9º ano", "EJA"];
export const SHIFT_OPTIONS = ["Manhã", "Tarde", "Integral", "Noite"];

export const VACANCY_QUEUE_REPORT: ReportDefinition = {
  id: "fila-de-vagas-escola", version: 1, title: "Fila de solicitações de vaga",
  description: "Pedidos de vaga da escola na ordem de protocolo. Pedido não é matrícula.",
  source: "secretariat_own_vacancy_requests", params: [],
  columns: [
    { id: "posicao", label: "Posição", kind: "number" },
    { id: "protocolo", label: "Protocolo", kind: "text" },
    { id: "estudante", label: "Estudante", kind: "text" },
    { id: "nascimento", label: "Nascimento", kind: "text" },
    { id: "etapa", label: "Etapa", kind: "text" },
    { id: "turno", label: "Turno", kind: "text" },
    { id: "responsavel", label: "Responsável", kind: "text" },
    { id: "situacao", label: "Situação", kind: "text" },
  ],
  formats: ["csv", "xlsx", "pdf"], reproducible: true, syncRowLimit: 20000,
};

const br = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : null);
export function queueReportRows(rows: readonly VacancyRequestRow[]) {
  const pos = queuePositions(rows);
  return rows.map((r) => ({
    posicao: pos.get(r.id) ?? null, protocolo: r.protocol_code, estudante: r.student_name, nascimento: br(r.student_birth_date),
    etapa: r.desired_stage, turno: r.desired_shift ?? "Sem preferência", responsavel: r.guardian_name, situacao: STATE_LABEL[requestState(r.last_action)],
  }));
}

export const VACANCY_REQUEST_MESSAGES: Record<string, string> = {
  "vacancy-request:capability-missing": "Sua conta não pode registrar pedidos de vaga nesta escola.",
  "vacancy-request:birth-invalid": "Informe uma data de nascimento válida.",
  "vacancy-request:duplicate": "Já existe um pedido aberto para este estudante nesta escola e ano.",
  "vacancy-request:stale-base": "O pedido mudou enquanto você trabalhava. Recarregue e tente de novo.",
  "vacancy-request:transition-invalid": "Esta ação não cabe na situação atual do pedido.",
  "vacancy-request:due-invalid": "Informe um prazo de comparecimento a partir de hoje.",
  "vacancy-request:reason-required": "Escreva o motivo (pelo menos 5 letras).",
};
