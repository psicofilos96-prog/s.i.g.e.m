/**
 * B4.10.0e — contexto de sessão e referência de consulta dos horários institucionais.
 *
 * - Contexto = `userId#sessionRevision`: entra em TODA chave de cache das telas de horários com conta,
 *   porque novo login da mesma conta (ou outra conta) não pode reaproveitar resposta anterior.
 * - Data: `data` da URL válida prevalece; sem ela, hoje operacional local capturado UMA vez por montagem
 *   (a tela é remontada a cada contexto). URL inválida ou campo limpo ⇒ nenhuma leitura, nenhuma substituta.
 * - knownAt: UM instante por (contexto, data), capturado antes das leituras e propagado a todas elas.
 */
import { useMemo, useState } from "react";
import { isCivilDate, operationalToday } from "@/features/academic/academic-reference-date";
import { captureScheduleKnownAt } from "@/features/student-life/class-schedule-source";

export const scheduleContextKey = (userId: string, revision: number) => `${userId}#${revision}`;

export type ScheduleReference =
  | { kind: "ready"; validOn: string; knownAt: string; source: "informada" | "hoje-operacional" }
  | { kind: "bloqueada"; reason: string };

export function useScheduleReference(urlDate: string | undefined): {
  reference: ScheduleReference;
  /** Valor exibido no campo ("" quando limpo ou inválido). */
  inputValue: string;
  /** Data válida escolhida no campo; "" = campo limpo (bloqueia leituras). */
  choose: (iso: string) => string | null;
} {
  const [today] = useState(() => operationalToday());
  const [cleared, setCleared] = useState(false);
  const provided = urlDate !== undefined && urlDate !== "" ? urlDate : undefined;
  const validOn = cleared ? null : provided === undefined ? (isCivilDate(today) ? today : null) : isCivilDate(provided) ? provided : null;
  // UM knownAt por data efetiva; nunca recapturado durante a vida desta data.
  const knownAt = useMemo(() => (validOn ? captureScheduleKnownAt() : null), [validOn]);
  const reference: ScheduleReference = cleared
    ? { kind: "bloqueada", reason: "Informe uma data de referência. Nenhuma consulta é feita sem data." }
    : provided !== undefined && !isCivilDate(provided)
      ? { kind: "bloqueada", reason: `Data de referência inválida: "${provided}". Nenhuma consulta é feita com data substituta.` }
      : !validOn || !knownAt
        ? { kind: "bloqueada", reason: "Data operacional de referência indisponível." }
        : { kind: "ready", validOn, knownAt, source: provided ? "informada" : "hoje-operacional" };
  return {
    reference,
    inputValue: reference.kind === "ready" ? reference.validOn : "",
    choose: (iso) => {
      if (!iso) { setCleared(true); return null; }
      if (!isCivilDate(iso)) return null;
      setCleared(false);
      return iso;
    },
  };
}
