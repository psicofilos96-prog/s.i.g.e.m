// SIGEM 2.0 Perfil Docente — Lote 02: identidade, vínculos e "minhas turmas" por data.
// Projeção pura sobre fatos já lidos (atuações, atribuições, substituições, blocos de grade). Nunca
// cria cadastro: turma só aparece se houver atribuição/substituição registrada para a pessoa.
// Acesso histórico é proporcional: após o fim, só leitura dos registros do próprio período.

export type Engagement = { id: string; personId: string; schoolId: string; from: string; to: string | null; kind: string };
export type Assignment = { id: string; engagementId: string; classId: string; componentId: string | null; from: string; to: string | null };
export type Substitution = { id: string; substitutePersonId: string; assignmentId: string; from: string; to: string };
export type Block = { classId: string; weekday: number; start: string; end: string; assignmentId: string | null };

export type Access = "edicao" | "leitura-historica";
export type MyClass = {
  classId: string; schoolId: string; componentId: string | null; access: Access;
  basis: "atribuicao" | "substituicao"; window: { from: string; to: string | null }; sourceId: string;
};

const within = (d: string, from: string, to: string | null) => from <= d && (to === null || d <= to);
const minTo = (a: string | null, b: string | null) => (a === null ? b : b === null ? a : a < b ? a : b);

/** Turmas autorizadas da pessoa na data. Vigente = edição; encerrado = leitura histórica do próprio período. */
export function myClasses(p: { personId: string; date: string; engagements: Engagement[]; assignments: Assignment[]; substitutions: Substitution[] }): MyClass[] {
  const eng = new Map(p.engagements.map((e) => [e.id, e]));
  const out: MyClass[] = [];
  for (const a of p.assignments) {
    const e = eng.get(a.engagementId);
    if (!e || e.personId !== p.personId) continue;
    // A atribuição só vale dentro da atuação (mudança de escola encerra a anterior).
    const from = a.from > e.from ? a.from : e.from;
    const to = minTo(a.to, e.to);
    if (to !== null && to < from) continue;
    if (from > p.date) continue; // futura: ainda não autoriza nada
    out.push({ classId: a.classId, schoolId: e.schoolId, componentId: a.componentId, basis: "atribuicao", sourceId: a.id,
      window: { from, to }, access: within(p.date, from, to) ? "edicao" : "leitura-historica" });
  }
  const byId = new Map(p.assignments.map((a) => [a.id, a]));
  for (const s of p.substitutions) {
    if (s.substitutePersonId !== p.personId) continue;
    const a = byId.get(s.assignmentId); const e = a && eng.get(a.engagementId);
    if (!a || !e || s.from > p.date) continue;
    out.push({ classId: a.classId, schoolId: e.schoolId, componentId: a.componentId, basis: "substituicao", sourceId: s.id,
      window: { from: s.from, to: s.to }, access: within(p.date, s.from, s.to) ? "edicao" : "leitura-historica" });
  }
  return out.sort((x, y) => (x.access === y.access ? x.classId.localeCompare(y.classId) : x.access === "edicao" ? -1 : 1));
}

/** Titular perde a edição enquanto substituído? Não: substituição concede, nunca retira (decisão fica com a norma). */
export function canRecord(classes: MyClass[], classId: string, componentId: string | null, date: string): boolean {
  return classes.some((c) => c.classId === classId && c.componentId === componentId && within(date, c.window.from, c.window.to));
}

/** Registro histórico só é legível se a data do fato cair no período em que a pessoa tinha competência. */
export function canReadFact(classes: MyClass[], classId: string, factDate: string): boolean {
  return classes.some((c) => c.classId === classId && within(factDate, c.window.from, c.window.to));
}

/** Choques de horário da própria pessoa entre turmas/escolas (cessão, dupla regência). Só sobre blocos registrados. */
export function scheduleClashes(classes: MyClass[], blocks: Block[]) {
  const mine = new Set(classes.filter((c) => c.access === "edicao").map((c) => c.sourceId));
  const sel = blocks.filter((b) => b.assignmentId && mine.has(b.assignmentId));
  const clashes: [Block, Block][] = [];
  for (let i = 0; i < sel.length; i++) for (let j = i + 1; j < sel.length; j++) {
    const a = sel[i]!, b = sel[j]!;
    if (a.weekday === b.weekday && a.start < b.end && b.start < a.end) clashes.push([a, b]);
  }
  return clashes;
}

/** Cartão da turma: só o que foi lido; ausente fica null, nunca 0. */
export type ClassCard = { classId: string; schoolId: string; access: Access; basis: MyClass["basis"]; enrolled: number | null; nextBlock: Block | null; note: string | null };
export function classCard(c: MyClass, enrolled: number | null, blocks: Block[], weekday: number): ClassCard {
  const next = blocks.filter((b) => b.classId === c.classId && b.weekday >= weekday).sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start))[0] ?? null;
  return { classId: c.classId, schoolId: c.schoolId, access: c.access, basis: c.basis, enrolled, nextBlock: next,
    note: c.access === "leitura-historica" ? `Somente leitura: competência encerrada em ${c.window.to}` : c.basis === "substituicao" ? `Substituição até ${c.window.to}` : null };
}
