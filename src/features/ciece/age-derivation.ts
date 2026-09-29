/**
 * 14.8.1 / 14.8.2 — DERIVAÇÃO DETERMINÍSTICA de idade e classificação em faixa.
 *
 * Separação explícita (14.8.8):
 * - FATO OFICIAL: data de nascimento em `student_identity_versions` (versão vigente).
 * - DERIVAÇÃO DETERMINÍSTICA: idade completa numa data de referência DECLARADA (este módulo).
 * - REGRA NORMATIVA CONFIGURÁVEL: esquema de faixas etárias (`AgeBandScheme`), homologável.
 * - INDICADOR: nada aqui; indicadores são do motor 14.2.
 *
 * Idade nunca é persistida e nunca usa "hoje" implicitamente. Sem nascimento ou sem
 * referência ⇒ indeterminado; referência anterior ao nascimento ⇒ inválido.
 * Nenhuma faixa é fixada em código nem homologada nesta etapa.
 */

export type BirthSource = {
  studentId: string;
  birthDate: string | null;
  /** Referência da versão cadastral utilizada, ex.: "student_identity_versions:i2@2". */
  identityVersionRef: string;
};

export type AgeProvenance = { identityVersionRef: string; referenceDate: string | null; rule: "idade-completa-v1" };

export type DerivedAge =
  | { status: "determinada"; years: number; provenance: AgeProvenance }
  | { status: "indeterminada"; reason: "nascimento-ausente" | "referencia-ausente" | "data-invalida"; provenance: AgeProvenance }
  | { status: "invalida"; reason: "referencia-anterior-ao-nascimento"; provenance: AgeProvenance };

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
function parse(d: string): [number, number, number] | null {
  const m = ISO.exec(d);
  if (!m) return null;
  const y = +m[1]!, mo = +m[2]!, da = +m[3]!;
  const dt = new Date(Date.UTC(y, mo - 1, da));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === da ? [y, mo, da] : null;
}

/**
 * Idade completa (anos inteiros) em `referenceDate`. Nascido em 29/02 completa o ano,
 * em ano não bissexto, somente em 01/03 — pois 28/02 ainda não é o dia seguinte ao
 * aniversário. Convenção de calendário, não norma escolar.
 */
export function deriveCompletedAge(src: BirthSource, referenceDate: string | null | undefined): DerivedAge {
  const provenance: AgeProvenance = { identityVersionRef: src.identityVersionRef, referenceDate: referenceDate ?? null, rule: "idade-completa-v1" };
  if (!src.birthDate) return { status: "indeterminada", reason: "nascimento-ausente", provenance };
  if (!referenceDate) return { status: "indeterminada", reason: "referencia-ausente", provenance };
  const b = parse(src.birthDate), r = parse(referenceDate);
  if (!b || !r) return { status: "indeterminada", reason: "data-invalida", provenance };
  const [by, bm, bd] = b, [ry, rm, rd] = r;
  if (ry < by || (ry === by && (rm < bm || (rm === bm && rd < bd)))) return { status: "invalida", reason: "referencia-anterior-ao-nascimento", provenance };
  let years = ry - by;
  if (rm < bm || (rm === bm && rd < bd)) years -= 1;
  return { status: "determinada", years, provenance };
}

// ---------------- Faixas etárias configuradas (regra normativa) ----------------

export type AgeBand = { id: string; label: string; minYears: number; maxYears: number | null };
export type AgeBandScheme = {
  id: string;
  version: number;
  status: "rascunho" | "homologada";
  homologationActRef: string | null;
  bands: readonly AgeBand[];
};

export type AgeBandResult =
  | { status: "classificada"; bandId: string; schemeRef: string; age: DerivedAge }
  | { status: "sem-faixa-homologada" | "idade-nao-determinada" | "fora-das-faixas-declaradas"; age: DerivedAge; schemeRef?: string };

export function classifyAgeBand(age: DerivedAge, scheme: AgeBandScheme | null | undefined): AgeBandResult {
  if (!scheme || scheme.status !== "homologada" || !scheme.homologationActRef) return { status: "sem-faixa-homologada", age };
  const schemeRef = `${scheme.id}@${scheme.version}`;
  if (age.status !== "determinada") return { status: "idade-nao-determinada", age, schemeRef };
  const band = scheme.bands.find((b) => age.years >= b.minYears && (b.maxYears == null || age.years <= b.maxYears));
  return band ? { status: "classificada", bandId: band.id, schemeRef, age } : { status: "fora-das-faixas-declaradas", age, schemeRef };
}
