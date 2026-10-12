// SIGEM 2.0 Perfil Docente — Lote 03: Central da Aula (projeção pura).
// Aula vem só da grade publicada: é PREVISTA. Ministrada só existe quando há registro de aula;
// esta projeção nunca afirma que a aula ocorreu.
import type { AgendaBlock } from "./teacher-agenda";

export type CentralBlock = AgendaBlock & { classId: string; component: string | null };
export type CentralFocus =
  | { kind: "agora"; block: CentralBlock }
  | { kind: "proxima"; block: CentralBlock }
  | { kind: "encerradas"; last: CentralBlock }
  | { kind: "sem-grade" };

const at = (b: AgendaBlock, t: "start" | "end") => `${b.date}T${b[t]}`;

export function lessonFocus(blocks: readonly CentralBlock[], nowIso: string): CentralFocus {
  if (!blocks.length) return { kind: "sem-grade" };
  const s = [...blocks].sort((a, b) => at(a, "start").localeCompare(at(b, "start")));
  const now = s.find((b) => at(b, "start") <= nowIso && nowIso < at(b, "end"));
  if (now) return { kind: "agora", block: now };
  const next = s.find((b) => at(b, "start") > nowIso);
  if (next) return { kind: "proxima", block: next };
  return { kind: "encerradas", last: s[s.length - 1]! };
}

export const PREVISTA_NOTE = "Aula prevista na grade. Ela só passa a ser ministrada quando você registrar a aula.";

/** Alunos válidos: alocação vigente única na turma na data de referência; ambíguos ficam de fora e contados à parte. */
export function validStudents<T extends { id: string; currentClassId: string | null }>(students: readonly T[], classId: string) {
  return students.filter((s) => s.currentClassId === classId);
}
