/**
 * Frente U.5 — Designação institucional de turmas.
 *
 * Categoria de designação ≠ posição curricular: a categoria só nomeia/organiza a turma; nunca cria,
 * herda ou infere a posição de estudante (B3.3) e nunca resolve matriz (E3). O preview é simulação
 * pura (não grava); a designação oficial só sai de `assign_class_designation`, que exige política
 * HOMOLOGADA vigente. Nenhum valor aqui é inferido do nome ou do código atual da turma.
 */

export type DesignationCriterion = {
  type: "ordinal-por-categoria";
  prefixes: Readonly<Record<string, string>>;
  firstOrdinal: number;
  ordinalWidth: number;
};

export type DesignationPolicy = {
  key: string;
  status: "rascunho" | "homologada";
  criterion: DesignationCriterion;
  provenance: string;
};

/**
 * Proposta EF 100…900 — aprovada pelo proprietário como DIREÇÃO DE PRODUTO, a apresentar ao Gabinete.
 * Não é norma homologada; serve apenas ao preview/simulação.
 */
export const PROPOSED_EF_DESIGNATION_POLICY: DesignationPolicy = {
  key: "designacao-turmas-ef-regular",
  status: "rascunho",
  criterion: {
    type: "ordinal-por-categoria",
    prefixes: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`ef-${i + 1}-ano`, String(i + 1)])),
    firstOrdinal: 0,
    ordinalWidth: 2,
  },
  provenance: "Proposta do proprietário (2026-10-05) para apresentação ao Gabinete; sem homologação.",
};

const ID = /^[a-z0-9][a-z0-9-]*$/;

/** Espelho do validador do banco (`class_designation_criterion_issue`). */
export function criterionIssue(type: string, params: unknown): string | null {
  if (type !== "ordinal-por-categoria") return "designation:unknown-criterion";
  if (!params || typeof params !== "object" || Array.isArray(params)) return "designation:invalid-params";
  const p = params as Record<string, unknown>;
  if (Object.keys(p).some((k) => !["prefixes", "first_ordinal", "ordinal_width"].includes(k))) return "designation:invalid-params";
  const prefixes = p["prefixes"];
  if (!prefixes || typeof prefixes !== "object" || Array.isArray(prefixes) || Object.keys(prefixes).length === 0) return "designation:invalid-params";
  for (const [k, v] of Object.entries(prefixes)) if (!ID.test(k) || typeof v !== "string" || !/^[0-9]{1,2}$/.test(v)) return "designation:invalid-params";
  if (!Number.isInteger(p["first_ordinal"]) || (p["first_ordinal"] as number) < 0) return "designation:invalid-params";
  if (!Number.isInteger(p["ordinal_width"]) || (p["ordinal_width"] as number) < 1 || (p["ordinal_width"] as number) > 3) return "designation:invalid-params";
  return null;
}

/** Menor ordinal NUNCA usado em escola+ano+categoria (encerradas/canceladas continuam reservadas). */
export function nextOrdinal(reservedOrdinals: readonly number[], firstOrdinal: number): number {
  return reservedOrdinals.length === 0 ? firstOrdinal : Math.max(firstOrdinal, Math.max(...reservedOrdinals) + 1);
}

export function formatDesignation(prefix: string, ordinal: number, width: number): string | null {
  const s = String(ordinal);
  return s.length > width ? null : prefix + s.padStart(width, "0");
}

/** Writer oficial (espelho de contrato): rascunho nunca designa turma real. */
export function officialDesignationRefusal(policy: DesignationPolicy | null): string | null {
  if (!policy) return "designation:no-homologated-policy";
  if (policy.status !== "homologada") return "designation:no-homologated-policy";
  return null;
}

export type PreviewClass = {
  classId: string;
  schoolId: string;
  academicYearId: string;
  currentCode: string | null;
  /** Categoria de designação registrada canonicamente; null = não registrada (nunca deduzida do código). */
  category: string | null;
  /** Natureza da turma pela Oferta B2.6, quando registrada. */
  nature: string | null;
  /** Posições individuais efetivamente registradas nas alocações (apenas exibição/conferência). */
  studentPositions: readonly string[];
  /** Turma encerrada/cancelada: mantém reserva, não é renumerada. */
  ended?: boolean;
};

