/**
 * LOTE 8/14 — Conferência fonte-documento 2026. Registro ÚNICO dos campos de cada documento:
 * natureza (censitário / administrativo / cadastro oficial), tabela.coluna de destino, total
 * declarado pela fonte (quando conhecido) e tela que exibe. O mesmo registro gera o SQL técnico
 * somente leitura (contagens agregadas, sem PII) e alimenta o painel (contagens sob RLS).
 */
export type Nature = "censitario" | "administrativo" | "cadastro-oficial";
export const NATURE_LABEL: Record<Nature, string> = { censitario: "Dado censitário", administrativo: "Registro administrativo", "cadastro-oficial": "Cadastro oficial" };

export type CoverageField = Readonly<{ field: string; column: string | null; shownAt: string | null }>;
export type CoverageDoc = Readonly<{
  key: string; document: string; nature: Nature; table: string; filter?: string; sourceTotal: number | null; sourceTotalOrigin: string | null;
  fields: readonly CoverageField[];
}>;

const f = (field: string, column: string | null, shownAt: string | null): CoverageField => ({ field, column, shownAt });

export const COVERAGE: readonly CoverageDoc[] = [
  { key: "escolas", document: "Cadastro das escolas (Censo 2026)", nature: "cadastro-oficial", table: "institutional_school_record_versions", sourceTotal: 55, sourceTotalOrigin: "recibos Educacenso",
    fields: [f("Nome oficial", "official_name", "/unidades"), f("Endereço", "address", "/unidades/$id"), f("Bairro/distrito", "district", "/unidades/$id"), f("Localização", "location_kind", "/unidades/$id"),
      f("Telefone", "phone", "/unidades/$id"), f("E-mail institucional", "institutional_email", "/unidades/$id"), f("Salas de aula", "classroom_count", "/unidades/$id"), f("Dependência administrativa", "administrative_dependency", "/unidades/$id")] },
  { key: "recibos", document: "Recibos Educacenso por escola", nature: "censitario", table: "census_official_receipt_snapshots", sourceTotal: 55, sourceTotalOrigin: "arquivos de recibo",
    fields: [f("INEP", "inep", "/censo-escolar"), f("Data de fechamento", "closed_at", "/censo-escolar"), f("Medidas declaradas", "measures", "/censo-escolar"), f("Código do recibo (hash)", "receipt_code_sha256", null)] },
  { key: "turmas", document: "Turmas (Censo 2026)", nature: "censitario", table: "class_census_declarations", filter: "field = 'Tipo de turma'", sourceTotal: 698, sourceTotalOrigin: "soma dos recibos",
    fields: [f("Tipo de turma", "value_text", "/turmas/$id"), f("Data conhecida", "known_at", null), f("Localização na fonte", "source_locator", null)] },
  { key: "turmas-cadastro", document: "Turmas no cadastro do SIGEM", nature: "cadastro-oficial", table: "institutional_class_record_versions", sourceTotal: 698, sourceTotalOrigin: "soma dos recibos",
    fields: [f("Nome", "name", "/turmas"), f("Código", "code", "/turmas/$id"), f("Situação administrativa", "administrative_status", "/turmas/$id"), f("Início da vigência", "valid_from", "/turmas/$id")] },
  { key: "alunos", document: "Alunos (Censo 2026)", nature: "censitario", table: "institutional_students", sourceTotal: 9763, sourceTotalOrigin: "alunos distintos na fonte",
    fields: [f("Nome", "display_name", "/alunos/$id"), f("Identificador institucional", "institutional_identifier", "/alunos/$id"), f("Data de nascimento", null, null), f("Filiação", null, null), f("CPF", null, null)] },
  { key: "matriculas", document: "Vínculos aluno × turma (Censo 2026)", nature: "censitario", table: "student_class_bond_observations", sourceTotal: 10295, sourceTotalOrigin: "soma dos recibos",
    fields: [f("Código de matrícula", "enrollment_code", "/turmas/$id"), f("Etapa", "stage_literal", "/turmas/$id"), f("Etapa multisseriada", "multi_stage_literal", "/turmas/$id"), f("Início do vínculo", "valid_from", "/turmas/$id")] },
  { key: "matriculas-escola", document: "Matrículas escolares no SIGEM", nature: "cadastro-oficial", table: "school_enrollments", sourceTotal: 9811, sourceTotalOrigin: "alunos por escola nos recibos",
    fields: [f("Número institucional", "institutional_number", "/alunos/$id"), f("Data de abertura", "opened_on", "/alunos/$id"), f("Ano letivo", "academic_year_id", null)] },
  { key: "jornadas", document: "Todas as jornadas.xlsx", nature: "censitario", table: "student_school_day_observations", sourceTotal: 9204, sourceTotalOrigin: "linhas de estudante na planilha",
    fields: [f("Horário declarado", "schedule_literal", "/alunos/$id"), f("Carga semanal", "weekly_load_literal", "/alunos/$id"), f("Papel do vínculo", "link_role", null), f("Etapa", "stage_literal", "/alunos/$id")] },
  { key: "professores", document: "Profissionais (Censo 2026)", nature: "censitario", table: "professional_census_declarations", sourceTotal: 2403, sourceTotalOrigin: "declarações na fonte",
    fields: [f("Função", "function_literal", "/profissionais"), f("Regime", "regime_literal", null), f("Turma", "class_id", null), f("Vínculo funcional", "functional_link_logical_id", null)] },
  { key: "servidores", document: "Planilha de servidores por escola", nature: "administrativo", table: "staff_administrative_records", filter: "source_kind = 'servidores-por-escola'", sourceTotal: 1797, sourceTotalOrigin: "linhas da planilha",
    fields: [f("Nome", "full_name", "/pessoal-2026"), f("Cargo", "cargo", "/pessoal-2026"), f("Função", "funcao", "/pessoal-2026"), f("Vínculo", "vinculo", "/pessoal-2026"), f("Situação", "situacao", "/pessoal-2026"), f("Escola", "school_id", "/pessoal-2026"), f("Matrícula funcional", "registration", null), f("CPF", null, null)] },
  { key: "semed", document: "Planilha SEMED por setor", nature: "administrativo", table: "staff_administrative_records", filter: "source_kind = 'funcionarios-semed-por-setor'", sourceTotal: 219, sourceTotalOrigin: "linhas da planilha",
    fields: [f("Nome", "full_name", "/pessoal-2026"), f("Setor", "sector", "/pessoal-2026"), f("Cargo", "cargo", "/pessoal-2026"), f("Função", "funcao", "/pessoal-2026"), f("Situação", "situacao", "/pessoal-2026"), f("CPF", null, null)] },
  { key: "infraestrutura", document: "Infraestrutura (Censo 2026)", nature: "censitario", table: "school_infrastructure_observations", sourceTotal: 2970, sourceTotalOrigin: "55 escolas × 54 itens",
    fields: [f("Valor (sim/não)", "value_boolean", "/unidades/$id"), f("Valor (texto)", "value_text", "/unidades/$id"), f("Valor (catálogo)", "value_catalog", "/unidades/$id"), f("Fonte", "source_ref", "/unidades/$id")] },
];

