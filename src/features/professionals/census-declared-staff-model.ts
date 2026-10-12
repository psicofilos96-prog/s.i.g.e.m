/** L40 — projeção pura das atuações declaradas no Educacenso 2026 (professional_census_declarations). Não cria vínculo, lotação nem regência. */
export type CensusDeclRow = {
  person_id: string;
  class_code: string;
  class_id: string | null;
  function_literal: string;
  regime_literal: string | null;
  institutional_persons: { display_name: string | null } | null;
};
export type CensusPerson = {
  personId: string;
  name: string;
  functions: string[];
  regimes: string[];
  classes: { code: string; matched: boolean }[];
};

export function groupCensusDeclarations(rows: readonly CensusDeclRow[]): CensusPerson[] {
  const m = new Map<string, CensusPerson>();
  for (const r of rows) {
    let p = m.get(r.person_id);
    if (!p) {
      p = { personId: r.person_id, name: r.institutional_persons?.display_name ?? "Nome não declarado", functions: [], regimes: [], classes: [] };
      m.set(r.person_id, p);
    }
    if (!p.functions.includes(r.function_literal)) p.functions.push(r.function_literal);
    if (r.regime_literal && !p.regimes.includes(r.regime_literal)) p.regimes.push(r.regime_literal);
    if (!p.classes.some((c) => c.code === r.class_code)) p.classes.push({ code: r.class_code, matched: r.class_id !== null });
  }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function censusSummary(rows: readonly CensusDeclRow[]) {
  return {
    atuacoes: rows.length,
    pessoas: new Set(rows.map((r) => r.person_id)).size,
    turmas: new Set(rows.map((r) => r.class_code)).size,
    semTurma: rows.filter((r) => r.class_id === null).length,
  };
}
