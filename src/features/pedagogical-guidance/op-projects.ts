/**
 * OP por escola — LOTE 14 (projetos pedagógicos).
 * Projeto = cadeia append-only de versões por logicalId (seq contínuo, base esperada, motivo a partir da v2).
 * Escopo: "escola" (orientador da unidade da própria escola) × "rede" (coordenação central; escolas aderem).
 * Tarefas reaproveitam a Central de tarefas (sourceKind "op-projeto", dedupeKey estável) — nunca lista própria.
 * Reaproveitamento de projeto concluído = nova instância com origem; resultados/evidências nunca são copiados.
 */
import { decideOpAccess, type OpDesignation } from "./op-designations";
import { dedupeKey } from "../tasks/task-model";

export type ProjectScope = "escola" | "rede";
export type ProjectStatus = "rascunho" | "em-execucao" | "concluido" | "cancelado";
export interface ProjectActivity { id: string; title: string; from: string; to: string; responsibleEngagementId: string | null }
export interface ProjectIndicator { id: string; label: string; source: string | null } // fonte ausente ⇒ indicador sem leitura
export interface ProjectEvidence { id: string; ref: string; activityId: string | null; recordedBy: string }
export interface ProjectResult { indicatorId: string; value: string | null; evidenceIds: string[]; observedOn: string }
export interface ProjectContent {
  title: string; objectives: string[]; audience: string; schoolIds: string[];
  responsibleEngagementIds: string[]; from: string; to: string;
  activities: ProjectActivity[]; resources: string[]; indicators: ProjectIndicator[];
  evidences: ProjectEvidence[]; results: ProjectResult[]; status: ProjectStatus;
}
export interface ProjectVersion {
  id: string; logicalId: string; version: number; scope: ProjectScope; ownerSchoolId: string | null;
  content: ProjectContent; reason: string | null; authorPersonId: string; recordedAt: string;
  copiedFromLogicalId: string | null; idempotencyKey: string;
}

const PUNITIVE = /(advert[êe]ncia|suspens[ãa]o|san[çc][ãa]o|avalia[çc][ãa]o funcional|est[áa]gio probat[óo]rio|reten[çc][ãa]o|reprova)/i;

/** Validação de conteúdo: não conclui nada sem dado; impedimentos por extenso. */
export function validateContent(scope: ProjectScope, owner: string | null, c: ProjectContent): string[] {
  const e: string[] = [];
  if (!c.title.trim()) e.push("Título obrigatório.");
  if (c.objectives.filter((o) => o.trim()).length === 0) e.push("Ao menos um objetivo.");
  if (!c.audience.trim()) e.push("Público obrigatório.");
  if (c.responsibleEngagementIds.length === 0) e.push("Ao menos um responsável (atuação).");
  if (!(c.from <= c.to)) e.push("Período inválido.");
  if (scope === "escola" && (c.schoolIds.length !== 1 || c.schoolIds[0] !== owner)) e.push("Projeto escolar pertence a uma única escola, a do orientador.");
  if (scope === "rede" && c.schoolIds.length === 0) e.push("Projeto da rede declara escolas participantes.");
  for (const a of c.activities) if (!(c.from <= a.from && a.from <= a.to && a.to <= c.to)) e.push(`Atividade "${a.title}" fora do período do projeto.`);
  const ev = new Set(c.evidences.map((x) => x.id));
  for (const r of c.results) {
    if (!c.indicators.some((i) => i.id === r.indicatorId)) e.push("Resultado sem indicador declarado.");
    if (r.value !== null && r.evidenceIds.length === 0) e.push("Resultado exige evidência anexada.");
    if (r.evidenceIds.some((id) => !ev.has(id))) e.push("Resultado cita evidência inexistente.");
  }
  if (c.evidences.some((x) => !x.ref.trim())) e.push("Evidência exige referência.");
  if (c.status === "concluido" && c.results.length === 0) e.push("Concluir exige resultado registrado (ainda que sem valor, com observação).");
  const text = [c.title, c.audience, ...c.objectives].join(" ");
  if (PUNITIVE.test(text)) e.push("Projeto pedagógico não produz ato funcional, disciplinar ou de trajetória.");
  return e;
}

