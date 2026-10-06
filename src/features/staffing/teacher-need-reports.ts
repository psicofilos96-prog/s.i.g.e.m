/**
 * Frente X.1 — relatórios da necessidade de professor no motor comum (`report-engine`), sem arquitetura paralela.
 * As linhas saem só de projeções já lidas pelo usuário (escola/rede conforme RLS dos readers); natureza é sempre
 * "projeção dinâmica" (nunca oficial); ausência permanece null com motivo; cenário simulado é recusado.
 */
import type { CellValue, ColumnDef, ParamDef, ReportDefinition } from "@/features/reports/report-engine";
import type { ClassResult } from "./staffing-model";
import type { ClassDemand, EngagementLoad, NeedSummary, Num } from "./teacher-need";

export const DYNAMIC_NATURE = "projeção dinâmica (não oficial)";

const PARAMS: readonly ParamDef[] = [
  { id: "asOf", label: "Data de referência", type: "date", required: true },
  { id: "knownAt", label: "Conhecido até", type: "datetime", required: true },
  { id: "scope", label: "Escopo", type: "enum", required: true, options: ["escola", "rede"] },
];
const COLUMNS: readonly ColumnDef[] = [
  { id: "escopo", label: "Escopo", kind: "text" },
  { id: "turma", label: "Turma", kind: "text" },
  { id: "componente", label: "Componente", kind: "text" },
  { id: "grandeza", label: "Grandeza", kind: "text" },
  { id: "valor", label: "Valor", kind: "number" },
  { id: "unidade", label: "Unidade", kind: "text" },
  { id: "estado", label: "Estado", kind: "text" },
  { id: "motivo", label: "Motivo", kind: "text" },
  { id: "natureza", label: "Natureza", kind: "text" },
  { id: "proveniencia", label: "Proveniência", kind: "text" },
];
const def = (id: string, title: string, description: string, source: string): ReportDefinition => ({
  id, version: 1, title, description, source, params: PARAMS, columns: COLUMNS, formats: ["csv", "xlsx"], reproducible: false, syncRowLimit: 20000,
});

export const TOTAL_AULAS_OFERTADAS = def("total-aulas-ofertadas", "Quantidade total de aulas ofertadas",
  "Aulas semanais ofertadas pela grade vigente, por turma × componente, com cobertura por regência/substituição. Total anual não é calculado (exige regra homologada grade × calendário).",
  "class_schedule_at + teaching_assignments_at (knownAt único)");
export const TOTAL_AULAS_REDE = def("total-aulas-rede", "Total de aulas da rede",
  "Soma por escola das aulas semanais ofertadas lidas; escola ilegível deixa o total em aberto (não disponível), nunca zero.",
  "class_schedule_at por escola autorizada");
export const NECESSIDADE_PROFESSOR = def("necessidade-de-professor", "Necessidade de professor",
  "Sete grandezas separadas: necessárias, ofertadas, cobertas, descobertas, carga atribuída, carga contratual e saldo. Descoberto é déficit de cobertura, não déficit contratual.",
  "class_curricular_matrices_at + class_schedule_at + teaching_assignments_at + school_teaching_load_at");

type Ctx = Readonly<{ scope: "escola" | "rede"; scopeLabel: string; simulated?: boolean }>;
function guard(ctx: Ctx) {
  if (ctx.simulated) throw new Error("report:simulation-not-admitted");
}
const numRow = (ctx: Ctx, grandeza: string, n: Num, unidade: string, prov: string, turma: string | null = null, componente: string | null = null): Record<string, CellValue> => ({
  escopo: `${ctx.scope}:${ctx.scopeLabel}`, turma, componente, grandeza, valor: n.value, unidade,
  estado: n.value == null ? "desconhecido" : "conhecido", motivo: n.reason, natureza: DYNAMIC_NATURE, proveniencia: prov,
});
const refsOf = (c: ClassResult["cells"][number]) => c.refs.map((r) => `${r.kind}:${r.id}`).join(" ");

