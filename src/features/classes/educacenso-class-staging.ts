/**
 * Frente C — contrato de staging PII-free de turmas EducaCenso 2026 (puro, sem gravação).
 * Regras: turma pertence à escola canônica via INEP; código EducaCenso é identificador externo,
 * nunca PK; nenhuma semântica é inferida do nome; classificações compostas ficam como conjunto;
 * ausência ≠ zero/default; nenhuma coluna de pessoa é aceita.
 */

/** Campos permitidos no staging. Qualquer outra coluna é descartada e contada no perfil. */
export const ALLOWED_CLASS_FIELDS = [
  "inep_escola",
  "codigo_turma_educacenso",
  "nome_turma",
  "ano_letivo",
  "turno",
  "etapa",
  "modalidade",
  "tipos_atendimento",
  "multisseriada",
  "localizacao",
  "dependencia",
  "matriculas",
] as const;
export type AllowedClassField = (typeof ALLOWED_CLASS_FIELDS)[number];

/** Cabeçalhos que indicam dado de pessoa: a linha inteira desses campos nunca entra no staging. */
const PII_HEADER = /(cpf|nome.*(aluno|estudante|professor|profissional|docente|gestor|informante|m[ãa]e|pai|respons)|nascimento|\bnis\b|\brg\b|e-?mail|telefone|endere)/i;

export function isPiiHeader(h: string): boolean {
  return PII_HEADER.test(h);
}

export type ColumnMapping = Partial<Record<AllowedClassField, string>>;

export type StagedClass = {
  school_id: string;
  inep_escola: string;
  external_ids: { kind: "educacenso-turma"; value: string }[];
  nome_turma: string;
  ano_letivo: string | null;
  turno: string | null;
  etapa: string | null;
  modalidade: string | null;
  /** Composição preservada: AEE + atividade complementar + escolarização podem coexistir. */
  tipos_atendimento: string[];
  multisseriada: boolean | null;
  matriculas: number | null;
  source_locator: string;
};

export type ClassRowIssue = { locator: string; code: string; field?: string };

const blank = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");
const text = (v: unknown) => (blank(v) ? null : String(v).trim());

function bool(v: unknown): { value: boolean | null; bad?: true } {
  if (blank(v)) return { value: null };
  const t = String(v).trim().toLowerCase();
  if (["1", "sim", "s", "true"].includes(t)) return { value: true };
  if (["0", "não", "nao", "n", "false"].includes(t)) return { value: false };
  return { value: null, bad: true };
}

