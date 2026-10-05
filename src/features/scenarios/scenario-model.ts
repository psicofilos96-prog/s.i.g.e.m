/**
 * Simulador "e se?": cenário = cópia hipotética de uma base lida (snapshot) + alterações.
 * Vive só em memória/armazenamento local do autor; nunca é lido por Diário, documentos,
 * Mapa ou painéis. Promover gera diff e passa pelo motor de lote com writer canônico.
 */
import { personLoads, projectClass, totals, type Assignment, type Block, type ClassInput, type Totals } from "@/features/staffing/staffing-model";
import type { BulkItem, BulkOperation } from "@/features/bulk/bulk-engine";

export type Change =
  | { kind: "grade:remover-bloco"; classId: string; blockKey: string }
  | { kind: "grade:adicionar-bloco"; classId: string; block: Block }
  | { kind: "grade:trocar-responsavel"; classId: string; blockKey: string; engagementIds: string[] }
  | { kind: "regencia:adicionar"; classId: string; assignment: Assignment }
  | { kind: "regencia:remover"; classId: string; assignmentId: string }
  | { kind: "turma:mover-blocos"; fromClassId: string; toClassId: string; blockKeys: string[] };

export type Scenario = Readonly<{
  id: string; mode: "simulacao"; authorUserId: string; schoolId: string; validOn: string; knownAt: string; createdAt: string;
  baseFingerprint: string; base: readonly ClassInput[]; changes: readonly Change[]; label: string;
}>;

/** Impressão digital estável da base (ordem e campos canônicos). */
export function fingerprintBase(base: readonly ClassInput[]): string {
  const norm = [...base].sort((a, b) => a.classId.localeCompare(b.classId)).map((c) => ({
    c: c.classId, b: c.blocks == null ? null : [...c.blocks].sort((x, y) => x.blockKey.localeCompare(y.blockKey)).map((x) => [x.blockKey, x.componentId, x.minutes, [...x.engagementIds].sort(), x.usable]),
    a: c.assignments == null ? null : [...c.assignments].sort((x, y) => x.assignmentId.localeCompare(y.assignmentId)).map((x) => [x.assignmentId, x.componentId, x.engagementId, x.personId, x.vigente]) }));
  return JSON.stringify(norm);
}

const clone = (b: readonly ClassInput[]): ClassInput[] => JSON.parse(JSON.stringify(b));

export function createScenario(p: { id: string; authorUserId: string; schoolId: string; validOn: string; knownAt: string; label: string; base: readonly ClassInput[]; now?: Date }): Scenario {
  const base = clone(p.base); // congelado: alterar a base real depois não muda o cenário
  return { id: p.id, mode: "simulacao", authorUserId: p.authorUserId, schoolId: p.schoolId, validOn: p.validOn, knownAt: p.knownAt, label: p.label,
    createdAt: (p.now ?? new Date()).toISOString(), baseFingerprint: fingerprintBase(base), base: Object.freeze(base), changes: [] };
}
export const addChange = (s: Scenario, c: Change): Scenario => ({ ...s, changes: [...s.changes, c] });
export const isStale = (s: Scenario, currentBase: readonly ClassInput[] | null) => currentBase == null ? null : fingerprintBase(currentBase) !== s.baseFingerprint;

export class ScenarioError extends Error {}

/** Aplica alterações sobre CÓPIA da base; nunca toca o objeto de entrada. */
export function applyChanges(base: readonly ClassInput[], changes: readonly Change[]): ClassInput[] {
  const w = clone(base) as { classId: string; label: string | null; blocks: Block[] | null; assignments: Assignment[] | null }[];
  const get = (id: string) => { const c = w.find((x) => x.classId === id); if (!c) throw new ScenarioError(`Turma ${id} fora da base do cenário.`); return c; };
  const blocks = (id: string) => { const c = get(id); if (c.blocks == null) throw new ScenarioError(`Grade da turma ${id} não foi lida: não há base para simular.`); return c; };
  for (const ch of changes) switch (ch.kind) {
    case "grade:remover-bloco": { const c = blocks(ch.classId); c.blocks = c.blocks!.filter((b) => b.blockKey !== ch.blockKey); break; }
    case "grade:adicionar-bloco": { const c = blocks(ch.classId); if (c.blocks!.some((b) => b.blockKey === ch.block.blockKey)) throw new ScenarioError("Bloco já existe."); c.blocks!.push(ch.block); break; }
    case "grade:trocar-responsavel": { const c = blocks(ch.classId); c.blocks = c.blocks!.map((b) => b.blockKey === ch.blockKey ? { ...b, engagementIds: ch.engagementIds } : b); break; }
    case "regencia:adicionar": { const c = get(ch.classId); if (c.assignments == null) throw new ScenarioError("Regências não lidas."); c.assignments.push(ch.assignment); break; }
    case "regencia:remover": { const c = get(ch.classId); if (c.assignments == null) throw new ScenarioError("Regências não lidas."); c.assignments = c.assignments.filter((a) => a.assignmentId !== ch.assignmentId); break; }
    case "turma:mover-blocos": { const f = blocks(ch.fromClassId), t = blocks(ch.toClassId);
      const moving = f.blocks!.filter((b) => ch.blockKeys.includes(b.blockKey));
      f.blocks = f.blocks!.filter((b) => !ch.blockKeys.includes(b.blockKey)); t.blocks!.push(...moving); break; }
  }
  return w;
}

