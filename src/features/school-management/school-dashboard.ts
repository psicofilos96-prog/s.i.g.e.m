// SIGEM 2.0 — Direção, Lote 02: métricas do painel, Ficha da Unidade e Diagnóstico Automático (núcleo puro).
// Estende `management-panel.ts` (mesmos estados); cada métrica declara fórmula, fonte, data e drill-down.
// "não registrado" (sem fonte/sem fato) ≠ zero observado. Nada é gravado; ficha só lê o cadastro canônico.
import type { BlockState, Probe } from "./management-panel";

export interface MetricDef { key: string; label: string; formula: string; source: string; drill: string; needsCalendar?: boolean }

export const METRICS: readonly MetricDef[] = [
  { key: "matriculados", label: "Alunos matriculados", formula: "matrículas com início ≤ data e sem término", source: "secretariat_overview_at", drill: "/secretaria" },
  { key: "turmas", label: "Turmas", formula: "turmas ativas na data (class_at)", source: "classes_with_period_link_at", drill: "/turmas" },
  { key: "docentes", label: "Docentes em exercício", formula: "pessoas com atribuição docente vigente", source: "teaching_assignments_at", drill: "/horarios" },
  { key: "servidores", label: "Servidores em exercício", formula: "lotações vigentes na escola na data", source: "school_staff_presence", drill: "/docserv" },
  { key: "frequencia", label: "Frequência", formula: "presenças ÷ registros marcados (sem marcação fica fora)", source: "attendance_record_versions", drill: "/diario", needsCalendar: true },
  { key: "infrequentes", label: "Infrequência", formula: "estudantes abaixo do limiar homologado", source: "aa_infrequency_at", drill: "/busca-ativa" },
  { key: "aulas-descobertas", label: "Aulas descobertas", formula: "blocos de grade sem atuação vigente", source: "class_schedule_at", drill: "/horarios" },
  { key: "dias-letivos", label: "Dias letivos confirmados", formula: "dias com efeito letivo declarado até a data", source: "calendar_days_at", drill: "/calendario", needsCalendar: true },
  { key: "solicitacoes", label: "Solicitações abertas", formula: "protocolos/pedidos sem desfecho", source: "workflow (pendências)", drill: "/pendencias" },
];

export type MetricReading = { value: number; asOf: string } | { recorded: false; reason: string };

export interface MetricView { def: MetricDef; state: BlockState; value: number | null; asOf: string | null; note: string }

/** Probe falha ⇒ UNAVAILABLE/UNKNOWN; sem registro ⇒ UNKNOWN "não registrado"; 0 só se observado. */
export function metricView(def: MetricDef, p: Probe<MetricReading> | undefined, ctx: { calendarResolved: boolean; thresholdHomologated: boolean }): MetricView {
  const base = { def, value: null, asOf: null };
  if (def.needsCalendar && !ctx.calendarResolved) return { ...base, state: "BLOCKED", note: "calendário oficial não resolvido para a escola" };
  if (def.key === "infrequentes" && !ctx.thresholdHomologated) return { ...base, state: "BLOCKED", note: "limiar de infrequência não homologado" };
  if (!p) return { ...base, state: "UNKNOWN", note: "fonte não lida" };
  if (!p.ok) return { ...base, state: /permission|42501|denied/i.test(p.error) ? "UNAVAILABLE" : "UNKNOWN", note: "fonte indisponível" };
  if ("recorded" in p.data) return { ...base, state: "UNKNOWN", note: `não registrado: ${p.data.reason}` };
  return { def, value: p.data.value, asOf: p.data.asOf, state: p.data.value === 0 ? "ZERO" : "AVAILABLE", note: `${def.formula} · ${def.source} · ${p.data.asOf}` };
}

/** Filtro: ano é obrigatório; período só se pertencer ao ano escolhido. */
export function dashboardFilter(f: { year: number | null; periodId: string | null }, periods: { id: string; year: number }[]) {
  if (f.year == null) return { ok: false as const, code: "painel:ano-obrigatorio" };
  if (f.periodId && !periods.some((p) => p.id === f.periodId && p.year === f.year)) return { ok: false as const, code: "painel:periodo-fora-do-ano" };
  return { ok: true as const };
}

// ── Ficha da Unidade (uma por INEP; só leitura; edição pelo setor competente) ──
export interface SchoolRecord { schoolId: string; inep: string | null; name: string; address: string | null; offers: string[] | null; shifts: string[] | null;
  team: { role: string; designationGrantId: string }[]; history: { versionId: string; validFrom: string; changed: string[] }[] }

export function schoolFicha(records: SchoolRecord[], inep: string) {
  const hits = records.filter((r) => r.inep === inep);
  if (hits.length === 0) return { ok: false as const, code: "ficha:inep-nao-encontrado" };
  if (hits.length > 1) return { ok: false as const, code: "ficha:inep-duplicado", schoolIds: hits.map((h) => h.schoolId) };
  const r = hits[0]!;
  const show = <T,>(v: T | null) => (v == null || (Array.isArray(v) && v.length === 0) ? "não registrado" : v);
  return { ok: true as const, ficha: { ...r, address: show(r.address), offers: show(r.offers), shifts: show(r.shifts),
    editPath: "/administracao", editCapability: "manter-cadastro-unidade-escolar", editableHere: false } };
}

// ── Diagnóstico Automático: só invariantes rastreáveis às métricas lidas; sem score nem inferência ──
export interface Finding { id: string; priority: "alta" | "media"; text: string; evidence: string; link: string }

export function diagnose(views: MetricView[], ruleOrder: string[] | null): { findings: Finding[]; note: string | null } {
  const f: Finding[] = [];
  for (const v of views) {
    if (v.state === "BLOCKED") f.push({ id: `bloq:${v.def.key}`, priority: "alta", text: `${v.def.label}: ${v.note}`, evidence: v.def.source, link: v.def.drill });
    else if (v.state === "UNKNOWN" || v.state === "UNAVAILABLE") f.push({ id: `fonte:${v.def.key}`, priority: "media", text: `${v.def.label}: ${v.note}`, evidence: v.def.source, link: v.def.drill });
    else if (v.def.key === "aulas-descobertas" && (v.value ?? 0) > 0) f.push({ id: "aulas-descobertas", priority: "alta", text: `${v.value} aulas sem docente na grade`, evidence: v.note, link: v.def.drill });
  }
  if (!ruleOrder) return { findings: f, note: "prioridade só entre alta (bloqueio/fato) e média (fonte); ordem fina não homologada" };
  return { findings: f.sort((a, b) => ruleOrder.indexOf(a.id.split(":").pop()!) - ruleOrder.indexOf(b.id.split(":").pop()!)), note: null };
}