/** Projeção: cadeia inválida (seq, escopo/dono alterado, motivo ausente, edição após encerramento) é recusada inteira. */
export function projectProjects(versions: ProjectVersion[]): { list: { head: ProjectVersion; history: ProjectVersion[] }[]; rejected: string[] } {
  const by = new Map<string, ProjectVersion[]>();
  for (const v of versions) by.set(v.logicalId, [...(by.get(v.logicalId) ?? []), v]);
  const list: { head: ProjectVersion; history: ProjectVersion[] }[] = []; const rejected: string[] = [];
  for (const [lid, ch] of by) {
    const s = [...ch].sort((a, b) => a.version - b.version);
    const ok = s.every((v, i) => v.version === i + 1
      && v.scope === s[0]!.scope && v.ownerSchoolId === s[0]!.ownerSchoolId
      && (i === 0 || (!!v.reason?.trim() && !["concluido", "cancelado"].includes(s[i - 1]!.content.status))));
    if (!ok) { rejected.push(lid); continue; }
    list.push({ head: s[s.length - 1]!, history: s });
  }
  return { list, rejected };
}

export interface RecordProjectInput {
  personNatural: boolean; personId: string; date: string; scope: ProjectScope; ownerSchoolId: string | null;
  logicalId: string; expectedVersion: number; content: ProjectContent; reason: string | null;
  idempotencyKey: string; copiedFromLogicalId: string | null;
  designations: OpDesignation[]; capabilities: { id: string; scope: "escola" | "rede"; schoolId: string | null }[];
  existing: ProjectVersion[];
}
export type RecordResult = { ok: true; version: ProjectVersion; replay: boolean } | { ok: false; reasons: string[] };

export const NETWORK_PROJECT_CAP = "coordenar-projetos-pedagogicos-rede";

/** Executor estreito: idempotente, base esperada, competência por escopo; fail-closed. */
export function recordProjectVersion(i: RecordProjectInput, newId: string, now: string): RecordResult {
  const replay = i.existing.find((v) => v.idempotencyKey === i.idempotencyKey);
  if (replay) return replay.logicalId === i.logicalId ? { ok: true, version: replay, replay: true } : { ok: false, reasons: ["Chave idempotente reutilizada em outro projeto."] };
  const reasons: string[] = [];
  if (!i.personNatural) reasons.push("Executor técnico não é autor de projeto.");
  if (i.scope === "escola") {
    if (!i.ownerSchoolId) reasons.push("Projeto escolar exige escola.");
    else { const a = decideOpAccess({ personNatural: i.personNatural, personId: i.personId, date: i.date, schoolId: i.ownerSchoolId, classId: null, granularity: "agregado", action: "registrar", purpose: "acompanhamento", designations: i.designations, capabilities: i.capabilities });
      if (!a.ok) reasons.push(a.reason); }
  } else {
    if (i.ownerSchoolId !== null) reasons.push("Projeto da rede não pertence a uma escola.");
    const live = i.designations.some((d) => d.personId === i.personId && d.role === "coordenacao-central-op" && d.from <= i.date && (d.to === null || i.date <= d.to));
    if (!live) reasons.push("Sem designação vigente da coordenação central.");
    if (!i.capabilities.some((c) => c.id === NETWORK_PROJECT_CAP && c.scope === "rede")) reasons.push("Capacidade de rede para projetos não homologada.");
  }
  const chain = i.existing.filter((v) => v.logicalId === i.logicalId).sort((a, b) => a.version - b.version);
  const head = chain[chain.length - 1];
  if ((head?.version ?? 0) !== i.expectedVersion) reasons.push("Base esperada divergente: outra versão foi gravada.");
  if (head && (head.scope !== i.scope || head.ownerSchoolId !== i.ownerSchoolId)) reasons.push("Escopo e escola do projeto são imutáveis.");
  if (head && ["concluido", "cancelado"].includes(head.content.status)) reasons.push("Projeto encerrado não é editado; reaproveite como nova instância.");
  if (head && !i.reason?.trim()) reasons.push("Nova versão exige motivo.");
  if (head) {
    // evidências e resultados já registrados nunca somem silenciosamente
    const keep = (prev: { id?: string }[], next: { id?: string }[]) => prev.every((p) => next.some((n) => n.id === p.id));
    if (!keep(head.content.evidences, i.content.evidences)) reasons.push("Evidência registrada não pode ser removida.");
    if (!head.content.results.every((r) => i.content.results.some((n) => n.indicatorId === r.indicatorId && n.observedOn === r.observedOn))) reasons.push("Resultado registrado não pode ser removido.");
    if (i.content.evidences.some((e) => !head.content.evidences.some((p) => p.id === e.id) && e.recordedBy !== i.personId)) reasons.push("Evidência nova só em nome de quem grava.");
  }
  reasons.push(...validateContent(i.scope, i.ownerSchoolId, i.content));
  if (reasons.length) return { ok: false, reasons };
  return { ok: true, replay: false, version: { id: newId, logicalId: i.logicalId, version: i.expectedVersion + 1, scope: i.scope, ownerSchoolId: i.ownerSchoolId,
    content: i.content, reason: head ? i.reason : null, authorPersonId: i.personId, recordedAt: now, copiedFromLogicalId: head ? head.copiedFromLogicalId : i.copiedFromLogicalId, idempotencyKey: i.idempotencyKey } };
}

