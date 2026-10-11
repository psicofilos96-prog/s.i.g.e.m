// NEI.5 — espelho puro das regras do banco (0339): visitas, providências e protocolos.
export type VisitStatus = "agendada" | "reagendada" | "realizada" | "cancelada";
export type ActionStatus = "aberta" | "em-andamento" | "concluida" | "cancelada";
export type ProtocolStage = "enviado" | "recebido" | "devolutiva" | "encerrado";
export const VISIT_LABEL: Record<VisitStatus, string> = { agendada: "Agendada", reagendada: "Reagendada", realizada: "Realizada", cancelada: "Cancelada" };
export const ACTION_LABEL: Record<ActionStatus, string> = { aberta: "Aberta", "em-andamento": "Em andamento", concluida: "Concluída", cancelada: "Cancelada" };
export const STAGE_LABEL: Record<ProtocolStage, string> = { enviado: "Enviado", recebido: "Recebido", devolutiva: "Devolutiva dada", encerrado: "Encerrado" };
export const DESTINATION: Record<string, string> = { direcao: "Direção", op: "Orientação Pedagógica", aee: "AEE", docente: "Docente", supervisao: "Supervisão", familia: "Família autorizada" };

export const visitClosed = (s: VisitStatus) => s === "realizada" || s === "cancelada";
export const actionClosed = (s: ActionStatus) => s === "concluida" || s === "cancelada";

/** Mesmo critério do banco (`nei_text_has_clinical`): CID ou menção clínica não sai do NEI. */
export function hasClinicalText(t: string): boolean {
  return /(^|[^A-Za-z0-9])[A-TV-Z][0-9]{2}(\.[0-9]{1,2})?([^0-9]|$)/.test(t) || /(\bcid\b|\blaudo|diagn[oó]stic|\bcl[ií]nic)/i.test(t);
}

export function visitProblem(from: VisitStatus, to: VisitStatus, report: string, date: string): string | null {
  if (visitClosed(from)) return "Visita já encerrada.";
  if (to === "reagendada" && !date) return "Informe a nova data.";
  if (to === "realizada" && report.trim().length < 20) return "Relatório da visita (mínimo 20 caracteres).";
  if (to === "cancelada" && report.trim().length < 10) return "Justifique o cancelamento (mínimo 10).";
  return null;
}

/** Prazo vencido só quando há prazo declarado e o item segue aberto; sem prazo nunca é atraso. */
export function overdue(due: string | null, closed: boolean, today: string): boolean {
  return !!due && !closed && due < today;
}

export function protocolProblem(subject: string, body: string, kind: string, recipient: string, student: string): string | null {
  if (subject.trim().length < 5) return "Assunto com pelo menos 5 caracteres.";
  if (body.trim().length < 10) return "Mensagem com pelo menos 10 caracteres.";
  if (hasClinicalText(subject) || hasClinicalText(body)) return "Retire CID, laudo ou menção clínica: protocolos saem do NEI sem dado clínico.";
  if (kind === "familia" && !student) return "Para a família, escolha o estudante.";
  if (!recipient) return "Escolha o destinatário.";
  return null;
}
