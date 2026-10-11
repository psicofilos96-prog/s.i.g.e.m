/**
 * Alimentação Lote 11 — visitas técnicas, educação alimentar e solicitações (modelo puro).
 * Reuso: protocolos pela central única demand-center (área "alimentacao", mesmo fluxo e notificação);
 * evidências no bucket privado alimentacao-evidencias (NAE.8 L2, autorização no banco);
 * oficinas com OP/docentes por referência ao planejamento docente — nada é autoria docente aqui.
 */
import { openDemand, type Demand } from "@/features/school-management/demand-center";

// ---------- Visitas técnicas do nutricionista ----------
export type VisitState = "agendada" | "realizada" | "relatorio-em-revisao" | "concluida" | "cancelada";
export interface Instrument { id: string; version: number; homologated: boolean; items: { key: string; label: string }[] }
export interface Guidance { id: string; text: string; responsible: string | null; due: string | null; verifiedAt: string | null; verifiedBy: string | null }
export interface MealVisit {
  id: string; schoolId: string; nutritionistId: string; nutritionistRegistry: string | null;
  plannedOn: string; state: VisitState; instrument: string | null; // "id@vN" congelado
  answers: Record<string, "conforme" | "nao-conforme" | "nao-se-aplica" | null>;
  evidence: string[]; guidance: Guidance[]; reports: { v: number; text: string; authorId: string; reason: string | null }[];
}

export const evidencePath = (schoolId: string, visitId: string, file: string) => `alimentacao-evidencias/visitas/${schoolId}/${visitId}/${file}`;

export function scheduleVisit(v: Omit<MealVisit, "state" | "answers" | "evidence" | "guidance" | "reports" | "instrument">, inst: Instrument | null, existing: MealVisit[]): MealVisit | { error: string } {
  if (!v.nutritionistRegistry) return { error: "visita técnica só por nutricionista com registro" };
  if (!inst?.homologated) return { error: "instrumento não homologado" };
  if (existing.some((x) => x.schoolId === v.schoolId && x.plannedOn === v.plannedOn && x.nutritionistId === v.nutritionistId && x.state !== "cancelada")) return { error: "visita já agendada" };
  return { ...v, state: "agendada", instrument: `${inst.id}@v${inst.version}`, answers: Object.fromEntries(inst.items.map((i) => [i.key, null])), evidence: [], guidance: [], reports: [] };
}

export function addEvidence(v: MealVisit, file: string): MealVisit | { error: string } {
  if (!/^[\w.-]+$/.test(file)) return { error: "nome de arquivo inválido" };
  return { ...v, evidence: [...v.evidence, evidencePath(v.schoolId, v.id, file)] };
}

export function saveReport(v: MealVisit, text: string, authorId: string, expectedV: number, reason: string | null): MealVisit | { error: string } {
  if ((v.reports.at(-1)?.v ?? 0) !== expectedV) return { error: "versão base desatualizada" };
  if (expectedV > 0 && !reason?.trim()) return { error: "nova versão exige motivo" };
  if (authorId !== v.nutritionistId) return { error: "relatório só pelo nutricionista da visita" };
  return { ...v, reports: [...v.reports, { v: expectedV + 1, text, authorId, reason }] };
}

export function advanceVisit(v: MealVisit, to: VisitState, by: { id: string; isPerson: boolean; registry: string | null }, reason?: string): MealVisit | { error: string } {
  const NEXT: Record<VisitState, VisitState[]> = { agendada: ["realizada", "cancelada"], realizada: ["relatorio-em-revisao"], "relatorio-em-revisao": ["concluida", "realizada"], concluida: [], cancelada: [] };
  if (!by.isPerson) return { error: "transição exige pessoa natural" };
  if (!NEXT[v.state].includes(to)) return { error: `transição ${v.state}→${to} não permitida` };
  if (to === "cancelada" && !reason?.trim()) return { error: "cancelamento exige motivo" };
  if (to === "relatorio-em-revisao" && (!v.reports.length || Object.values(v.answers).some((a) => a == null))) return { error: "instrumento incompleto ou relatório ausente" };
  if (to === "concluida" && (!by.registry || by.id === v.nutritionistId)) return { error: "conclusão por nutricionista revisor distinto do autor" };
  return { ...v, state: to };
}

/** Verificação de orientação: só por pessoa com evidência; vencidas sem verificação ficam listadas. */
export function verifyGuidance(g: Guidance, by: string, at: string, evidence: string | null): Guidance | { error: string } {
  if (!evidence) return { error: "verificação exige evidência" };
  return { ...g, verifiedAt: at, verifiedBy: by };
}
export const overdueGuidance = (v: MealVisit, on: string) => v.guidance.filter((g) => g.due && g.due < on && !g.verifiedAt);

// ---------- Educação alimentar ----------
export interface EduProject { id: string; schoolId: string; title: string; classIds: string[]; partners: { kind: "op" | "docente"; engagementId: string }[]; sessions: { on: string; done: boolean | null }[]; planRef: string | null }
export function eduProblems(p: EduProject, activeEngagements: Set<string>): string[] {
  const e: string[] = [];
  if (!p.title.trim()) e.push("título obrigatório");
  if (!p.classIds.length) e.push("ao menos uma turma");
  if (!p.partners.some((x) => x.kind === "docente")) e.push("projeto exige docente parceiro (autoria pedagógica é dele)");
  for (const x of p.partners) if (!activeEngagements.has(x.engagementId)) e.push(`atuação ${x.engagementId} não vigente na escola`);
  return e;
}
export const eduProgress = (p: EduProject) => ({ planned: p.sessions.length, done: p.sessions.filter((s) => s.done === true).length, notInformed: p.sessions.filter((s) => s.done == null).length });

// ---------- Central de solicitações (sobre demand-center) ----------
export const MEAL_REQUEST_KINDS = ["reposicao", "equipamento", "manutencao", "entrega", "cardapio", "formacao", "ocorrencia"] as const;
export type MealRequestKind = (typeof MEAL_REQUEST_KINDS)[number];
export function openMealRequest(input: { id: string; schoolId: string; kind: MealRequestKind; urgent: boolean; urgencyReason: string | null; description: string }, by: string, isPerson: boolean, on: string, attachments: string[] = []) {
  if (!MEAL_REQUEST_KINDS.includes(input.kind)) return { ok: false as const, code: "tipo de solicitação desconhecido" };
  if (!input.description.trim()) return { ok: false as const, code: "descrição obrigatória" };
  const d = openDemand({ id: input.id, schoolId: input.schoolId, area: "alimentacao", urgent: input.urgent, urgencyReason: input.urgencyReason }, by, isPerson, on, attachments);
  return { ...d, kind: input.kind } as typeof d & { kind: MealRequestKind };
}
export type MealRequest = Demand & { kind: MealRequestKind };
