// L17 — histórico formativo permanente (migrations 0446/0447): projeção do banco, nunca cópia.
export interface FormationItem {
  enrollment_id: string; class_label: string; starts_on: string; ends_on: string; course_title: string; course_version: number;
  hours_minutes: number | null; nominal_hours_minutes: number;
  link_at_time: { id: string | null; registration: string | null } | null;
  last_event: string | null; completion: "conclusao" | "nao-conclusao" | null;
  certificate: { code: string; version: number; issued_on: string; status: "valido" | "revogado" } | null;
}
export interface FormationTrack { track_version_id: string; title: string; version: number; steps_total: number; steps_done: number }
export interface FormationRecord { person_id: string; own: boolean; completed_hours_minutes: number; items: FormationItem[]; tracks: FormationTrack[] }

/** Situação exibida: inscrição, participação e conclusão nunca se confundem. */
export function itemSituation(i: Pick<FormationItem, "last_event" | "completion">): string {
  if (i.completion === "conclusao") return "Concluído";
  if (i.completion === "nao-conclusao") return "Não concluído";
  switch (i.last_event) {
    case "confirmacao": return "Participando";
    case "espera": return "Lista de espera";
    case "desistencia": return "Desistência";
    case "cancelamento": return "Cancelado";
    default: return "Inscrição solicitada";
  }
}

export function recordProblems(x: { own: boolean; hasCapability: boolean; purpose: string | null }): string[] {
  if (x.own) return [];
  const p: string[] = [];
  if (!x.hasCapability) p.push("Consulta administrativa exige capacidade própria");
  if (!x.purpose || x.purpose.trim().length < 10) p.push("Finalidade obrigatória na consulta administrativa");
  return p;
}

export function completedHours(items: Pick<FormationItem, "completion" | "nominal_hours_minutes">[]): number {
  return items.reduce((s, i) => s + (i.completion === "conclusao" ? i.nominal_hours_minutes : 0), 0);
}
