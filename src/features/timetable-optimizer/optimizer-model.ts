/**
 * Otimizador assistido de horários: SUGERE alternativas; nunca aplica.
 * Só considera restrições com representação canônica; as demais são listadas como "não consideradas".
 * Algoritmo: busca em profundidade determinística (sem dependência externa), com limite de passos.
 */
import type { BulkOperation, BulkItem } from "@/features/bulk/bulk-engine";

export const PROBLEM_VERSION = 1;

export type Slot = Readonly<{ id: string; weekday: number; start: string; end: string }>; // HH:MM
export type Lesson = Readonly<{ id: string; classId: string; componentId: string | null; personIds: readonly string[] }>;
export type ConstraintId = "turma-um-bloco-por-tempo" | "pessoa-sem-simultaneidade" | "tempos-configurados-da-turma"
  | "disponibilidade-profissional" | "carga-requerida-por-componente" | "sala-ou-recurso" | "calendario-letivo";
export type ConstraintState = Readonly<{ id: ConstraintId; considered: boolean; source: string }>;

export type Problem = Readonly<{
  version: number; snapshotKnownAt: string; validOn: string;
  slotsByClass: Readonly<Record<string, readonly Slot[]>>; // tempos configurados (grade/jornada canônica)
  lessons: readonly Lesson[];
  /** Disponibilidade só se houver fonte canônica; null = não considerada. */
  availability: Readonly<Record<string, readonly string[]>> | null; // personId → slotIds permitidos
}>;

export function constraintsOf(p: Problem): ConstraintState[] {
  return [
    { id: "turma-um-bloco-por-tempo", considered: true, source: "class_schedule_at (blocos da turma)" },
    { id: "pessoa-sem-simultaneidade", considered: true, source: "teaching_assignments_at + institutional_engagements.person_id" },
    { id: "tempos-configurados-da-turma", considered: true, source: "class_schedule_at / class_journey_at (tempos declarados)" },
    { id: "disponibilidade-profissional", considered: p.availability != null, source: p.availability ? "fonte informada" : "sem fonte canônica" },
    { id: "carga-requerida-por-componente", considered: false, source: "sem regra homologada; mantém a quantidade de blocos da grade vigente" },
    { id: "sala-ou-recurso", considered: false, source: "sem cadastro canônico de salas/recursos" },
    { id: "calendario-letivo", considered: false, source: "grade semanal não depende do dia letivo" },
  ];
}

export type Placement = Readonly<{ lessonId: string; slotId: string }>;
export type Violation = Readonly<{ constraint: ConstraintId; message: string; lessonIds: readonly string[] }>;
export type Candidate = Readonly<{ id: string; placements: readonly Placement[]; violations: readonly Violation[]; feasible: boolean }>;
export type Outcome = Readonly<{ problemVersion: number; constraints: readonly ConstraintState[]; candidates: readonly Candidate[];
  impossible: readonly Violation[]; exhausted: boolean }>;

const overlaps = (a: Slot, b: Slot) => a.weekday === b.weekday && a.start < b.end && b.start < a.end;

/** Verifica qualquer solução (sugerida ou existente) só contra restrições consideradas. */
export function check(p: Problem, placements: readonly Placement[]): Violation[] {
  const v: Violation[] = []; const lesson = new Map(p.lessons.map((l) => [l.id, l]));
  const slot = (l: Lesson, id: string) => p.slotsByClass[l.classId]?.find((s) => s.id === id) ?? null;
  const used = new Map<string, string>();
  const placed: { l: Lesson; s: Slot }[] = [];
  for (const pl of placements) {
    const l = lesson.get(pl.lessonId)!; const s = slot(l, pl.slotId);
    if (!s) { v.push({ constraint: "tempos-configurados-da-turma", message: `Tempo ${pl.slotId} não é configurado para a turma.`, lessonIds: [l.id] }); continue; }
    const k = `${l.classId}|${s.id}`;
    if (used.has(k)) v.push({ constraint: "turma-um-bloco-por-tempo", message: `Turma ${l.classId} com dois blocos no tempo ${s.id}.`, lessonIds: [used.get(k)!, l.id] });
    used.set(k, l.id);
    if (p.availability) for (const pid of l.personIds) if (!(p.availability[pid] ?? []).includes(s.id))
      v.push({ constraint: "disponibilidade-profissional", message: `Pessoa ${pid} indisponível no tempo ${s.id}.`, lessonIds: [l.id] });
    for (const o of placed) if (overlaps(o.s, s) && o.l.personIds.some((x) => l.personIds.includes(x)))
      v.push({ constraint: "pessoa-sem-simultaneidade", message: `Mesma pessoa em ${o.l.classId} e ${l.classId} ao mesmo tempo.`, lessonIds: [o.l.id, l.id] });
    placed.push({ l, s });
  }
  return v;
}

