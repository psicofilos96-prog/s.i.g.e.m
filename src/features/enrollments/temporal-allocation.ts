/**
 * Rede/Matrículas/Vagas L13 — Enturmação temporal (integração com o mecanismo oficial B3/13C).
 * Este módulo NÃO grava: valida e devolve plano para os writers canônicos (alocação/encerramento B3).
 * Valida: matrícula vigente em todo o intervalo, turma ativa no período, posição individual do estudante
 * compatível com a composição homologada da turma, capacidade autorizada (L03) na data, sobreposição
 * conforme cardinalidade declarada por política. Troca de turma = plano atômico (encerra origem + abre destino).
 */
export interface Interval { from: string; to: string | null } // inclusivo; null = aberto
export interface Allocation { id: string; participationId: string; classId: string; interval: Interval }
export interface AllocContext {
  enrollment: { participationId: string; interval: Interval; active: boolean } | null;
  classInfo: { classId: string; activeInterval: Interval; compositionPositions: readonly string[] | null } | null;
  studentPosition: string | null | undefined;  // B3.3; undefined = não lido
  authorizedCapacity: number | null;           // L03 na data; null = sem autorização
  occupantsOnDate: readonly string[] | null;   // participationIds alocados na turma na data; null = não lido
  existing: readonly Allocation[] | null;      // alocações da participação; null = não lido
}
export interface AllocPolicy { maxConcurrentPerParticipation: number | null }
export interface AllocActor { personId: string | null; isHuman: boolean; isTechnicalExecutor?: boolean; capabilities: readonly string[]; requiredCapability: string | null }

const covers = (outer: Interval, inner: Interval) => outer.from <= inner.from && (outer.to === null || (inner.to !== null && inner.to <= outer.to));
export const overlaps = (a: Interval, b: Interval) => a.from <= (b.to ?? "9999-12-31") && b.from <= (a.to ?? "9999-12-31");
const dayBefore = (d: string) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };

export type PlanStep = { writer: "end_class_allocation"; allocationId: string; endOn: string } | { writer: "record_class_allocation"; participationId: string; classId: string; interval: Interval };
export type AllocResult = { ok: true; plan: PlanStep[] } | { ok: false; reasons: string[] };

export function planAllocation(input: { classId: string; interval: Interval; moveFromAllocationId?: string }, ctx: AllocContext, pol: AllocPolicy, actor: AllocActor): AllocResult {
  const r: string[] = [];
  if (!actor.isHuman || !actor.personId || actor.isTechnicalExecutor) r.push("Exige pessoa natural; executor técnico não enturma.");
  if (!actor.requiredCapability || !actor.capabilities.includes(actor.requiredCapability)) r.push("Competência não configurada ou ausente.");
  if (input.interval.to !== null && input.interval.to < input.interval.from) r.push("Intervalo inválido.");
  const e = ctx.enrollment;
  if (!e) r.push("Matrícula não lida.");
  else if (!e.active || !covers(e.interval, input.interval)) r.push("Matrícula não vigente em todo o intervalo.");
  const c = ctx.classInfo;
  if (!c || c.classId !== input.classId) r.push("Turma não lida.");
  else {
    if (!covers(c.activeInterval, input.interval)) r.push("Turma inativa em parte do intervalo.");
    if (c.compositionPositions === null) r.push("Composição da turma não declarada.");
    else if (ctx.studentPosition === undefined) r.push("Posição curricular do estudante não lida.");
    else if (ctx.studentPosition === null) r.push("Estudante sem posição curricular registrada.");
    else if (!c.compositionPositions.includes(ctx.studentPosition)) r.push("Etapa/ano do estudante incompatível com a turma.");
  }
  if (ctx.authorizedCapacity === null) r.push("Sem capacidade autorizada vigente.");
  else if (ctx.occupantsOnDate === null) r.push("Ocupação não lida.");
  else if (e && new Set(ctx.occupantsOnDate.filter((p) => p !== e.participationId)).size >= ctx.authorizedCapacity) r.push("Turma sem vaga autorizada na data.");
  if (ctx.existing === null) r.push("Alocações existentes não lidas.");
  if (pol.maxConcurrentPerParticipation === null) r.push("Cardinalidade não declarada por política.");
  const plan: PlanStep[] = [];
  if (ctx.existing && e && pol.maxConcurrentPerParticipation !== null) {
    let concurrent = ctx.existing.filter((a) => overlaps(a.interval, input.interval));
    if (input.moveFromAllocationId) {
      const origin = ctx.existing.find((a) => a.id === input.moveFromAllocationId);
      if (!origin) r.push("Turma de origem não encontrada.");
      else if (origin.classId === input.classId) r.push("Origem e destino são a mesma turma.");
      else if (origin.interval.from >= input.interval.from) r.push("Mudança anterior ao início da origem: use retificação.");
      else { plan.push({ writer: "end_class_allocation", allocationId: origin.id, endOn: dayBefore(input.interval.from) }); concurrent = concurrent.filter((a) => a.id !== origin.id); }
    }
    if (concurrent.some((a) => a.classId === input.classId)) r.push("Já enturmado nesta turma no intervalo.");
    if (concurrent.length + 1 > pol.maxConcurrentPerParticipation) r.push("Sobreposição acima da cardinalidade permitida.");
  }
  if (r.length) return { ok: false, reasons: r };
  plan.push({ writer: "record_class_allocation", participationId: e!.participationId, classId: input.classId, interval: input.interval });
  return { ok: true, plan };
}

/** Histórico de turmas da participação, ordenado; nada é apagado ao mudar de turma. */
export const allocationHistory = (all: readonly Allocation[], participationId: string) =>
  all.filter((a) => a.participationId === participationId).sort((a, b) => a.interval.from.localeCompare(b.interval.from));
