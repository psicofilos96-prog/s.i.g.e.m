/** Atendimento domiciliar/hospitalar: projeção pura dos eventos (abrir → registros → encerrar). */
export type CareEvent = { care_id: string; act: "abrir" | "registrar" | "encerrar"; care_kind: string | null; occurred_on: string; expected_end: string | null; place: string | null; professional: string | null; note: string | null; recorded_at: string };
export type CareEpisode = { id: string; kind: string; startsOn: string; expectedEnd: string | null; place: string | null; reason: string; closedOn: string | null; closeNote: string | null; entries: { on: string; professional: string | null; note: string }[] };

export const CARE_KINDS = [{ key: "domiciliar", label: "Domiciliar" }, { key: "hospitalar", label: "Hospitalar" }] as const;
export const careKindLabel = (k: string) => CARE_KINDS.find((x) => x.key === k)?.label ?? "Atendimento";

export function projectCare(events: readonly CareEvent[]): CareEpisode[] {
  return events.filter((e) => e.act === "abrir").map((o) => {
    const own = events.filter((e) => e.care_id === o.care_id);
    const close = own.find((e) => e.act === "encerrar");
    return {
      id: o.care_id, kind: o.care_kind ?? "", startsOn: o.occurred_on, expectedEnd: o.expected_end, place: o.place, reason: o.note ?? "",
      closedOn: close?.occurred_on ?? null, closeNote: close?.note ?? null,
      entries: own.filter((e) => e.act === "registrar").map((e) => ({ on: e.occurred_on, professional: e.professional, note: e.note ?? "" })).sort((a, b) => a.on.localeCompare(b.on)),
    };
  }).sort((a, b) => b.startsOn.localeCompare(a.startsOn));
}

export const CARE_MESSAGES: Record<string, string> = {
  "care:capability-missing": "Sua conta não pode registrar atendimentos nesta escola.",
  "care:kind-invalid": "Escolha se é domiciliar ou hospitalar.",
  "care:date-invalid": "Confira a data: não pode ser no futuro nem antes do início.",
  "care:period-invalid": "A previsão de término não pode ser antes do início.",
  "care:note-required": "Escreva uma descrição (pelo menos 5 letras).",
  "care:not-a-student": "Este aluno não tem matrícula nesta escola.",
  "care:already-open": "Já existe um atendimento aberto para este aluno.",
  "care:closed": "Este atendimento já foi encerrado.",
  "care:not-found": "Atendimento não encontrado.",
};
