/**
 * Infraestrutura escolar como fatos versionados (migration 0105).
 * Registry aberto de atributos + observações por escola. Sem observação = "não informado",
 * nunca false/0. Este módulo é puro: projeção de leitura e preparação/validação do payload
 * da operação técnica `technical_import_educacenso_2026_infrastructure`.
 */
export type InfraValueType = "boolean" | "integer" | "decimal" | "text" | "catalog";

export type InfraAttributeRow = {
  id: string;
  attribute_id: string;
  version_number: number;
  label: string;
  value_type: InfraValueType | string;
  catalog_values: string[] | null;
  unit_label: string | null;
  source_field: string | null;
};

export type InfraObservationRow = {
  id: string;
  school_id: string;
  attribute_id: string;
  value_boolean: boolean | null;
  value_integer: number | null;
  value_decimal: number | string | null;
  value_text: string | null;
  value_catalog: string | null;
  valid_from: string;
  known_at: string;
  source_hash: string;
  source_ref: string;
  source_locator: string | null;
  technical_operation_id: string | null;
  author_user_id: string | null;
};

export type InfraValue = boolean | number | string;

export function observationValue(o: InfraObservationRow): InfraValue | null {
  if (o.value_boolean !== null) return o.value_boolean;
  if (o.value_integer !== null) return Number(o.value_integer);
  if (o.value_decimal !== null) return Number(o.value_decimal);
  if (o.value_text !== null) return o.value_text;
  if (o.value_catalog !== null) return o.value_catalog;
  return null;
}

export function formatInfraValue(v: InfraValue | null, unit?: string | null): string {
  if (v === null) return "não informado";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "number") return unit ? `${v} ${unit}` : String(v);
  return v;
}

export type InfraFactView = {
  attributeId: string;
  label: string;
  current: InfraObservationRow | null;
  value: InfraValue | null;
  display: string;
  history: InfraObservationRow[];
};

/** Vigente = maior valid_from ≤ data; empate pelo known_at mais recente. */
export function schoolInfrastructureAt(
  schoolId: string,
  attributes: readonly InfraAttributeRow[],
  observations: readonly InfraObservationRow[],
  on: string,
): InfraFactView[] {
  const latestAttr = new Map<string, InfraAttributeRow>();
  for (const a of attributes) {
    const p = latestAttr.get(a.attribute_id);
    if (!p || a.version_number > p.version_number) latestAttr.set(a.attribute_id, a);
  }
  const mine = observations.filter((o) => o.school_id === schoolId);
  return [...latestAttr.values()]
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
    .map((a) => {
      const history = mine
        .filter((o) => o.attribute_id === a.attribute_id)
        .sort((x, y) => (y.valid_from === x.valid_from ? y.known_at.localeCompare(x.known_at) : y.valid_from.localeCompare(x.valid_from)));
      const current = history.find((o) => o.valid_from <= on) ?? null;
      const value = current ? observationValue(current) : null;
      return { attributeId: a.attribute_id, label: a.label, current, value, display: formatInfraValue(value, a.unit_label), history };
    });
}

// ---- Preparação do payload técnico (preview → validação → diff) ----------------

export type InfraAttributeDecl = {
  attribute_id: string;
  label: string;
  value_type: InfraValueType;
  catalog_values?: string[];
  unit_label?: string;
  source_field?: string;
};

export type InfraSourceRow = { inep: string; locator: string; values: Record<string, unknown> };

export type InfraRowIssue = { locator: string; inep: string; attributeId?: string; code: string };

const ATTR_ID = /^[a-z0-9][a-z0-9-]{1,79}$/;

