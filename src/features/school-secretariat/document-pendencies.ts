/** Pendência documental manual da Secretaria. Nunca afirma obrigação legal: a lista de obrigatórios não está configurada. */
export type PendencyStatus = "pendente" | "recebido" | "invalido" | "vencido" | "dispensado";
export const PENDENCY_STATUS_LABEL: Record<PendencyStatus, string> = {
  pendente: "Pendente", recebido: "Recebido", invalido: "Inválido", vencido: "Vencido", dispensado: "Dispensado",
};
export type PendencyEvent = {
  pendency_id: string; version: number; enrollment_id: string; student_id: string; description: string;
  status: PendencyStatus; due_on: string | null; note: string | null; recorded_at: string; is_current: boolean;
};
export type Pendency = { current: PendencyEvent; history: PendencyEvent[] };

/** Agrupa a cadeia append-only: vigente = maior versão; histórico em ordem. */
export function groupPendencies(rows: PendencyEvent[]): Pendency[] {
  const by = new Map<string, PendencyEvent[]>();
  for (const r of rows) by.set(r.pendency_id, [...(by.get(r.pendency_id) ?? []), r]);
  return [...by.values()].map((h) => {
    const history = [...h].sort((a, b) => a.version - b.version);
    return { current: history[history.length - 1]!, history };
  });
}

/** Em aberto = pendente, inválido ou vencido. Recebido/dispensado não contam. */
export const isOpen = (s: PendencyStatus) => s === "pendente" || s === "invalido" || s === "vencido";
export const openCount = (ps: Pendency[]) => ps.filter((p) => isOpen(p.current.status)).length;

/** Prazo vencido só quando o prazo foi declarado; sem prazo nunca é atraso. */
export const isOverdue = (p: Pendency, on: string) => isOpen(p.current.status) && p.current.due_on !== null && p.current.due_on < on;

export function pendencyMessage(raw: string): string {
  if (raw.includes("head-changed")) return "Outra pessoa alterou esta pendência. Recarregue e tente de novo.";
  if (raw.includes("not-found")) return "Pendência ou matrícula não encontrada nesta escola.";
  if (raw.includes("must-open-pending")) return "Uma pendência nova começa como pendente.";
  return "Não foi possível registrar. Tente de novo.";
}