export type Comparison = Readonly<{ baseline: Totals; scenario: Totals; delta: { lessons: number | null; demandMinutes: number | null; uncoveredMinutes: number | null };
  baselinePeople: number; scenarioPeople: number }>;
const d = (a: number | null, b: number | null) => (a == null || b == null ? null : b - a);
export function compare(s: Scenario): Comparison {
  const sim = applyChanges(s.base, s.changes);
  const bt = totals(s.base.map(projectClass)), st = totals(sim.map(projectClass));
  return { baseline: bt, scenario: st, delta: { lessons: d(bt.lessons, st.lessons), demandMinutes: d(bt.demandMinutes, st.demandMinutes), uncoveredMinutes: d(bt.uncoveredMinutes, st.uncoveredMinutes) },
    baselinePeople: personLoads(s.base, null).length, scenarioPeople: personLoads(sim, null).length };
}

/** Writer canônico e tela oficial de cada alteração; o cenário só encaminha. */
export const PROMOTION_TARGET: Record<Change["kind"], { writer: string; screen: string }> = {
  "grade:remover-bloco": { writer: "record_class_schedule_version", screen: "/horarios" },
  "grade:adicionar-bloco": { writer: "record_class_schedule_version", screen: "/horarios" },
  "grade:trocar-responsavel": { writer: "record_class_schedule_version", screen: "/horarios" },
  "regencia:adicionar": { writer: "record_teaching_assignment_version", screen: "/turmas" },
  "regencia:remover": { writer: "record_teaching_assignment_version", screen: "/turmas" },
  "turma:mover-blocos": { writer: "record_class_schedule_version", screen: "/horarios" },
};

export type PromotionPayload = Readonly<{ change: Change; writer: string; screen: string }>;
export const classOf = (c: Change) => ("classId" in c ? c.classId : c.fromClassId);

/** Itens de promoção (um por alteração), escopo = escola do cenário; base esperada = impressão da base. */
export function promotionItems(s: Scenario): BulkItem<PromotionPayload>[] {
  return s.changes.map((change, i) => ({ key: `${s.id}#${i}`, scope: s.schoolId, expectedBase: s.baseFingerprint,
    payload: { change, ...PROMOTION_TARGET[change.kind] } }));
}

/** Executores registrados por writer; ausente ⇒ recusa (falha fechada), nunca gravação direta. */
export type Executors = Partial<Record<string, (p: PromotionPayload, idempotencyKey: string) => Promise<void>>>;
export function promotionOperation(currentFingerprint: () => Promise<string | null>, executors: Executors): BulkOperation<PromotionPayload> {
  return { id: "promover-cenario", version: 1, label: "Promover cenário", mode: "parcial", maxItems: 200,
    validate: (i) => executors[i.payload.writer] ? null : `Sem executor registrado para ${i.payload.writer}: aplique pela tela oficial (${i.payload.screen}).`,
    currentBase: async () => currentFingerprint(),
    executeOne: async (i, k) => { const ex = executors[i.payload.writer]; if (!ex) throw new Error("Sem executor."); await ex(i.payload, k); } };
}

/** Armazenamento do cenário: separado de qualquer fonte oficial; excluir não toca fatos. */
export interface ScenarioStore { list(userId: string): Scenario[]; save(s: Scenario): void; remove(userId: string, id: string): void }
export function memoryStore(backing: Map<string, string> = new Map()): ScenarioStore {
  const k = (u: string) => `sigem:simulacao:${u}`;
  const read = (u: string): Scenario[] => JSON.parse(backing.get(k(u)) ?? "[]");
  return {
    list: read,
    save: (s) => backing.set(k(s.authorUserId), JSON.stringify([...read(s.authorUserId).filter((x) => x.id !== s.id), s])),
    remove: (u, id) => backing.set(k(u), JSON.stringify(read(u).filter((x) => x.id !== id))),
  };
}
