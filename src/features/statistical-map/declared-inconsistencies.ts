// Ocorrências estruturadas dos mapas mensais DECLARADOS (seções I–III, identidade, intermensal).
// Projeção pura sobre `projectAll`: nunca altera valor declarado, nunca contém nome de pessoa.
// A auditoria nominal de pessoal (seção V) vive só na planilha restrita, fora do banco e do repositório.
import type { DeclaredMap, DeclaredProjection } from "./declared-monthly-map";
import { movementBalance } from "./declared-monthly-map";

export type OccurrenceCategory = "identificacao" | "matriculas-movimentacoes" | "turmas-etapas" | "intermensal" | "cobertura";
export type Severity = "alta" | "media" | "baixa";
export type Certainty = "alta" | "media" | "baixa";
export type DeclaredOccurrence = {
  id: string; school_id: string; month: number; category: OccurrenceCategory; section: string; field: string;
  declared: string; expected: string; rule: string; description: string; severity: Severity; certainty: Certainty;
  source_file: string; source_sheet: string; related_month: number | null; status: "pendente de conferência"; suggestion: string;
};

export const CATEGORY_LABEL: Record<OccurrenceCategory, string> = {
  identificacao: "Identificação escolar", "matriculas-movimentacoes": "Matrículas e movimentações",
  "turmas-etapas": "Turmas e etapas", intermensal: "Comparação intermensal", cobertura: "Cobertura",
};

const s = (v: number | null | undefined) => (v === null || v === undefined ? "não informado" : String(v));

/** ID estável: regra + escola + mês + campo (independe da ordem de leitura). */
export const occurrenceId = (rule: string, school: string, month: number, field: string) =>
  `MAP26-${rule}-${school.replace(/^inep-/, "")}-${String(month).padStart(2, "0")}-${field}`;

