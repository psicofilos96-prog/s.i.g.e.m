/**
 * Diário de Classe (redesign) — projeções PURAS de apresentação.
 * Não persiste nada, não cria regra: só organiza fatos já lidos pelas fontes do Diário.
 */
import { addDays, isIsoDate, weekdayOf } from "@/lib/academic-date";
import type { AttendanceMark, AttendanceMarks } from "../attendance";

export const CLASS_DIARY_TABS = [
  { id: "aulas", label: "Lançamento de Aulas" },
  { id: "frequencia", label: "Frequência" },
  { id: "conteudos", label: "Conteúdos" },
  { id: "avaliacoes", label: "Avaliações" },
  { id: "observacoes", label: "Observações" },
  { id: "relatorios", label: "Relatórios" },
] as const;
export type ClassDiaryTab = (typeof CLASS_DIARY_TABS)[number]["id"];

/** Aba desconhecida na URL volta para a primeira, sem erro. */
export function resolveTab(value: string | undefined): ClassDiaryTab {
  return CLASS_DIARY_TABS.some((t) => t.id === value) ? (value as ClassDiaryTab) : "aulas";
}

/** Segunda a sexta da semana da data (ISO). Data inválida ⇒ lista vazia, nunca semana inventada. */
export function weekDays(date: string): string[] {
  if (!isIsoDate(date)) return [];
  const iso = weekdayOf(date); // 0 = domingo
  const monday = addDays(date, iso === 0 ? -6 : 1 - iso);
  return [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
}

const WEEK_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export function dayChipLabel(date: string) {
  const [, m, d] = date.split("-");
  return `${WEEK_LABEL[weekdayOf(date)] ?? ""} ${d}/${m}`;
}
export function weekRangeLabel(days: string[]) {
  if (!days.length) return "Semana não definida";
  const f = (s: string) => s.split("-").reverse().slice(0, 2).join("/");
  return `Semana de ${f(days[0]!)} a ${f(days[days.length - 1]!)}`;
}

export type DayResume = {
  /** Contagem só de marcas observadas; sem chamada ⇒ null (nunca zero). */
  present: number | null;
  absent: number | null;
  unmarked: number | null;
};

/** Balanço do dia a partir das marcas lidas; slots sem chamada não viram falta nem presença. */
export function dayResume(
  sheets: Array<{ marks: AttendanceMarks | null; slotKeys: string[] }>,
  studentIds: string[],
): DayResume {
  const read = sheets.filter((s) => s.marks);
  if (!read.length) return { present: null, absent: null, unmarked: null };
  let present = 0;
  let absent = 0;
  let unmarked = 0;
  for (const s of read)
    for (const slot of s.slotKeys)
      for (const id of studentIds) {
        const mark: AttendanceMark | undefined = s.marks![slot]?.[id];
        if (mark === "Presente") present++;
        else if (mark === "Ausente") absent++;
        else unmarked++;
      }
  return { present, absent, unmarked };
}

/** Percentual só com denominador observado > 0. */
export function share(part: number | null, whole: number | null): string | null {
  if (part === null || !whole) return null;
  return `${((part / whole) * 100).toFixed(1).replace(".", ",")}%`;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]![0] : "")).toUpperCase() || "?";
}

/** Habilidades BNCC citadas no texto do registro (código EF/EI/EM…), sem catálogo inventado. */
export function bnccCodes(text: string | undefined): string[] {
  if (!text) return [];
  return [...new Set(text.toUpperCase().match(/\bE[FIM]\d{2}[A-Z]{2}\d{2,3}\b/g) ?? [])];
}

/** Marcação direta na tabela: vazio → Presente → Ausente → vazio. Nada é presumido. */
export function nextInlineMark(current: AttendanceMark | undefined): AttendanceMark | undefined {
  return current === undefined ? "Presente" : current === "Presente" ? "Ausente" : undefined;
}

/** Alterna a marca de um estudante numa aula, devolvendo novo rascunho (imutável). */
export function toggleInlineMark(draft: AttendanceMarks, slotKey: string, studentId: string): AttendanceMarks {
  const slot = { ...(draft[slotKey] ?? {}) };
  const next = nextInlineMark(slot[studentId]);
  if (next === undefined) delete slot[studentId]; else slot[studentId] = next;
  return { ...draft, [slotKey]: slot };
}

/** Quantas marcações faltam para concluir (todas as aulas × todos os estudantes). */
export function inlinePending(draft: AttendanceMarks, slotKeys: readonly string[], studentIds: readonly string[]): number {
  return slotKeys.reduce((n, k) => n + studentIds.filter((id) => !draft[k]?.[id]).length, 0);
}

/** Ato explícito do professor: só os não marcados viram Presente; marcados não mudam. */
export function fillPendingAsPresent(draft: AttendanceMarks, slotKeys: readonly string[], studentIds: readonly string[]): AttendanceMarks {
  const out: AttendanceMarks = { ...draft };
  for (const k of slotKeys) { const s = { ...(out[k] ?? {}) }; for (const id of studentIds) if (!s[id]) s[id] = "Presente"; out[k] = s; }
  return out;
}
