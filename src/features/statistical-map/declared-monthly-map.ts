// Mapa mensal DECLARADO pela escola (planilha enviada). Declaração não é apuração nem homologação:
// fica lado a lado com o cálculo do SIGEM, com divergências explícitas. Os números originais nunca
// são alterados; a projeção só lê, agrupa e aponta ressalvas.
export type DeclaredClass = { modalidade: string | null; etapa: string | null; turma: string; alunos: number };
export type DeclaredMap = {
  school_id: string; month: number; source_file: string; source_sheet: string;
  inep_declared?: string | null; file_sha256?: string; shifts?: { total?: number | null } | null;
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

const norm = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

/** Turma declarada após agrupar as linhas por etapa de uma mesma turma multisseriada. */
export type DeclaredClassGroup = { turma: string; modalidade: string | null; etapas: string[]; alunos: number; linhas: number; multisseriada: boolean };

/**
 * Na planilha, uma turma multisseriada ocupa uma linha por etapa: a primeira traz o nome da turma
 * (que contém "multisseriad") e as seguintes repetem só a etapa no campo turma. Linhas de continuação
 * são somadas à turma de origem; nunca contam como turmas distintas. Linha cujo nome é igual à etapa
 * sem cabeça multisseriada antes continua sendo turma própria (não se presume agrupamento).
 */
export function groupDeclaredClasses(classes: DeclaredClass[]): DeclaredClassGroup[] {
  const out: DeclaredClassGroup[] = [];
  let head: DeclaredClassGroup | null = null;
  for (const c of classes) {
    const isHead = /MULTISSERIAD/.test(norm(c.turma));
    const isContinuation = !isHead && head !== null && norm(c.turma) === norm(c.etapa) && norm(c.modalidade) === norm(head.modalidade);
    if (isContinuation && head) {
      head.alunos += c.alunos; head.linhas += 1;
      if (c.etapa && !head.etapas.includes(c.etapa)) head.etapas.push(c.etapa);
      continue;
    }
    const g: DeclaredClassGroup = { turma: c.turma, modalidade: c.modalidade, etapas: c.etapa ? [c.etapa] : [], alunos: c.alunos, linhas: 1, multisseriada: isHead };
    out.push(g);
    head = isHead ? g : null;
  }
  return out;
}

export type SectionState = "valida" | "incompleta" | "incoerente" | "ausente";
export type IdentityState = "confirmada" | "associada-por-nome";
export type DeclaredState = "declarado" | "declarado-com-ressalvas";
export type DeclaredProjection = {
  school_id: string; month: number; registry_inep: string | null; inep_declared: string | null;
  identity: IdentityState; source_file: string; source_sheet: string;
  section_i: SectionState; section_ii: SectionState; section_iii: SectionState;
  balance: number | null; class_lines: number; class_groups: DeclaredClassGroup[]; classes_sum: number;
  previous_month_check: "coincide" | "diverge" | "sem-mes-anterior" | "nao-informado";
  issues: string[]; state: DeclaredState;
};

export const IDENTITY_NOTICE = "INEP da planilha diferente do cadastro: a planilha foi associada à escola pelo nome do arquivo. A identidade só fica confirmada após reconciliação documental.";
export const STATE_LABEL: Record<DeclaredState, string> = { declarado: "Declarado", "declarado-com-ressalvas": "Declarado com ressalvas" };
export const SECTION_LABEL: Record<SectionState, string> = { valida: "válida", incompleta: "incompleta", incoerente: "incoerente", ausente: "ausente" };

/** Projeta uma declaração sem alterar seus números. `prev` é a declaração do mês anterior da mesma escola. */
export function projectDeclared(d: DeclaredMap, registryInep: string | null, prev?: DeclaredMap | null): DeclaredProjection {
  const issues: string[] = [];
  const inep = d.inep_declared ?? null;
  const identity: IdentityState = inep !== null && registryInep !== null && inep === registryInep ? "confirmada" : "associada-por-nome";
  if (identity === "associada-por-nome") issues.push(inep === null ? "Planilha sem INEP; associada pelo nome do arquivo." : `INEP da planilha (${inep}) diferente do cadastro (${registryInep ?? "não informado"}).`);

  const mv = [d.previous_month_enrollment, d.transfers_in, d.new_students, d.transfers_out, d.dropouts, d.withdrawn_cancelled];
  const balance = movementBalance(d);
  let section_i: SectionState = mv.every((x) => x === null || x === undefined) ? "ausente" : balance === null ? "incompleta" : "valida";
  if (section_i === "valida" && d.total_ii !== null && balance !== d.total_ii) { section_i = "incoerente"; issues.push(`Movimentação (I) dá ${balance}, total declarado ${d.total_ii}.`); }
  if (section_i === "incompleta") issues.push("Movimentação (I) com parcela em branco.");

  let section_ii: SectionState = d.total_ii === null ? "ausente" : "valida";
  const shiftTotal = d.shifts?.total ?? null;
  if (section_ii === "valida" && shiftTotal !== null && shiftTotal !== d.total_ii) { section_ii = "incoerente"; issues.push(`Total por turno (${shiftTotal}) diferente do total II (${d.total_ii}).`); }

  const groups = groupDeclaredClasses(d.classes ?? []);
  const sum = (d.classes ?? []).reduce((s, c) => s + (c.alunos ?? 0), 0);
  let section_iii: SectionState = groups.length === 0 ? (d.total_iii === null ? "ausente" : "incompleta") : "valida";
  if (groups.length > 0) {
    if (d.total_iii !== null && d.total_iii !== sum) { section_iii = "incoerente"; issues.push(`Soma das turmas (${sum}) diferente do total III (${d.total_iii}).`); }
    if (d.total_ii !== null && d.total_ii !== sum) { section_iii = "incoerente"; issues.push(`Soma das turmas (${sum}) diferente do total II (${d.total_ii}).`); }
    if (d.declared_classes !== null && d.declared_classes !== groups.length) { section_iii = "incoerente"; issues.push(`Nº de turmas declarado (${d.declared_classes}) diferente das turmas listadas (${groups.length}, após agrupar multisseriadas).`); }
    if (groups.some((g) => g.alunos > 60)) { section_iii = "incoerente"; issues.push("Turma com mais de 60 alunos declarados (provável erro de digitação)."); }
  }

  let previous_month_check: DeclaredProjection["previous_month_check"] = "sem-mes-anterior";
  if (prev) previous_month_check = d.previous_month_enrollment === null || prev.total_ii === null ? "nao-informado" : d.previous_month_enrollment === prev.total_ii ? "coincide" : "diverge";
  if (previous_month_check === "diverge") issues.push(`Matrícula do mês anterior declarada (${d.previous_month_enrollment}) diferente do total do mês anterior (${prev!.total_ii}).`);

  const ok = identity === "confirmada" && [section_i, section_ii, section_iii].every((s) => s === "valida") && previous_month_check !== "diverge";
  return { school_id: d.school_id, month: d.month, registry_inep: registryInep, inep_declared: inep, identity, source_file: d.source_file, source_sheet: d.source_sheet,
    section_i, section_ii, section_iii, balance, class_lines: (d.classes ?? []).length, class_groups: groups, classes_sum: sum,
    previous_month_check, issues, state: ok ? "declarado" : "declarado-com-ressalvas" };
}

/** Projeta todas as declarações; mês anterior = declaração da mesma escola em month−1 (só se houver exatamente uma). */
export function projectAll(maps: DeclaredMap[], registryInep: (schoolId: string) => string | null): DeclaredProjection[] {
  const key = (s: string, m: number) => `${s}:${m}`;
  const by = new Map<string, DeclaredMap[]>();
  for (const m of maps) by.set(key(m.school_id, m.month), [...(by.get(key(m.school_id, m.month)) ?? []), m]);
  return maps.map((m) => { const p = by.get(key(m.school_id, m.month - 1)); return projectDeclared(m, registryInep(m.school_id), p && p.length === 1 ? p[0] : null); })
    .sort((a, b) => a.school_id.localeCompare(b.school_id) || a.month - b.month);
}

export type DeclaredVsSigem = { field: string; declared: number | null; sigem: number | null; status: "coincide" | "diverge" | "indisponivel" | "referencia-nao-apurada" };

/** Compara só contra mês APURADO do SIGEM. Estimativa parcial (inclusive 0% de cobertura), provisório e não apurado nunca dão veredito. */
export function compareDeclared(d: DeclaredMap, sigem: { distinct_students: number | null; classes_with_students: number | null; status?: string } | undefined): DeclaredVsSigem[] {
  const apurado = sigem?.status === undefined || sigem.status === "apurado";
  const classes = d.classes?.length ? groupDeclaredClasses(d.classes).length : d.declared_classes;
  const cmp = (field: string, a: number | null, b: number | null | undefined): DeclaredVsSigem => ({
    field, declared: a, sigem: b ?? null,
    status: a === null || b === null || b === undefined ? "indisponivel" : !apurado ? "referencia-nao-apurada" : a === b ? "coincide" : "diverge",
  });
  return [cmp("Total de alunos", d.total_ii, sigem?.distinct_students), cmp("Nº de turmas (agrupadas)", classes, sigem?.classes_with_students)];
}

export const EXPECTED_MONTHS = [2, 3, 4, 5, 6, 7, 8, 9] as const;
export type CoverageSchool = { school_id: string; months: number[]; missing: number[]; ressalvas: number; identity: IdentityState };
export type Coverage = { schools_total: number; schools_declared: number; competences: number; with_ressalvas: number; unconfirmed_identity: string[]; duplicated: string[]; per_school: CoverageSchool[] };

/** Cobertura dos lotes: escolas, meses, ressalvas e pendências. Meses esperados: fevereiro a setembro de 2026. */
export function declaredCoverage(projs: DeclaredProjection[], schoolsTotal: number): Coverage {
  const by = new Map<string, DeclaredProjection[]>();
  for (const p of projs) by.set(p.school_id, [...(by.get(p.school_id) ?? []), p]);
  const dup: string[] = [];
  const per = [...by.entries()].map(([school_id, ps]) => {
    const months = [...new Set(ps.map((p) => p.month))].sort((a, b) => a - b);
    for (const m of months) if (ps.filter((p) => p.month === m).length > 1) dup.push(`${school_id}:${m}`);
    return { school_id, months, missing: EXPECTED_MONTHS.filter((m) => !months.includes(m)), ressalvas: ps.filter((p) => p.state !== "declarado").length,
      identity: ps.every((p) => p.identity === "confirmada") ? "confirmada" as const : "associada-por-nome" as const };
  }).sort((a, b) => a.school_id.localeCompare(b.school_id));
  return { schools_total: schoolsTotal, schools_declared: per.length, competences: projs.length, with_ressalvas: projs.filter((p) => p.state !== "declarado").length,
    unconfirmed_identity: per.filter((s) => s.identity !== "confirmada").map((s) => s.school_id), duplicated: dup, per_school: per };
}