/** Célula vazia/ausente ⇒ não informado (sem observação). Nunca converte vazio em false/0. */
export function coerceCell(decl: InfraAttributeDecl, raw: unknown): { value: InfraValue | null; issue?: string } {
  if (raw === null || raw === undefined) return { value: null };
  const s = typeof raw === "string" ? raw.trim() : raw;
  if (s === "") return { value: null };
  switch (decl.value_type) {
    case "boolean": {
      if (typeof s === "boolean") return { value: s };
      const t = String(s).toLowerCase();
      if (["1", "sim", "s", "true"].includes(t)) return { value: true };
      if (["0", "não", "nao", "n", "false"].includes(t)) return { value: false };
      return { value: null, issue: "boolean-invalido" };
    }
    case "integer": {
      const n = typeof s === "number" ? s : Number(String(s).replace(",", "."));
      return Number.isInteger(n) ? { value: n } : { value: null, issue: "inteiro-invalido" };
    }
    case "decimal": {
      const n = typeof s === "number" ? s : Number(String(s).replace(",", "."));
      return Number.isFinite(n) ? { value: n } : { value: null, issue: "decimal-invalido" };
    }
    case "text":
      return { value: String(s) };
    case "catalog":
      return decl.catalog_values?.includes(String(s)) ? { value: String(s) } : { value: null, issue: "valor-fora-do-catalogo" };
  }
}

export type InfraPreview = {
  payload: {
    manifest: { source_hash: string; source_ref: string; attribute_count: number; observation_count: number; school_count: number };
    attributes: InfraAttributeDecl[];
    observations: { inep: string; attribute_id: string; value: InfraValue; source_locator: string }[];
  };
  issues: InfraRowIssue[];
  notInformed: number;
  bySchool: Record<string, number>;
  byAttribute: Record<string, { informed: number; notInformed: number }>;
};

export function buildInfrastructurePreview(input: {
  sourceHash: string;
  sourceRef: string;
  attributes: InfraAttributeDecl[];
  rows: InfraSourceRow[];
  knownIneps: ReadonlySet<string>;
}): InfraPreview {
  const issues: InfraRowIssue[] = [];
  if (!/^[0-9a-f]{64}$/.test(input.sourceHash)) issues.push({ locator: "manifesto", inep: "", code: "hash-invalido" });
  const decls = new Map<string, InfraAttributeDecl>();
  for (const a of input.attributes) {
    if (!ATTR_ID.test(a.attribute_id) || decls.has(a.attribute_id)) issues.push({ locator: "atributos", inep: "", attributeId: a.attribute_id, code: "atributo-invalido-ou-duplicado" });
    decls.set(a.attribute_id, a);
  }
  const seen = new Set<string>();
  const obs: InfraPreview["payload"]["observations"] = [];
  const bySchool: Record<string, number> = {};
  const byAttribute: Record<string, { informed: number; notInformed: number }> = {};
  for (const d of decls.keys()) byAttribute[d] = { informed: 0, notInformed: 0 };
  let notInformed = 0;
  for (const r of input.rows) {
    if (!/^[0-9]{8}$/.test(r.inep)) { issues.push({ locator: r.locator, inep: r.inep, code: "inep-invalido" }); continue; }
    if (seen.has(r.inep)) { issues.push({ locator: r.locator, inep: r.inep, code: "inep-duplicado" }); continue; }
    seen.add(r.inep);
    if (!input.knownIneps.has(r.inep)) { issues.push({ locator: r.locator, inep: r.inep, code: "escola-inexistente" }); continue; }
    for (const key of Object.keys(r.values)) if (!decls.has(key)) issues.push({ locator: r.locator, inep: r.inep, attributeId: key, code: "atributo-desconhecido" });
    for (const d of decls.values()) {
      const { value, issue } = coerceCell(d, r.values[d.attribute_id]);
      if (issue) { issues.push({ locator: r.locator, inep: r.inep, attributeId: d.attribute_id, code: issue }); continue; }
      if (value === null) { notInformed++; byAttribute[d.attribute_id].notInformed++; continue; }
      obs.push({ inep: r.inep, attribute_id: d.attribute_id, value, source_locator: r.locator });
      byAttribute[d.attribute_id].informed++;
      bySchool[r.inep] = (bySchool[r.inep] ?? 0) + 1;
    }
  }
  return {
    payload: {
      manifest: {
        source_hash: input.sourceHash,
        source_ref: input.sourceRef,
        attribute_count: decls.size,
        observation_count: obs.length,
        school_count: new Set(obs.map((o) => o.inep)).size,
      },
      attributes: [...decls.values()],
      observations: obs,
    },
    issues,
    notInformed,
    bySchool,
    byAttribute,
  };
}