/** Lista composta: separadores explícitos da fonte; sem achatar em enum único. */
export function splitComposite(v: unknown): string[] {
  if (blank(v)) return [];
  return [...new Set(String(v).split(/[;|\n]/).map((s) => s.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export type ClassStagingResult = {
  classes: StagedClass[];
  issues: ClassRowIssue[];
  droppedPiiColumns: string[];
  totals: { total: number; bySchool: Record<string, number>; byShift: Record<string, number>; byLocation: Record<string, number> };
};

export function stageClasses(input: {
  headers: string[];
  rows: { locator: string; cells: Record<string, unknown> }[];
  mapping: ColumnMapping;
  knownIneps: ReadonlySet<string>;
  locationByInep?: ReadonlyMap<string, string | null>;
}): ClassStagingResult {
  const droppedPiiColumns = input.headers.filter(isPiiHeader);
  const issues: ClassRowIssue[] = [];
  for (const [field, header] of Object.entries(input.mapping)) {
    if (header && isPiiHeader(header)) issues.push({ locator: "mapeamento", code: "coluna-pessoal-recusada", field });
  }
  const col = (r: Record<string, unknown>, f: AllowedClassField) => {
    const h = input.mapping[f];
    return h && !isPiiHeader(h) ? r[h] : undefined;
  };
  const classes: StagedClass[] = [];
  const seenExt = new Set<string>();
  const totals: ClassStagingResult["totals"] = { total: 0, bySchool: {}, byShift: {}, byLocation: {} };
  for (const { locator, cells } of input.rows) {
    const inep = text(col(cells, "inep_escola"));
    if (!inep || !/^[0-9]{8}$/.test(inep)) { issues.push({ locator, code: "inep-invalido" }); continue; }
    if (!input.knownIneps.has(inep)) { issues.push({ locator, code: "escola-inexistente" }); continue; }
    const nome = text(col(cells, "nome_turma"));
    if (!nome) { issues.push({ locator, code: "nome-ausente" }); continue; }
    const ext = text(col(cells, "codigo_turma_educacenso"));
    if (ext) {
      if (seenExt.has(ext)) { issues.push({ locator, code: "codigo-educacenso-duplicado" }); continue; }
      seenExt.add(ext);
    }
    const ms = bool(col(cells, "multisseriada"));
    if (ms.bad) issues.push({ locator, code: "multisseriada-invalida", field: "multisseriada" });
    const mRaw = col(cells, "matriculas");
    let matriculas: number | null = null;
    if (!blank(mRaw)) {
      const n = Number(String(mRaw).trim());
      if (Number.isInteger(n) && n >= 0) matriculas = n;
      else issues.push({ locator, code: "matriculas-invalida", field: "matriculas" });
    }
    const c: StagedClass = {
      school_id: `inep-${inep}`,
      inep_escola: inep,
      external_ids: ext ? [{ kind: "educacenso-turma", value: ext }] : [],
      nome_turma: nome,
      ano_letivo: text(col(cells, "ano_letivo")),
      turno: text(col(cells, "turno")),
      etapa: text(col(cells, "etapa")),
      modalidade: text(col(cells, "modalidade")),
      tipos_atendimento: splitComposite(col(cells, "tipos_atendimento")),
      multisseriada: ms.value,
      matriculas,
      source_locator: locator,
    };
    classes.push(c);
    totals.total++;
    totals.bySchool[inep] = (totals.bySchool[inep] ?? 0) + 1;
    const shift = c.turno ?? "não informado";
    totals.byShift[shift] = (totals.byShift[shift] ?? 0) + 1;
    const loc = input.locationByInep?.get(inep) ?? "não informado";
    totals.byLocation[loc] = (totals.byLocation[loc] ?? 0) + 1;
  }
  return { classes, issues, droppedPiiColumns, totals };
}

export type SourceDivergence = { key: string; kind: "so-em-a" | "so-em-b" | "campo-divergente"; field?: string; a?: unknown; b?: unknown };

/** Reconcilia duas fontes sem escolher vencedora. Chave = código EducaCenso, ou INEP+nome quando ausente. */
export function reconcileSources(a: StagedClass[], b: StagedClass[]): { divergences: SourceDivergence[]; identical: boolean } {
  const key = (c: StagedClass) => c.external_ids[0]?.value ?? `${c.inep_escola}|${c.nome_turma}`;
  const mb = new Map(b.map((c) => [key(c), c]));
  const ma = new Map(a.map((c) => [key(c), c]));
  const out: SourceDivergence[] = [];
  const fields = ["turno", "etapa", "modalidade", "multisseriada", "matriculas", "ano_letivo", "tipos_atendimento"] as const;
  for (const [k, ca] of ma) {
    const cb = mb.get(k);
    if (!cb) { out.push({ key: k, kind: "so-em-a" }); continue; }
    for (const f of fields) {
      const va = JSON.stringify(ca[f]); const vb = JSON.stringify(cb[f]);
      if (va !== vb) out.push({ key: k, kind: "campo-divergente", field: f, a: ca[f], b: cb[f] });
    }
  }
  for (const k of mb.keys()) if (!ma.has(k)) out.push({ key: k, kind: "so-em-b" });
  return { divergences: out, identical: out.length === 0 };
}

/** Linhagem: hash idêntico ⇒ mesma fonte; conteúdo staged idêntico ⇒ derivada, não independente. */
export function lineage(hashA: string, hashB: string, rec: { identical: boolean }): "mesmo-arquivo" | "conteudo-equivalente" | "fontes-distintas" {
  if (hashA === hashB) return "mesmo-arquivo";
  return rec.identical ? "conteudo-equivalente" : "fontes-distintas";
}
