/**
 * NHOR.2 — conflitos sobre blocos REGISTRADOS (grade vigente). Nunca infere
 * bloco de carga horária: sem bloco não há conflito nem falta. Sala só entra
 * quando o bloco declara sala; ausência de sala não é conflito.
 */
export type GridBlock = Readonly<{
  blockId: string; classId: string; day: string; start: string; end: string;
  personIds: readonly string[]; roomId?: string | null;
}>;
export type Conflict = Readonly<{ kind: "pessoa" | "turma" | "sala"; key: string; day: string; blockIds: readonly [string, string] }>;

const overlaps = (a: GridBlock, b: GridBlock) => a.day === b.day && a.start < b.end && b.start < a.end;

export function findConflicts(blocks: readonly GridBlock[]): Conflict[] {
  const out: Conflict[] = [];
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
    const a = blocks[i]!, b = blocks[j]!;
    if (!overlaps(a, b)) continue;
    const pair = [a.blockId, b.blockId].sort() as [string, string];
    if (a.classId === b.classId) out.push({ kind: "turma", key: a.classId, day: a.day, blockIds: pair });
    for (const p of a.personIds) if (b.personIds.includes(p)) out.push({ kind: "pessoa", key: p, day: a.day, blockIds: pair });
    if (a.roomId && a.roomId === b.roomId) out.push({ kind: "sala", key: a.roomId, day: a.day, blockIds: pair });
  }
  return out;
}

export const CONFLICT_TEXT: Record<Conflict["kind"], string> = {
  pessoa: "A mesma pessoa está em duas aulas no mesmo horário.",
  turma: "A turma tem duas aulas no mesmo horário.",
  sala: "A mesma sala está ocupada por duas aulas no mesmo horário.",
};

/** Adaptador puro: grade registrada lida pelo reader → blocos para conflito. Pessoa = atuação registrada no bloco. */
export function gridBlocksOf(classId: string, days: readonly { weekday: string | number; blocks: readonly { blockId: string; startsAt: string; endsAt: string; engagementIds: readonly string[] }[] }[]): GridBlock[] {
  return days.flatMap((d) => d.blocks.map((b) => ({ blockId: b.blockId, classId, day: String(d.weekday), start: b.startsAt, end: b.endsAt, personIds: b.engagementIds })));
}
