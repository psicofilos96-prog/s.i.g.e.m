/** AEE/mediação — tipos e textos puros. Sem condição, diagnóstico ou critério de elegibilidade. */
export const WEEKDAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"] as const;

export type AeeSlot = Readonly<{ weekday: number; starts_at: string; ends_at: string }>;
export type AeeService = Readonly<{
  id: string; logical_id: string; version: number; event_kind: "registro" | "retificacao" | "encerramento"; student_id: string;
  responsible_engagement_id: string; valid_from: string; valid_to: string | null; origin_kind: string; reason: string | null;
  recorded_at: string; slots: AeeSlot[]; eligibility_status: "regra-institucional-pendente";
}>;
export type AeeSession = Readonly<{
  id: string; logical_id: string; version: number; event_kind: "registro" | "retificacao" | "anulacao"; session_date: string;
  presence_scheme_id: string; presence_value_id: string; pedagogical_note: string | null; reason: string | null; recorded_at: string;
}>;
export type MediatedStudent = Readonly<{ mediation_logical_id: string; school_id: string; student_id: string; student_name: string; class_id: string | null; valid_from: string; valid_to: string | null }>;
export type NetworkRow = Readonly<{ school_id: string; active_aee_services: number; active_mediations: number }>;

export const aeeEligibilityNote =
  "Não há regra institucional homologada de elegibilidade ou encaminhamento ao AEE. O SIGEM não decide nem sugere quem deve ser atendido: o atendimento registrado é decisão da escola, e o estado permanece pendente até a regra existir.";

export const eligibilityLabel = (s: AeeService["eligibility_status"]) =>
  s === "regra-institucional-pendente" ? "INSTITUTIONAL_ELIGIBILITY_RULES_PENDING" : s;