/** Inviabilidade evidente antes da busca (explicável). */
function impossibilities(p: Problem): Violation[] {
  const out: Violation[] = [];
  const byClass = new Map<string, Lesson[]>(); p.lessons.forEach((l) => byClass.set(l.classId, [...(byClass.get(l.classId) ?? []), l]));
  for (const [c, ls] of byClass) { const n = p.slotsByClass[c]?.length ?? 0;
    if (ls.length > n) out.push({ constraint: "turma-um-bloco-por-tempo", message: `Turma ${c}: ${ls.length} blocos para ${n} tempos configurados.`, lessonIds: ls.map((l) => l.id) }); }
  if (p.availability) for (const l of p.lessons) for (const pid of l.personIds) {
    const ok = (p.slotsByClass[l.classId] ?? []).some((s) => (p.availability![pid] ?? []).includes(s.id));
    if (!ok) out.push({ constraint: "disponibilidade-profissional", message: `Pessoa ${pid} sem nenhum tempo disponível na turma ${l.classId}.`, lessonIds: [l.id] });
  }
  return out;
}

/**
 * Gera até `max` alternativas distintas; determinístico (mesma entrada ⇒ mesma saída).
 * Alternativa k começa a busca pelo k-ésimo tempo rotacionado.
 */
export function suggest(p: Problem, opts: { max?: number; stepLimit?: number } = {}): Outcome {
  const constraints = constraintsOf(p); const imp = impossibilities(p);
  if (imp.length) return { problemVersion: p.version, constraints, candidates: [], impossible: imp, exhausted: false };
  const max = opts.max ?? 3; const limit = opts.stepLimit ?? 200_000;
  const lessons = [...p.lessons].sort((a, b) => (b.personIds.length - a.personIds.length) || a.id.localeCompare(b.id));
  const seen = new Set<string>(); const out: Candidate[] = []; let steps = 0; let exhausted = false;
  for (let rot = 0; out.length < max && rot < max * 4; rot++) {
    const cur: Placement[] = [];
    const go = (i: number): boolean => {
      if (++steps > limit) { exhausted = true; return false; }
      if (i === lessons.length) return true;
      const l = lessons[i]!; const sl = [...(p.slotsByClass[l.classId] ?? [])].sort((a, b) => a.id.localeCompare(b.id));
      const r = sl.length ? (rot + i) % sl.length : 0; const order = [...sl.slice(r), ...sl.slice(0, r)];
      for (const s of order) { cur.push({ lessonId: l.id, slotId: s.id });
        if (check(p, cur).length === 0 && go(i + 1)) return true; cur.pop(); }
      return false;
    };
    if (!go(0)) { if (exhausted) break; continue; }
    const placements = [...cur].sort((a, b) => a.lessonId.localeCompare(b.lessonId));
    const key = placements.map((x) => `${x.lessonId}@${x.slotId}`).join(",");
    if (seen.has(key)) continue; seen.add(key);
    out.push({ id: `alt-${out.length + 1}`, placements, violations: [], feasible: true });
  }
  const impossible: Violation[] = out.length === 0 && !exhausted ? [{ constraint: "pessoa-sem-simultaneidade", message: "Nenhuma distribuição satisfaz as restrições consideradas (provável conflito de pessoa entre turmas).", lessonIds: p.lessons.map((l) => l.id) }] : [];
  return { problemVersion: p.version, constraints, candidates: out, impossible, exhausted };
}

/** Diff candidato × grade atual: só blocos que mudam de tempo. */
export type Move = Readonly<{ lessonId: string; classId: string; from: string | null; to: string }>;
export function diff(p: Problem, current: readonly Placement[], c: Candidate): Move[] {
  const now = new Map(current.map((x) => [x.lessonId, x.slotId])); const cls = new Map(p.lessons.map((l) => [l.id, l.classId]));
  return c.placements.filter((x) => now.get(x.lessonId) !== x.slotId).map((x) => ({ lessonId: x.lessonId, classId: cls.get(x.lessonId)!, from: now.get(x.lessonId) ?? null, to: x.slotId }));
}

/** Aplicar = lote com writer canônico da grade; sem executor registrado ⇒ recusa e encaminha a /horarios. */
export function applyItems(moves: readonly Move[], schoolId: string, baseFingerprint: string): BulkItem<Move>[] {
  return moves.map((m) => ({ key: `${m.classId}:${m.lessonId}`, scope: schoolId, expectedBase: baseFingerprint, payload: m }));
}
export function applyOperation(currentFingerprint: () => Promise<string | null>, executor: ((m: Move, k: string) => Promise<void>) | null): BulkOperation<Move> {
  return { id: "aplicar-sugestao-de-horario", version: 1, label: "Aplicar sugestão de horário", mode: "parcial", maxItems: 500,
    validate: () => executor ? null : "Sem executor registrado para record_class_schedule_version: aplique pela tela oficial (/horarios).",
    currentBase: async () => currentFingerprint(),
    executeOne: async (i, k) => { if (!executor) throw new Error("Sem executor."); await executor(i.payload, k); } };
}