export function declaredOccurrences(maps: DeclaredMap[], projs: DeclaredProjection[], expectedMonths: readonly number[]): DeclaredOccurrence[] {
  const out: DeclaredOccurrence[] = [];
  const byKey = new Map<string, DeclaredMap[]>();
  for (const m of maps) byKey.set(`${m.school_id}:${m.month}`, [...(byKey.get(`${m.school_id}:${m.month}`) ?? []), m]);
  const push = (p: Pick<DeclaredProjection, "school_id" | "month" | "source_file" | "source_sheet">, o: Omit<DeclaredOccurrence, "id" | "school_id" | "month" | "source_file" | "source_sheet" | "status">) => {
    const id = occurrenceId(o.rule, p.school_id, p.month, o.field);
    if (out.some((x) => x.id === id)) return;
    out.push({ id, school_id: p.school_id, month: p.month, source_file: p.source_file, source_sheet: p.source_sheet, status: "pendente de conferência", ...o });
  };
  for (const p of projs) {
    const d = (byKey.get(`${p.school_id}:${p.month}`) ?? []).find((x) => x.source_sheet === p.source_sheet && x.source_file === p.source_file);
    if (!d) continue;
    if (p.identity === "associada-por-nome") push(p, { category: "identificacao", section: "Cabeçalho", field: "INEP", declared: p.inep_declared ?? "não informado", expected: p.registry_inep ?? "não informado", rule: "ID01",
      description: "INEP da planilha difere do cadastro; associação feita pelo nome do arquivo.", severity: "alta", certainty: "alta", related_month: null, suggestion: "Conferir o INEP com a lista oficial e corrigir o cabeçalho da planilha." });
    const bal = movementBalance(d);
    if (p.section_i === "incoerente") push(p, { category: "matriculas-movimentacoes", section: "I", field: "saldo", declared: s(d.total_ii), expected: s(bal), rule: "MV01",
      description: "Anterior + transferidos recebidos + novos − transferidos expedidos − evadidos − cancelados não fecha com o total.", severity: "alta", certainty: "alta", related_month: null, suggestion: "Refazer a conta da movimentação do mês com a secretaria da escola." });
    if (p.section_i === "incompleta") push(p, { category: "matriculas-movimentacoes", section: "I", field: "parcelas", declared: "parcela em branco", expected: "todas as parcelas preenchidas (0 quando nada houve)", rule: "MV02",
      description: "Movimentação com parcela em branco; branco não é zero.", severity: "media", certainty: "alta", related_month: null, suggestion: "Preencher 0 nas parcelas sem movimento." });
    if (p.section_i === "ausente") push(p, { category: "matriculas-movimentacoes", section: "I", field: "movimentação", declared: "ausente", expected: "seção preenchida", rule: "MV03",
      description: "Seção I sem nenhum valor.", severity: "media", certainty: "alta", related_month: null, suggestion: "Solicitar a movimentação do mês." });
    if (p.section_ii === "incoerente") push(p, { category: "matriculas-movimentacoes", section: "II", field: "total por turno", declared: s(d.shifts?.total ?? null), expected: s(d.total_ii), rule: "TT01",
      description: "Total por turno diferente do total da seção II.", severity: "media", certainty: "alta", related_month: null, suggestion: "Conferir a distribuição por turno." });
    if (p.section_ii === "ausente") push(p, { category: "matriculas-movimentacoes", section: "II", field: "total", declared: "ausente", expected: "total preenchido", rule: "TT02",
      description: "Seção II sem total.", severity: "media", certainty: "alta", related_month: null, suggestion: "Solicitar o total do mês." });
    if (d.total_iii !== null && d.total_iii !== p.classes_sum && p.class_groups.length > 0) push(p, { category: "turmas-etapas", section: "III", field: "total III", declared: s(d.total_iii), expected: String(p.classes_sum), rule: "TU01",
      description: "Soma das linhas de turma diferente do total da seção III.", severity: "media", certainty: "alta", related_month: null, suggestion: "Conferir as linhas de turma e o subtotal." });
    if (d.total_ii !== null && d.total_ii !== p.classes_sum && p.class_groups.length > 0) push(p, { category: "turmas-etapas", section: "II×III", field: "total II", declared: s(d.total_ii), expected: String(p.classes_sum), rule: "TU02",
      description: "Soma das turmas (III) diferente do total da seção II.", severity: "alta", certainty: "alta", related_month: null, suggestion: "Verificar se alguma turma foi omitida ou somada em dobro." });
    const turmasIssue = p.issues.find((i) => i.startsWith("Nº de turmas"));
    if (turmasIssue) push(p, { category: "turmas-etapas", section: "III", field: "nº de turmas", declared: s(d.declared_classes), expected: String(p.class_groups.length), rule: "TU03",
      description: "Nº de turmas declarado difere das turmas listadas (multisseriadas agrupadas).", severity: "baixa", certainty: "media", related_month: null, suggestion: "Confirmar se há turma multisseriada ou linha extra." });
    if (p.class_groups.length === 0 && d.total_iii === null) push(p, { category: "turmas-etapas", section: "III", field: "turmas", declared: "ausente", expected: "relação de turmas", rule: "TU04",
      description: "Seção III sem turmas.", severity: "media", certainty: "alta", related_month: null, suggestion: "Solicitar a relação de turmas." });
    const prev = byKey.get(`${p.school_id}:${p.month - 1}`);
    if (p.previous_month_check === "diverge" && prev?.length === 1) push(p, { category: "intermensal", section: "I", field: "matrícula anterior", declared: s(d.previous_month_enrollment), expected: s(prev[0]!.total_ii), rule: "IM01",
      description: "Matrícula do mês anterior declarada difere do total declarado no mês anterior.", severity: "alta", certainty: "alta", related_month: p.month - 1, suggestion: "Conferir qual dos dois meses está correto." });
    if ((byKey.get(`${p.school_id}:${p.month}`)?.length ?? 0) > 1) push(p, { category: "intermensal", section: "Cabeçalho", field: "competência", declared: `${byKey.get(`${p.school_id}:${p.month}`)!.length} abas`, expected: "1 aba", rule: "IM02",
      description: "Mais de uma aba declarada para a mesma competência.", severity: "media", certainty: "alta", related_month: null, suggestion: "Indicar qual aba é a válida." });
  }
  const schools = [...new Set(maps.map((m) => m.school_id))];
  for (const sc of schools) for (const mo of expectedMonths) if (!byKey.has(`${sc}:${mo}`)) {
    const any = maps.find((m) => m.school_id === sc)!;
    push({ school_id: sc, month: mo, source_file: any.source_file, source_sheet: "—" }, { category: "cobertura", section: "—", field: "competência", declared: "ausente", expected: "mapa do mês", rule: "CB01",
      description: "Competência esperada sem mapa enviado.", severity: "media", certainty: "alta", related_month: null, suggestion: "Solicitar o mapa do mês à escola." });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** Rede = duas dimensões do cadastro (localização × dependência), nunca uma só: uma conveniada rural pertence a "Conveniada" E a "Rural". */
export type SchoolClassification = { localizacao: "urbana" | "rural" | null; conveniada: boolean | null };
export const NETWORK_FILTERS = ["municipal-urbana", "municipal-rural", "conveniada", "rural", "urbana"] as const;
export type NetworkFilter = (typeof NETWORK_FILTERS)[number];
export const NETWORK_FILTER_LABEL: Record<NetworkFilter, string> = {
  "municipal-urbana": "Municipal urbana", "municipal-rural": "Municipal rural", conveniada: "Conveniada (urbana e rural)", rural: "Toda a zona rural (municipal + conveniada)", urbana: "Toda a zona urbana (municipal + conveniada)",
};
export function classifySchool(row: { location_kind?: string | null; administrative_dependency?: string | null } | undefined): SchoolClassification {
  const loc = (row?.location_kind ?? "").toLowerCase(); const dep = (row?.administrative_dependency ?? "").toLowerCase();
  return { localizacao: loc === "urbana" || loc === "rural" ? loc : null, conveniada: dep === "" ? null : dep !== "municipal" };
}
/** Classificação desconhecida nunca entra num filtro (fica em "não classificada"), porque presumir rede excluiria ou duplicaria escola. */
export function matchesNetwork(c: SchoolClassification | undefined, f: NetworkFilter): boolean {
  if (!c || c.localizacao === null || c.conveniada === null) return false;
  switch (f) {
    case "municipal-urbana": return !c.conveniada && c.localizacao === "urbana";
    case "municipal-rural": return !c.conveniada && c.localizacao === "rural";
    case "conveniada": return c.conveniada;
    case "rural": return c.localizacao === "rural";
    case "urbana": return c.localizacao === "urbana";
  }
}
export function networkLabel(c: SchoolClassification | undefined): string {
  if (!c || c.localizacao === null || c.conveniada === null) return "Não classificada";
  return `${c.conveniada ? "Conveniada" : "Municipal"} ${c.localizacao}`;
}
