// SIGEM 2.0 A&A Lote 18 — Agenda, segurança e integração. Núcleo puro.
// Agenda reaproveita o calendário operacional (aa-calendar, 0367); acesso é matriz
// declarada sobre capabilities homologadas (função = rótulo, nunca autorização).
import { projectCalendar, KIND_LABEL, type CalItem, type StatusEv } from "./aa-calendar";

export const AGENDA_KINDS = ["aplicacao", "correcao", "conferencia", "reuniao", "intervencao", "reavaliacao", "entrega"] as const;
export type AgendaKind = (typeof AGENDA_KINDS)[number];
export const AGENDA_LABEL: Record<AgendaKind, string> = { aplicacao: KIND_LABEL.aplicacao!, correcao: "Correção", conferencia: "Conferência", reuniao: "Reunião", intervencao: "Intervenção", reavaliacao: "Reavaliação", entrega: "Entrega" };

export function agenda(items: CalItem[], statuses: StatusEv[], today: string, warnDays: number, year: number, kinds: ReadonlySet<AgendaKind> = new Set(AGENDA_KINDS)) {
  const unknown = items.filter(i => !(AGENDA_KINDS as readonly string[]).includes(i.kind) && !(i.kind in KIND_LABEL)).length;
  const views = projectCalendar(items, statuses, today, warnDays, year).filter(v => !(AGENDA_KINDS as readonly string[]).includes(v.current.kind) || kinds.has(v.current.kind as AgendaKind));
  return { views, notes: unknown ? [`${unknown} item(ns) de tipo não catalogado exibidos sem rótulo traduzido`] : [] };
}

// ---- Acesso ----
export type Level = "rede" | "escola" | "turma" | "alocacao";
export type Data = "agregado" | "nominal" | "gabarito" | "exportacao" | "publicacao" | "correcao";
export type Grant = { capability: string; level: Level; scopeIds: readonly string[]; validFrom: string; validTo: string | null };
export type Request = { data: Data; at: string; target: { schoolId: string; classId?: string; studentId?: string }; purpose: string | null; allocations: readonly { studentId: string; classId: string; schoolId: string; from: string; to: string | null }[] };

export const CAP_FOR: Record<Data, string> = {
  agregado: "consultar-acompanhamento-avaliacao", nominal: "consultar-avaliacao-nominal", gabarito: "consultar-gabarito",
  exportacao: "exportar-acompanhamento-avaliacao", publicacao: "publicar-resultado-avaliacao", correcao: "retificar-resultado-avaliacao",
};
// Função → capabilities propostas. Sem política homologada, nada vale.
export const PROPOSED_ROLES: Record<string, Data[]> = {
  coordenacao: ["agregado", "nominal", "exportacao", "publicacao"], equipe: ["agregado", "nominal"], analista: ["agregado", "exportacao"],
  docente: ["agregado", "nominal", "correcao"], orientacao: ["agregado", "nominal"], direcao: ["agregado", "nominal"],
  supervisao: ["agregado"], ciece: ["agregado"], nei: ["nominal"], familia: ["nominal"],
};

function covers(g: Grant, r: Request): boolean {
  if (r.at < g.validFrom || (g.validTo && r.at > g.validTo)) return false;
  if (g.level === "rede") return true;
  if (g.level === "escola") return g.scopeIds.includes(r.target.schoolId);
  const alloc = r.target.studentId ? r.allocations.filter(a => a.studentId === r.target.studentId && a.from <= r.at && (!a.to || r.at <= a.to)) : [];
  if (g.level === "turma") return r.target.studentId ? alloc.some(a => g.scopeIds.includes(a.classId)) : !!r.target.classId && g.scopeIds.includes(r.target.classId);
  return !!r.target.studentId && g.scopeIds.includes(r.target.studentId) && alloc.length > 0; // família/NEI: estudante vinculado com alocação vigente
}

export function authorize(grants: readonly Grant[], r: Request, homologated: boolean): { ok: true } | { ok: false; reason: string } {
  if (!homologated) return { ok: false, reason: "sem política homologada: perfis são proposta" };
  const need = CAP_FOR[r.data];
  if (!grants.some(g => g.capability === need && covers(g, r))) return { ok: false, reason: "acesso não autorizado" }; // negação uniforme
  if ((r.data === "nominal" || r.data === "exportacao") && !r.purpose?.trim()) return { ok: false, reason: "finalidade obrigatória" };
  if (r.data === "nominal" && !r.target.studentId) return { ok: false, reason: "acesso nominal é individual" };
  return { ok: true };
}

// ---- Integração canônica: A&A só lê; cada fonte grava no próprio writer ----
export const INTEGRATIONS = [
  { sector: "Secretaria", reads: ["enturmação", "matrícula"], via: "rosterStudents / class_enrollment_episodes", writes: false },
  { sector: "Docente", reads: ["instrumentos", "pauta", "frequência"], via: "register_assessment_results / Diário", writes: false },
  { sector: "Orientação", reads: ["acompanhamento", "intervenção"], via: "school_pedagogical_records_at", writes: false },
  { sector: "NEI", reads: ["sinalização de apoio (sem conteúdo clínico)"], via: "inclusion_teaching_support_flags", writes: false },
  { sector: "CIECE", reads: ["indicadores agregados"], via: "queryAnalytic", writes: false },
] as const;

// ---- Auditoria de exportação, publicação e correção ----
export type AuditEvent = { kind: "exportacao" | "publicacao" | "correcao"; actorPersonId: string; at: string; objectRef: string; purpose: string | null; reason: string | null; sha256: string | null; idempotencyKey: string };

export function auditEvent(e: Omit<AuditEvent, "idempotencyKey">): AuditEvent | { refused: string } {
  if (!e.actorPersonId) return { refused: "auditoria exige pessoa natural" };
  if (e.kind === "exportacao" && (!e.sha256 || !e.purpose?.trim())) return { refused: "exportação exige hash e finalidade antes do download" };
  if (e.kind === "correcao" && !e.reason?.trim()) return { refused: "correção exige motivo" };
  if (e.kind === "publicacao" && !e.sha256) return { refused: "publicação exige hash do conteúdo" };
  return { ...e, idempotencyKey: `${e.kind}:${e.objectRef}:${e.sha256 ?? e.reason}:${e.actorPersonId}` };
}
