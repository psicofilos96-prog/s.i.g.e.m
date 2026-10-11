// SIGEM 2.0 — Direção, Lote 10: catálogo de relatórios e indicadores da unidade (núcleo puro).
// Relatório = declaração sobre linhas já lidas pelos readers do usuário; exportação PDF/XLSX/impressão só pelo
// report-engine; indicador só com fórmula/fonte/denominador/vigência declarados; resultados finais só após consolidação.

export type Filter = "ano" | "periodo" | "etapa" | "turma";
export interface LeadershipReport { key: string; title: string; source: string; filters: Filter[]; sensitiveColumns: string[]; dependsOn?: string }

export const LEADERSHIP_REPORTS: LeadershipReport[] = [
  { key: "academico", title: "Situação acadêmica", source: "academic_standing_versions (registro oficial)", filters: ["ano", "periodo", "etapa", "turma"], sensitiveColumns: ["nome"] },
  { key: "pessoal", title: "Pessoal em exercício", source: "staff-schedule.staffPanel", filters: ["ano"], sensitiveColumns: ["nome", "matricula_funcional"] },
  { key: "horarios", title: "Horários da unidade", source: "class_schedule_at", filters: ["ano", "turma"], sensitiveColumns: [] },
  { key: "aulas-descobertas", title: "Aulas sem cobertura", source: "teacher-need-reports.NECESSIDADE_PROFESSOR", filters: ["ano", "turma"], sensitiveColumns: [] },
  { key: "frequencia", title: "Frequência", source: "attendance-permanence.studentRate", filters: ["ano", "periodo", "etapa", "turma"], sensitiveColumns: ["nome"] },
  { key: "movimentacoes", title: "Movimentações", source: "student_movement_events", filters: ["ano", "periodo", "turma"], sensitiveColumns: ["nome"] },
  { key: "alimentacao", title: "Alimentação", source: "meal_reporting_rows", filters: ["ano", "periodo"], sensitiveColumns: [] },
  { key: "infraestrutura", title: "Infraestrutura e manutenção", source: "operations-overview", filters: ["ano"], sensitiveColumns: [] },
  { key: "protocolos", title: "Protocolos e demandas", source: "demand-center", filters: ["ano", "periodo"], sensitiveColumns: [] },
  { key: "projetos-metas", title: "Projetos e metas", source: "management-plan", filters: ["ano"], sensitiveColumns: [] },
  { key: "diagnostico", title: "Diagnóstico da unidade", source: "school-dashboard.diagnose", filters: ["ano", "periodo"], sensitiveColumns: [] },
];

/** Execução: só a própria escola, filtros declarados, colunas sensíveis fora salvo capacidade; exporta pelo report-engine. */
export function runLeadershipReport(key: string, req: { schoolId: string; actorSchoolIds: string[]; filters: Partial<Record<Filter, string>>; includeSensitive: boolean; canSeeSensitive: boolean }) {
  const r = LEADERSHIP_REPORTS.find((x) => x.key === key);
  if (!r) return { ok: false as const, code: "relatorio:desconhecido" };
  if (!req.actorSchoolIds.includes(req.schoolId)) return { ok: false as const, code: "relatorio:fora-da-escola" };
  if (!req.filters.ano) return { ok: false as const, code: "relatorio:ano-obrigatorio" };
  const bad = Object.keys(req.filters).find((f) => !r.filters.includes(f as Filter));
  if (bad) return { ok: false as const, code: "relatorio:filtro-nao-declarado", filter: bad };
  if (req.includeSensitive && !req.canSeeSensitive) return { ok: false as const, code: "relatorio:sensivel-sem-capacidade" };
  return { ok: true as const, plan: { report: r, excludeColumns: req.includeSensitive ? [] : r.sensitiveColumns, exporter: "report-engine" as const, formats: ["pdf-a4", "xlsx", "impressao"] as const } };
}

// ── Indicadores ──
export interface IndicatorDef { key: string; formula: string; source: string; denominator: string; requires: ("consolidacao" | "calendario" | "regra-homologada")[] }
export const LEADERSHIP_INDICATORS: IndicatorDef[] = [
  { key: "aprovacao", formula: "aprovados / estudantes com situação final registrada", source: "academic_standing_versions", denominator: "situação final registrada", requires: ["consolidacao"] },
  { key: "reprovacao", formula: "reprovados / estudantes com situação final registrada", source: "academic_standing_versions", denominator: "situação final registrada", requires: ["consolidacao"] },
  { key: "abandono", formula: "abandono (situação oficial) / estudantes com situação final registrada", source: "academic_standing_versions", denominator: "situação final registrada", requires: ["consolidacao", "regra-homologada"] },
  { key: "frequencia", formula: "presenças / chamadas oficiais na vigência", source: "attendance_record_versions", denominator: "chamadas oficiais", requires: [] },
  { key: "distorcao-idade-ano", formula: "estudantes em distorção / estudantes com posição e nascimento", source: "allocation_curricular_positions + identidade", denominator: "estudantes apuráveis", requires: ["regra-homologada"] },
  { key: "cobertura-docente", formula: "aulas cobertas / aulas da grade", source: "class_schedule_at × teaching_assignments_at", denominator: "blocos da grade", requires: [] },
  { key: "dias-letivos", formula: "dias letivos com registro / dias letivos do calendário", source: "calendar_days_at + registros de aula", denominator: "dias letivos oficiais", requires: ["calendario"] },
  { key: "tempo-de-resposta", formula: "mediana(encerramento − abertura) dos protocolos encerrados", source: "demand-center", denominator: "protocolos encerrados", requires: [] },
];

export type IndicatorState = "apurado" | "bloqueado" | "sem-denominador" | "nao-disponivel";
/** Estado e rastreabilidade obrigatórios; denominador 0 nunca vira percentual; resultado final só com consolidação válida. */
export function indicatorView(key: string, ctx: { consolidated: boolean; calendarResolved: boolean; ruleHomologated: boolean; numerator: number | null; denominator: number | null; validOn: string; refs: string[] }) {
  const def = LEADERSHIP_INDICATORS.find((d) => d.key === key);
  if (!def) return { state: "nao-disponivel" as IndicatorState, reason: "indicador não catalogado" };
  const missing = def.requires.filter((r) => (r === "consolidacao" ? !ctx.consolidated : r === "calendario" ? !ctx.calendarResolved : !ctx.ruleHomologated));
  const meta = { formula: def.formula, source: def.source, denominatorLabel: def.denominator, validOn: ctx.validOn, refs: ctx.refs };
  if (missing.length) return { state: "bloqueado" as IndicatorState, reason: `requer: ${missing.join(", ")}`, ...meta };
  if (ctx.numerator == null || ctx.denominator == null) return { state: "nao-disponivel" as IndicatorState, reason: "fonte não lida", ...meta };
  if (ctx.denominator === 0) return { state: "sem-denominador" as IndicatorState, reason: "denominador zero", ...meta };
  return { state: "apurado" as IndicatorState, value: ctx.numerator / ctx.denominator, numerator: ctx.numerator, denominator: ctx.denominator, ...meta };
}
