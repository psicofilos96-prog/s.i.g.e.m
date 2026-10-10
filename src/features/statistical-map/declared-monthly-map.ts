// Mapa mensal DECLARADO pela escola (planilha enviada). Declaração não é apuração:
// fica lado a lado com o cálculo do SIGEM, com divergências explícitas.
export type DeclaredClass = { modalidade: string | null; etapa: string | null; turma: string; alunos: number };
export type DeclaredMap = {
  school_id: string; month: number; source_file: string; source_sheet: string;
  previous_month_enrollment: number | null; transfers_in: number | null; new_students: number | null;
  transfers_out: number | null; dropouts: number | null; withdrawn_cancelled: number | null;
  total_ii: number | null; declared_classes: number | null; total_iii: number | null;
  classes: DeclaredClass[]; consistency_issues: string[];
};

/** anterior + recebidas + novos − expedidas − evadidos − desistentes; null se faltar qualquer parcela. */
export function movementBalance(m: Pick<DeclaredMap, "previous_month_enrollment" | "transfers_in" | "new_students" | "transfers_out" | "dropouts" | "withdrawn_cancelled">): number | null {
  const v = [m.previous_month_enrollment, m.transfers_in, m.new_students, m.transfers_out, m.dropouts, m.withdrawn_cancelled];
  if (v.some((x) => x === null || x === undefined)) return null;
  const [a, r, n, e, d, c] = v as [number, number, number, number, number, number];
  return a + r + n - e - d - c;
}

export type DeclaredVsSigem = { field: string; declared: number | null; sigem: number | null; status: "coincide" | "diverge" | "indisponivel" };

export function compareDeclared(d: DeclaredMap, sigem: { distinct_students: number | null; classes_with_students: number | null } | undefined): DeclaredVsSigem[] {
  const cmp = (field: string, a: number | null, b: number | null | undefined): DeclaredVsSigem => ({
    field, declared: a, sigem: b ?? null,
    status: a === null || b === null || b === undefined ? "indisponivel" : a === b ? "coincide" : "diverge",
  });
  return [cmp("Total de alunos", d.total_ii, sigem?.distinct_students), cmp("Nº de turmas", d.declared_classes, sigem?.classes_with_students)];
}
