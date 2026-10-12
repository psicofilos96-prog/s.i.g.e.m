/**
 * Gestão de Pessoas L03 — Catálogo versionado de CARGOS e FUNÇÕES (separados).
 * Cargo = posto de provimento do vínculo; função = atribuição exercida/designada.
 * Cada entrada é cadeia append-only com fundamento, vigência, requisitos e
 * competências DESCRITIVAS. Nada aqui concede capability: permissão digital só
 * vem de effective_capabilities() (atuação × política homologada).
 */

export type CatalogKind = "cargo" | "funcao";

export type CatalogVersion = Readonly<{
  id: string;
  logicalId: string;
  kind: CatalogKind;
  version: number;
  supersedesId: string | null;
  code: string;
  label: string;
  legalBasis: string | null; // fundamento administrativo (lei, decreto, decisão do proprietário)
  validFrom: string;
  validUntil: string | null;
  requirements: readonly string[]; // descritivos; nunca avaliados automaticamente
  competencies: readonly string[]; // atribuições descritivas; NÃO são capabilities
  changeReason: string | null;
  authorUserId: string | null;
  technical: boolean;
  homologated: boolean;
  recordedAt: string;
}>;

export type CatalogProblem =
  | "chain-gap" | "kind-changed" | "code-changed" | "missing-author" | "technical-author"
  | "missing-reason" | "missing-legal-basis" | "invalid-interval" | "empty-label" | "capability-in-competencies";

/** Competência com cara de capability (slug de permissão) é recusada: competência é texto, não poder. */
export const looksLikeCapability = (s: string, knownCapabilities: ReadonlySet<string>) =>
  knownCapabilities.has(s.trim());

export function validateCatalogChain(vs: readonly CatalogVersion[], knownCapabilities: ReadonlySet<string> = new Set()): CatalogProblem[] {
  const out = new Set<CatalogProblem>();
  const s = [...vs].sort((a, b) => a.version - b.version);
  s.forEach((v, i) => {
    const prev = s[i - 1];
    if (v.version !== i + 1 || (i === 0 ? v.supersedesId !== null : v.supersedesId !== prev?.id)) out.add("chain-gap");
    if (prev && prev.kind !== v.kind) out.add("kind-changed");
    if (prev && prev.code !== v.code) out.add("code-changed");
    if (i > 0 && !v.changeReason?.trim()) out.add("missing-reason");
    if (!v.authorUserId) out.add("missing-author");
    if (v.technical) out.add("technical-author");
    if (v.homologated && !v.legalBasis?.trim()) out.add("missing-legal-basis");
    if (v.validUntil && v.validUntil < v.validFrom) out.add("invalid-interval");
    if (!v.label.trim()) out.add("empty-label");
    if (v.competencies.some((c) => looksLikeCapability(c, knownCapabilities))) out.add("capability-in-competencies");
  });
  return [...out];
}

/** Entrada vigente na data, só homologada e conhecida até knownAt; cadeia inválida ⇒ ambígua. */
export function catalogAt(
  all: readonly CatalogVersion[], kind: CatalogKind, validOn: string, knownAt: string,
): { entries: CatalogVersion[]; ambiguous: string[] } {
  const by = new Map<string, CatalogVersion[]>();
  for (const v of all) if (v.kind === kind && v.recordedAt <= knownAt) by.set(v.logicalId, [...(by.get(v.logicalId) ?? []), v]);
  const entries: CatalogVersion[] = [], ambiguous: string[] = [];
  for (const [lid, vs] of by) {
    if (validateCatalogChain(vs).some((p) => p === "chain-gap" || p === "kind-changed")) { ambiguous.push(lid); continue; }
    const head = vs.reduce((a, b) => (b.version > a.version ? b : a));
    if (head.homologated && head.validFrom <= validOn && (head.validUntil === null || head.validUntil >= validOn)) entries.push(head);
  }
  return { entries: entries.sort((a, b) => a.code.localeCompare(b.code)), ambiguous };
}

/** Códigos não se repetem entre entradas lógicas do mesmo tipo. */
export function duplicateCodes(all: readonly CatalogVersion[]): string[] {
  const m = new Map<string, Set<string>>();
  for (const v of all) { const k = `${v.kind}:${v.code}`; m.set(k, (m.get(k) ?? new Set()).add(v.logicalId)); }
  return [...m].filter(([, s]) => s.size > 1).map(([k]) => k);
}

// ---------------- Designação de função ----------------

export type FunctionDesignation = Readonly<{
  personId: string;
  functionLogicalId: string;
  schoolId: string | null;
  validFrom: string;
  validUntil: string | null;
  actRef: string | null;
  authorUserId: string | null;
  technical: boolean;
}>;

export type DesignationRefusal = "funcao-inexistente" | "nao-e-funcao" | "fora-da-vigencia" | "sem-autor" | "executor-tecnico" | "intervalo-invalido";

export function checkDesignation(d: FunctionDesignation, catalog: readonly CatalogVersion[], knownAt: string): DesignationRefusal | null {
  if (d.technical) return "executor-tecnico";
  if (!d.authorUserId) return "sem-autor";
  if (d.validUntil && d.validUntil < d.validFrom) return "intervalo-invalido";
  const any = catalog.filter((c) => c.logicalId === d.functionLogicalId);
  if (any.length === 0) return "funcao-inexistente";
  if (any.some((c) => c.kind !== "funcao")) return "nao-e-funcao";
  const at = catalogAt(catalog, "funcao", d.validFrom, knownAt).entries.find((e) => e.logicalId === d.functionLogicalId);
  if (!at || (at.validUntil && (d.validUntil === null || d.validUntil > at.validUntil))) return "fora-da-vigencia";
  return null;
}

/**
 * Efeito digital de uma designação: SEMPRE vazio. Capability só nasce de atuação
 * institucional (`institutional_engagements`) × política homologada.
 */
export function capabilitiesGrantedBy(_d: FunctionDesignation): readonly string[] {
  return [];
}