/** Aulas ofertadas: uma linha por turma × componente + linhas de estado para turmas sem leitura. */
export function offeredRows(ctx: Ctx, results: readonly ClassResult[]): Record<string, CellValue>[] {
  guard(ctx);
  return results.flatMap((r) => r.state === "grade-ilegivel" || r.state === "regencia-ilegivel" || r.state === "sem-grade"
    ? [numRow(ctx, "aulas-ofertadas", { value: null, reason: r.state === "sem-grade" ? "Sem grade vigente." : "Grade/regência não pôde ser lida." }, "aula semanal", `turma:${r.classId}`, r.classId)]
    : r.cells.map((c) => ({ ...numRow(ctx, "aulas-ofertadas", { value: c.lessons, reason: null }, "aula semanal (bloco)", refsOf(c), r.classId, c.componentId),
        motivo: c.reasons.join(" ") || null })));
}

/** Total da rede: por escola; escola ilegível ⇒ null; total só fecha se todas forem lidas. */
export function networkTotalRows(ctx: Ctx, perSchool: readonly { schoolId: string; results: readonly ClassResult[] | null }[]): Record<string, CellValue>[] {
  guard(ctx);
  const rows = perSchool.map((s) => {
    const bad = s.results == null || s.results.some((r) => r.state === "grade-ilegivel" || r.state === "regencia-ilegivel");
    const v = bad ? null : s.results!.reduce((t, r) => t + r.cells.reduce((u, c) => u + c.lessons, 0), 0);
    return { ...numRow(ctx, "aulas-ofertadas-escola", { value: v, reason: bad ? "Escola com grade/regência ilegível." : null }, "aula semanal", `escola:${s.schoolId}`), turma: null };
  });
  const open = rows.some((r) => r.valor == null);
  rows.push(numRow(ctx, "aulas-ofertadas-rede", { value: open || rows.length === 0 ? null : rows.reduce((t, r) => t + (r.valor as number), 0),
    reason: rows.length === 0 ? "Nenhuma escola lida." : open ? "Total não fechado: há escola sem leitura." : null }, "aula semanal", "soma das escolas lidas"));
  return rows;
}

/** Necessidade: sete grandezas + drill-down (matriz/item, bloco/regência, vínculo). */
export function needRows(ctx: Ctx, s: NeedSummary, demands: readonly ClassDemand[], results: readonly ClassResult[], loads: readonly EngagementLoad[]): Record<string, CellValue>[] {
  guard(ctx);
  const rows = [
    numRow(ctx, "necessarias", s.necessarias, "aula semanal", "matriz → item → regra de unidade"),
    numRow(ctx, "ofertadas", s.ofertadas, "aula semanal", "grade → bloco"),
    numRow(ctx, "cobertas", s.cobertas, "aula semanal", "bloco → regência/substituição"),
    numRow(ctx, "descobertas", s.descobertas, "aula semanal", "ofertadas − cobertas"),
    numRow(ctx, "carga-atribuida", s.cargaAtribuidaMin, "minuto semanal", "bloco → vínculo"),
    numRow(ctx, "carga-contratual", s.cargaContratualMin, "minuto semanal", "fonte funcional (RH)"),
    numRow(ctx, "saldo", s.saldoMin, "minuto semanal", "carga contratual − carga atribuída"),
  ];
  for (const d of demands) {
    if (d.cells.length === 0) rows.push(numRow(ctx, "necessarias:turma", { value: null, reason: d.reason }, "aula semanal", "matriz", d.classId));
    for (const c of d.cells) rows.push({ ...numRow(ctx, "necessarias:item", c.weeklyLessons, "aula semanal", c.refs.join(" "), d.classId, c.componentId),
      motivo: [c.weeklyLessons.reason, c.literal ? `literal da matriz: ${c.literal}` : null].filter(Boolean).join(" · ") || null });
  }
  for (const r of results) for (const c of r.cells)
    rows.push(numRow(ctx, "descobertas:componente", { value: c.uncoveredMinutes, reason: c.uncoveredMinutes == null ? c.reasons.join(" ") || "Cobertura não lida." : null }, "minuto semanal", refsOf(c), r.classId, c.componentId));
  for (const l of loads) {
    rows.push(numRow(ctx, "carga-atribuida:vinculo", { value: l.minutes, reason: l.conflicts ? `${l.conflicts} bloco(s) em conflito.` : null }, "minuto semanal", `vinculo:${l.engagementId}`));
    rows.push(numRow(ctx, "saldo:vinculo", l.balanceMinutes, "minuto semanal", `vinculo:${l.engagementId}`));
  }
  return rows;
}