/** Reaproveitamento: só de projeto concluído; copia estrutura, nunca datas, responsáveis, evidências ou resultados. */
export function reuseProject(src: ProjectVersion, target: { scope: ProjectScope; ownerSchoolId: string | null }): { ok: true; content: ProjectContent; copiedFromLogicalId: string } | { ok: false; reason: string } {
  if (src.content.status !== "concluido") return { ok: false, reason: "Só projeto concluído é reaproveitado." };
  const c = src.content;
  return { ok: true, copiedFromLogicalId: src.logicalId, content: {
    title: c.title, objectives: [...c.objectives], audience: c.audience,
    schoolIds: target.scope === "escola" && target.ownerSchoolId ? [target.ownerSchoolId] : [],
    responsibleEngagementIds: [], from: "", to: "",
    activities: [], resources: [...c.resources],
    indicators: c.indicators.map((x) => ({ ...x })), evidences: [], results: [], status: "rascunho" } };
}

/** Cronograma: atividades ordenadas; "sem responsável" é pendência, nunca atraso presumido. */
export function projectSchedule(c: ProjectContent, today: string) {
  return [...c.activities].sort((a, b) => a.from.localeCompare(b.from)).map((a) => ({
    ...a, situation: a.responsibleEngagementId === null ? "sem-responsavel" : today < a.from ? "prevista" : today <= a.to ? "em-curso" : "periodo-encerrado",
    hasEvidence: c.evidences.some((e) => e.activityId === a.id),
  }));
}

/** Tarefas vão para a Central de tarefas existente (mesma dedupeKey ⇒ sem duplicidade). */
export function projectTaskDrafts(p: ProjectVersion, schoolId: string) {
  if (!p.content.schoolIds.includes(schoolId)) return [];
  return p.content.activities.filter((a) => a.responsibleEngagementId).map((a) => ({
    schoolId, title: a.title, dueOn: a.to, assigneeEngagement: a.responsibleEngagementId!,
    sourceKind: "op-projeto", sourceRef: `${p.logicalId}:${a.id}`,
    dedupeKey: dedupeKey(schoolId, "op-projeto", `${p.logicalId}:${a.id}`, a.title, "v1"),
  }));
}

/** Visões: escola vê os próprios + os da rede em que participa; central vê os da rede e só contagem dos escolares. */
export function projectsFor(viewer: { kind: "escola"; schoolId: string } | { kind: "central" }, list: ProjectVersion[]) {
  if (viewer.kind === "escola") return { visible: list.filter((p) => p.ownerSchoolId === viewer.schoolId || (p.scope === "rede" && p.content.schoolIds.includes(viewer.schoolId))), schoolProjectCount: null };
  const n = list.filter((p) => p.scope === "escola").length;
  return { visible: list.filter((p) => p.scope === "rede"), schoolProjectCount: n > 0 && n < 5 ? "suprimido" as const : n };
}
