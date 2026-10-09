// N2026.REFERENCE.2027 — "Referência do ano anterior": 2026 registrado ao lado de 2027.
// Só LÊ com a sessão do usuário (RLS). Nunca grava, nunca copia fato de 2026 para 2027:
// matrícula, enturmação, frequência, nota, transferência, atribuição, lotação vigente, turma,
// jornada, calendário, regra, ato e homologação de 2027 nascem só pelos writers de cada domínio.
import type { Probe } from "./readiness-model";
import type { ReadClient, ReadQuery } from "./readiness-probes";

export type RefKind = "anual" | "cadastro";
export type RefItemDef = Readonly<{
  id: string; label: string; domain: string; kind: RefKind;
  /** Para onde "Usar como ponto de partida" leva; o destino decide se há rascunho governado. */
  to: string;
  /** O que o ponto de partida faz. Nunca cria fato oficial 2027 aqui. */
  startingPoint: string;
  /** Fatos que nunca são criados a partir da referência. */
  neverCreates?: string;
}>;

export const REFERENCE_ITEMS: readonly RefItemDef[] = [
  { id: "escolas", label: "Escolas com matrícula registrada", domain: "Escolas", kind: "anual", to: "/unidades",
    startingPoint: "Abre o cadastro das unidades. A escola é a mesma identidade nos dois anos; nada é copiado." },
  { id: "cadastro", label: "Dados cadastrais das escolas", domain: "Escolas", kind: "cadastro", to: "/unidades",
    startingPoint: "O cadastro vigente vale para 2027 sem cópia. Alterar é nova versão no cadastro da unidade." },
  { id: "infraestrutura", label: "Escolas com infraestrutura registrada", domain: "Infraestrutura", kind: "cadastro", to: "/unidades",
    startingPoint: "Mostra a infraestrutura mais recente. Mudança é nova observação, nunca edição de 2026." },
  { id: "profissionais", label: "Profissionais declarados no Censo", domain: "Profissionais", kind: "anual", to: "/profissionais",
    startingPoint: "Abre Profissionais para conferir. Lotação e atribuição de 2027 são registradas pelo DP e pela escola.",
    neverCreates: "lotação vigente e professor atribuído" },
  { id: "lotacoes", label: "Lotações registradas", domain: "Profissionais", kind: "anual", to: "/profissionais",
    startingPoint: "Última lotação conhecida é só referência; a de 2027 é ato próprio.", neverCreates: "lotação vigente" },
  { id: "turmas", label: "Turmas", domain: "Turmas", kind: "anual", to: "/turmas/nova",
    startingPoint: "Abre \"Nova turma\" para criar a de 2027 pela gravação oficial. Turmas de 2026 servem só de sugestão.",
    neverCreates: "turma oficial, enturmação" },
  { id: "jornadas", label: "Turmas com jornada", domain: "Turmas", kind: "anual", to: "/horarios/turmas",
    startingPoint: "Abre Horários. A jornada de 2027 é registrada por turma de 2027.", neverCreates: "jornada oficial" },
  { id: "capacidade", label: "Registros de capacidade/vagas", domain: "Turmas", kind: "anual", to: "/turmas",
    startingPoint: "Capacidade de 2026 é só comparação; a de 2027 é registrada na turma de 2027." },
  { id: "matriculas", label: "Matrículas escolares", domain: "Estudantes", kind: "anual", to: "/secretaria",
    startingPoint: "Quantitativo para planejamento. Renovação é decisão por estudante na Secretaria.",
    neverCreates: "matrícula, enturmação, frequência, nota, transferência" },
  { id: "matrizes", label: "Matrizes com aplicabilidade no ano", domain: "Currículo", kind: "anual", to: "/matrizes-curriculares",
    startingPoint: "Abre Matrizes. Aplicar em 2027 é nova declaração com homologação própria.", neverCreates: "homologação" },
  { id: "censo", label: "Recibos do Censo Escolar", domain: "Censo", kind: "anual", to: "/censo-escolar",
    startingPoint: "Fotografia oficial de 2026 para comparação; nunca origem de pessoa, turma ou matrícula." },
];

/** Linha da comparação. `y2027 = null` em cadastro: o mesmo registro serve aos dois anos. */
export type RefRow = Readonly<{ def: RefItemDef; y2026: Probe; y2027: Probe | null; note: string }>;

export function probeText(p: Probe): string {
  if (p.kind === "count") return p.n.toLocaleString("pt-BR");
  if (p.kind === "denied") return "Sem permissão para ver";
  if (p.kind === "not-read") return "Não verificado";
  return "Não foi possível ler";
}

/** Situação de 2027 frente à referência — nunca afirma prontidão a partir de 2026. */
export function compareNote(def: RefItemDef, y2026: Probe, y2027: Probe | null): string {
  if (def.kind === "cadastro") return "Cadastro sem ano: o mesmo registro vale para 2027, sem cópia.";
  if (y2026.kind !== "count") return "Referência 2026 indisponível nesta conta.";
  if (y2026.n === 0) return "2026 não tem registro deste item.";
  if (!y2027 || y2027.kind !== "count") return "2027 não pôde ser lido.";
  if (y2027.n === 0) return "2027 ainda não configurado.";
  return "2027 já tem registros próprios.";
}