const IDENT = /^[a-z_][a-z0-9_]*$/;
/** SQL técnico somente leitura: só count(*) e count(coluna) — nunca valores. */
export function coverageSql(docs: readonly CoverageDoc[] = COVERAGE): string {
  const parts: string[] = [];
  for (const d of docs) {
    if (!IDENT.test(d.table)) throw new Error(`tabela inválida: ${d.table}`);
    const where = d.filter ? ` where ${d.filter}` : "";
    const cols = d.fields.filter((x) => x.column).map((x) => { if (!IDENT.test(x.column!)) throw new Error(`coluna inválida: ${x.column}`); return `'${x.column}', count(${x.column})`; });
    parts.push(`select '${d.key}' as doc, count(*) as total, json_build_object(${cols.join(", ")})::text as filled from public.${d.table}${where}`);
  }
  return parts.join("\nunion all\n") + ";\n";
}

export type DocCounts = { total: number; filled: Record<string, number> };
export type FieldStatus = "completo" | "parcial" | "nao-fornecido" | "nao-importado";
export type CoverageRow = Readonly<{ doc: CoverageDoc; imported: number | null; divergence: number | null;
  fields: ReadonlyArray<CoverageField & { filled: number | null; status: FieldStatus; shown: boolean }> }>;

export function evaluateCoverage(doc: CoverageDoc, c: DocCounts | null): CoverageRow {
  const imported = c ? c.total : null;
  return {
    doc, imported, divergence: imported != null && doc.sourceTotal != null ? imported - doc.sourceTotal : null,
    fields: doc.fields.map((fl) => {
      if (!fl.column) return { ...fl, filled: null, status: "nao-importado" as const, shown: false };
      const filled = c ? (c.filled[fl.column] ?? 0) : null;
      const status: FieldStatus = filled == null ? "nao-fornecido" : filled === 0 ? "nao-fornecido" : filled === imported ? "completo" : "parcial";
      return { ...fl, filled, status, shown: !!fl.shownAt };
    }),
  };
}

export function coverageMarkdown(rows: readonly CoverageRow[], generatedAt: string): string {
  const out = [`# Conferência fonte-documento 2026`, ``, `Gerado: ${generatedAt} — somente leitura, só contagens (sem dados pessoais).`, ``];
  for (const r of rows) {
    out.push(`## ${r.doc.document} — ${NATURE_LABEL[r.doc.nature]}`, ``,
      `Fonte: ${r.doc.sourceTotal ?? "não declarado"}${r.doc.sourceTotalOrigin ? ` (${r.doc.sourceTotalOrigin})` : ""} · importado: ${r.imported ?? "não lido"} · divergência: ${r.divergence ?? "não comparável"}`, ``,
      `| campo | importado (preenchido) | exibido em | situação |`, `|---|---|---|---|`,
      ...r.fields.map((x) => `| ${x.field} | ${x.filled ?? "—"} | ${x.shownAt ?? "não exibido"} | ${x.status} |`), ``);
  }
  return out.join("\n");
}