export type PreviewStatus = "proposta" | "nao-determinavel" | "regra-nao-definida" | "nao-aplicavel";
export type PreviewRow = PreviewClass & {
  proposed: string | null;
  status: PreviewStatus;
  notes: string[];
};

/** Correspondência categoria→posição declarada (para conferência). Sem ela, divergência não é avaliada. */
export type CategoryPositionHint = Readonly<Record<string, string>>;

/**
 * Simulação para o Gabinete: NÃO grava nada. Ordem dentro de escola+ano+categoria segue o ID canônico
 * da turma (determinística), nunca o nome/código atual.
 */
export function simulateDesignations(
  classes: readonly PreviewClass[],
  policy: DesignationPolicy,
  hint: CategoryPositionHint = {},
): PreviewRow[] {
  const { prefixes, firstOrdinal, ordinalWidth } = policy.criterion;
  const used = new Map<string, number[]>();
  const sorted = [...classes].sort((a, b) => a.classId.localeCompare(b.classId));
  const rows = new Map<string, PreviewRow>();
  for (const c of sorted) {
    const notes: string[] = [];
    let status: PreviewStatus;
    let proposed: string | null = null;
    if (c.nature && c.nature !== "regular") {
      status = "regra-nao-definida";
      notes.push(`Natureza "${c.nature}": regra de designação ainda não definida.`);
    } else if (!c.category) {
      status = "nao-determinavel";
      notes.push("Categoria de designação não registrada canonicamente.");
    } else if (!(c.category in prefixes)) {
      status = "regra-nao-definida";
      notes.push("Categoria fora da proposta EF regular: regra de designação ainda não definida.");
    } else {
      const k = `${c.schoolId}|${c.academicYearId}|${c.category}`;
      const list = used.get(k) ?? [];
      const ord = nextOrdinal(list, firstOrdinal);
      proposed = formatDesignation(prefixes[c.category] as string, ord, ordinalWidth);
      list.push(ord);
      used.set(k, list);
      status = proposed ? "proposta" : "nao-determinavel";
      if (!proposed) notes.push("Ordinal esgotado na largura configurada.");
      const expected = hint[c.category];
      const distinct = [...new Set(c.studentPositions)];
      if (distinct.length > 1) notes.push("Turma com várias posições individuais: o código não escolhe posição.");
      if (expected && distinct.some((p) => p !== expected)) notes.push("Divergência para conferência: há posições individuais diferentes da categoria.");
    }
    if (c.ended) notes.push("Turma encerrada: código reservado, não reutilizado.");
    rows.set(c.classId, { ...c, proposed, status, notes });
  }
  return classes.map((c) => rows.get(c.classId)!);
}

export type PreviewSummary = {
  total: number;
  proposta: number;
  naoDeterminavel: number;
  regraNaoDefinida: number;
  jaConforme: number;
  divergente: number;
  duplicidadesAtuais: number;
  comConferencia: number;
};

export function summarizePreview(rows: readonly PreviewRow[]): PreviewSummary {
  const seen = new Map<string, number>();
  for (const r of rows) if (r.currentCode) {
    const k = `${r.schoolId}|${r.academicYearId}|${r.currentCode}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  return {
    total: rows.length,
    proposta: rows.filter((r) => r.status === "proposta").length,
    naoDeterminavel: rows.filter((r) => r.status === "nao-determinavel").length,
    regraNaoDefinida: rows.filter((r) => r.status === "regra-nao-definida").length,
    jaConforme: rows.filter((r) => r.proposed && r.proposed === r.currentCode).length,
    divergente: rows.filter((r) => r.proposed && r.proposed !== r.currentCode).length,
    duplicidadesAtuais: [...seen.values()].filter((n) => n > 1).length,
    comConferencia: rows.filter((r) => r.notes.some((n) => n.startsWith("Divergência"))).length,
  };
}
