/**
 * B4.6.2b.2 — data acadêmica de referência das consultas institucionais.
 *
 * - Data informada (URL `data`) prevalece; inválida ⇒ indisponível (nunca substituída).
 * - Sem data informada, com sessão: "hoje operacional" capturado UMA vez por montagem/contexto.
 *   É apenas referência de consulta (qual versão vigente ler), jamais norma, prazo ou efeito.
 * - Nunca a data fixa do laboratório numa sessão institucional.
 * - Laboratório (sem sessão) mantém o legado: data informada ou a referência do laboratório.
 */
import { useState } from "react";
import { DIARY_REFERENCE_DATE } from "@/features/diary/diary-data";

export type ReferenceDateSource = "informada" | "hoje-operacional" | "laboratorio";
export type AcademicReferenceDate =
  | { kind: "ready"; date: string; source: ReferenceDateSource }
  | { kind: "invalid"; reason: string };

/** Data civil estrita AAAA-MM-DD (rejeita 2026-02-30). */
export function isCivilDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  if (m < 1 || m > 12 || d < 1) return false;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= days;
}

/** Data operacional local de hoje (AAAA-MM-DD). Referência de consulta, nunca norma. */
export function operationalToday(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function resolveAcademicReferenceDate(args: {
  provided: string | undefined;
  institutional: boolean;
  today: string;
}): AcademicReferenceDate {
  const { provided, institutional, today } = args;
  if (provided !== undefined && provided !== "") {
    if (!isCivilDate(provided))
      return { kind: "invalid", reason: `Data acadêmica de referência inválida: "${provided}". Nenhuma consulta é feita com data substituta.` };
    return { kind: "ready", date: provided, source: "informada" };
  }
  if (!institutional) return { kind: "ready", date: DIARY_REFERENCE_DATE, source: "laboratorio" };
  if (!isCivilDate(today))
    return { kind: "invalid", reason: "Data operacional de referência indisponível." };
  return { kind: "ready", date: today, source: "hoje-operacional" };
}

/** Hoje operacional capturado uma vez por montagem: todas as consultas do carregamento usam a mesma data. */
export function useAcademicReferenceDate(provided: string | undefined, institutional: boolean): AcademicReferenceDate {
  const [today] = useState(() => operationalToday());
  return resolveAcademicReferenceDate({ provided, institutional, today });
}

/** Data a usar nas consultas: só quando pronta; inválida ⇒ undefined (a fonte fica indisponível). */
export const referenceDateValue = (r: AcademicReferenceDate) => (r.kind === "ready" ? r.date : undefined);
