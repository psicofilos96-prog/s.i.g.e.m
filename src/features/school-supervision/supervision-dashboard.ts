// Supervisão Escolar — Lote 02: painel da rede e Dossiê Institucional (projeção pura).
// Escolas vêm do escopo de supervision-access (atribuição vigente); fatos vêm dos readers
// canônicos lidos com a sessão (school_supervision_records_at, cadastro da unidade, matrícula,
// turmas, calendário, quadro funcional, documentos). Nada é gravado nem copiado.
import { accessLevel, type AssignmentEvent, type Viewer } from "./supervision-access";

export type CellState = "registrado" | "zero" | "nao-registrado" | "sem-permissao";
export interface Cell { state: CellState; value: number | null; source: string; drill: string[] }
export interface Read<T> { status: "read" | "denied" | "not-read"; rows: T[]; source: string }

function cell<T extends { id: string }>(r: Read<T>, pred: (x: T) => boolean = () => true): Cell {
  if (r.status === "denied") return { state: "sem-permissao", value: null, source: r.source, drill: [] };
  if (r.status === "not-read") return { state: "nao-registrado", value: null, source: r.source, drill: [] };
  const rows = r.rows.filter(pred);
  return { state: rows.length ? "registrado" : "zero", value: rows.length, source: r.source, drill: rows.map((x) => x.id) };
}

export interface SchoolRef { schoolId: string; name: string; inep: string | null; region: string | null }
export interface SupItem { id: string; schoolId: string; date: string | null; kind: "visita" | "relatorio" | "orientacao" | "nao-conformidade" | "plano"; status: "prevista" | "realizada" | "pendente" | "aberta" | "encerrada"; supervisorPrincipalId: string; due: string | null }

export interface DashboardFilter { from: string; to: string; supervisorPrincipalId: string | null; region: string | null; schoolId: string | null; on: string }

/** Escolas visíveis = atribuídas na data e dentro dos filtros; sem acesso a escola some, nunca aparece com zero. */
export function visibleSchools(schools: SchoolRef[], events: AssignmentEvent[], viewer: Viewer, f: DashboardFilter): SchoolRef[] {
  return schools.filter((s) => accessLevel(events, viewer, s.schoolId, f.on) !== "nenhum" && (!f.region || s.region === f.region) && (!f.schoolId || s.schoolId === f.schoolId));
}

export function supervisionDashboard(schools: SchoolRef[], items: Read<SupItem>, f: DashboardFilter) {
  const ids = new Set(schools.map((s) => s.schoolId));
  const inScope = (x: SupItem) => ids.has(x.schoolId) && (!f.supervisorPrincipalId || x.supervisorPrincipalId === f.supervisorPrincipalId) && (x.date == null || (x.date >= f.from && x.date <= f.to));
  const k = (kind: SupItem["kind"], st?: SupItem["status"]) => (x: SupItem) => inScope(x) && x.kind === kind && (!st || x.status === st);
  return {
    escolas: { state: schools.length ? "registrado" : "zero", value: schools.length, source: "atribuições vigentes", drill: schools.map((s) => s.schoolId) } as Cell,
    visitasPrevistas: cell(items, k("visita", "prevista")),
    visitasRealizadas: cell(items, k("visita", "realizada")),
    relatoriosPendentes: cell(items, k("relatorio", "pendente")),
    orientacoes: cell(items, k("orientacao")),
    naoConformidades: cell(items, k("nao-conformidade", "aberta")),
    planos: cell(items, k("plano", "aberta")),
    // prazo vencido só com prazo declarado; sem prazo não entra
    prazosVencidos: cell(items, (x) => inScope(x) && x.due != null && x.due < f.on && x.status !== "encerrada" && x.status !== "realizada"),
  };
}

// ---------- Dossiê Institucional ----------
export interface DossierSources {
  identity: { name: string; inep: string | null; asOf: string | null } | null;
  team: Read<{ id: string; role: string }>;
  enrollments: Read<{ id: string; active: boolean }>;
  classes: Read<{ id: string }>;
  calendar: { applicable: "um" | "nenhum" | "varios"; versionId: string | null; schoolDays: number | null } | null;
  staff: Read<{ id: string }>;
  documents: Read<{ id: string }>;
  supervision: Read<SupItem>;
  indicators: { key: string; value: number | null; formula: string; source: string }[];
  history: { date: string | null; label: string; ref: string }[];
}

export function institutionalDossier(school: SchoolRef, s: DossierSources) {
  const sup = (kind: SupItem["kind"]) => cell(s.supervision, (x) => x.kind === kind);
  return {
    identificacao: s.identity ? { name: s.identity.name, inep: s.identity.inep ?? "INEP não registrado", asOf: s.identity.asOf } : { name: school.name, inep: school.inep ?? "INEP não registrado", asOf: null },
    equipe: cell(s.team),
    matriculasAtivas: cell(s.enrollments, (x) => x.active),
    turmas: cell(s.classes),
    calendario: !s.calendar ? { state: "nao-registrado" as const, text: "calendário não lido" }
      : s.calendar.applicable === "nenhum" ? { state: "nao-registrado" as const, text: "sem calendário aplicável" }
      : s.calendar.applicable === "varios" ? { state: "nao-registrado" as const, text: "mais de um calendário aplicável: bloqueado" }
      : { state: "registrado" as const, text: `versão ${s.calendar.versionId}`, schoolDays: s.calendar.schoolDays },
    quadroDePessoal: cell(s.staff),
    documentos: cell(s.documents),
    visitas: sup("visita"),
    orientacoes: sup("orientacao"),
    planos: sup("plano"),
    indicadores: s.indicators.map((i) => ({ ...i, label: i.value == null ? "não apurado" : String(i.value) })),
    historico: [...s.history].sort((a, b) => (a.date == null ? 1 : b.date == null ? -1 : a.date.localeCompare(b.date))),
  };
}