export function buildReferenceRows(r2026: Record<string, Probe>, r2027: Record<string, Probe>): RefRow[] {
  return REFERENCE_ITEMS.map((def) => {
    const a = r2026[def.id] ?? { kind: "not-read" as const };
    const b = def.kind === "cadastro" ? null : (r2027[def.id] ?? { kind: "not-read" as const });
    return { def, y2026: a, y2027: b, note: compareNote(def, a, b) };
  });
}

// ---------------- leituras (SELECT paginado, sessão do usuário) ----------------
type Rows = { kind: "rows"; rows: Record<string, unknown>[] } | { kind: "denied" } | { kind: "error" };
const PAGE = 1000;
async function rows(c: ReadClient, table: string, cols: string, f: (q: ReadQuery) => ReadQuery = (q) => q): Promise<Rows> {
  const out: Record<string, unknown>[] = [];
  try {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await f(c.from(table).select(cols)).range(from, from + PAGE - 1);
      if (error) return error.code === "42501" ? { kind: "denied" } : { kind: "error" };
      if (!data) return { kind: "error" };
      out.push(...(data as Record<string, unknown>[]));
      if (data.length < PAGE) return { kind: "rows", rows: out };
    }
  } catch { return { kind: "error" }; }
}
async function inIds(c: ReadClient, table: string, col: string, values: string[], cols: string): Promise<Rows> {
  if (values.length === 0) return { kind: "rows", rows: [] };
  const acc: Record<string, unknown>[] = [];
  for (let i = 0; i < values.length; i += 200) {
    const r = await rows(c, table, cols, (q) => q.in(col, values.slice(i, i + 200)));
    if (r.kind !== "rows") return r;
    acc.push(...r.rows);
  }
  return { kind: "rows", rows: acc };
}
const distinct = (r: Rows, col: string): Probe => r.kind === "rows" ? { kind: "count", n: new Set(r.rows.map((x) => String(x[col]))).size } : r;
const total = (r: Rows): Probe => r.kind === "rows" ? { kind: "count", n: r.rows.length } : r;
const idsOf = (r: Rows, col: string) => (r.kind === "rows" ? [...new Set(r.rows.map((x) => String(x[col])))] : []);
const overlaps = (from: unknown, until: unknown, s: string, e: string) => (from == null || String(from) <= e) && (until == null || String(until) >= s);

/** Lê um ano. `knownAt` limita observações/declarações ao que já era conhecido (reprodutível). */
export async function readYearReference(c: ReadClient, year: number, knownAt: string): Promise<Record<string, Probe>> {
  const s = `${year}-01-01`, e = `${year}-12-31`;
  const years = await rows(c, "institutional_academic_year_versions", "academic_year_id", (q) => q.gte("starts_on", s).lte("starts_on", e));
  const yearIds = idsOf(years, "academic_year_id");
  const scoped = (fn: () => Promise<Rows>) => (years.kind === "rows" ? fn() : Promise.resolve(years as Rows));
  const classes = await scoped(() => inIds(c, "institutional_classes", "academic_year_id", yearIds, "id,school_id"));
  const classIds = idsOf(classes, "id");
  const viaClasses = (t: string, cols: string) => (classes.kind === "rows" ? inIds(c, t, "class_id", classIds, cols) : Promise.resolve(classes));
  const [enr, profs, postings, journeys, capacity, matrices, censo, schoolVers, infra] = await Promise.all([
    scoped(() => inIds(c, "school_enrollments", "academic_year_id", yearIds, "id,school_id")),
    rows(c, "professional_census_declarations", "person_id,valid_from", (q) => q.gte("valid_from", s).lte("valid_from", e).lte("known_at", knownAt)),
    rows(c, "professional_postings", "id,valid_from,valid_until"),
    viaClasses("class_journeys", "id,class_id"),
    viaClasses("class_capacity_records", "id"),
    scoped(() => inIds(c, "curricular_matrix_applicability", "academic_year_id", yearIds, "matrix_version_id")),
    rows(c, "census_official_receipt_snapshots", "school_id", (q) => q.eq("census_year", String(year)).lte("recorded_at", knownAt)),
    rows(c, "institutional_school_record_versions", "school_id", (q) => q.lte("registered_at", knownAt)),
    rows(c, "school_infrastructure_observations", "school_id", (q) => q.lte("known_at", knownAt)),
  ]);
  return {
    escolas: distinct(enr, "school_id"),
    cadastro: distinct(schoolVers, "school_id"),
    infraestrutura: distinct(infra, "school_id"),
    profissionais: distinct(profs, "person_id"),
    lotacoes: postings.kind === "rows" ? { kind: "count", n: postings.rows.filter((r) => overlaps(r["valid_from"], r["valid_until"], s, e)).length } : postings,
    turmas: total(classes),
    jornadas: distinct(journeys, "class_id"),
    capacidade: total(capacity),
    matriculas: total(enr),
    matrizes: distinct(matrices, "matrix_version_id"),
    censo: distinct(censo, "school_id"),
  };
}
