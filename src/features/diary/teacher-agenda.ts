/**
 * N10.2.1 — agenda do docente: projeção pura sobre blocos da grade PUBLICADA (class_schedule_at).
 * Próxima aula e conflitos vêm só dos blocos; nada é inferido de carga horária. Sem grade ⇒ nada.
 */
export type AgendaBlock = Readonly<{ blockId: string; date: string; start: string; end: string; classLabel: string; componentLabel: string | null }>;

const at = (b: AgendaBlock, t: "start" | "end") => `${b.date}T${b[t]}`;

export function nextLesson(blocks: readonly AgendaBlock[], nowIso: string): AgendaBlock | null {
  return [...blocks].filter((b) => at(b, "end") > nowIso).sort((a, b) => at(a, "start").localeCompare(at(b, "start")))[0] ?? null;
}

/** Conflito factual = dois blocos do mesmo docente com intervalos sobrepostos no mesmo dia. */
export function agendaConflicts(blocks: readonly AgendaBlock[]): Array<[AgendaBlock, AgendaBlock]> {
  const s = [...blocks].sort((a, b) => at(a, "start").localeCompare(at(b, "start")));
  const out: Array<[AgendaBlock, AgendaBlock]> = [];
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length && s[j]!.date === s[i]!.date; j++)
    if (s[j]!.start < s[i]!.end) out.push([s[i]!, s[j]!]);
  return out;
}
