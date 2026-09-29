/**
 * 14.8.3 / 14.8.4 — Distorção idade-série como INDICADOR DERIVADO, nunca atributo do estudante.
 *
 * Separação explícita (14.8.8):
 * - FATO OFICIAL: nascimento (identidade vigente), enturmação oficial vigente na data,
 *   etapa/ano/fase vinda de FONTE declarada e registrada (`StageSource`).
 * - DERIVAÇÃO DETERMINÍSTICA: idade completa (`deriveCompletedAge`).
 * - REGRA NORMATIVA CONFIGURÁVEL: `AgeGradeDistortionRule` (idade adequada por etapa,
 *   anos de defasagem, tratamento de ausentes, versão e ato) — nenhum número no código.
 * - INDICADOR: aritmética pelo avaliador registrado do motor 14.2 (`applyRegisteredEvaluator`).
 *
 * 14.9: a etapa vem da organização oficial da oferta (`class_offering_versions`), eixo
 * declarado pela regra. Nome/rótulo da turma NUNCA é interpretado; sem valor vigente e
 * único na data, a etapa é indeterminada. Sem regra homologada nada é calculado.
 */
import type { CanonicalFact } from "./canonical-fact-types";
import { deriveCompletedAge, type BirthSource, type DerivedAge } from "./age-derivation";
import { applyRegisteredEvaluator, type EvaluatorOutput } from "./indicator-engine";

// ---------------- Fonte de etapa/ano/fase (registrada, nunca inferida) ----------------

export type StageResolution = { stageId: string; sourceRef: string } | null;
export type StageSource = (classId: string, at: string) => StageResolution;
const STAGE_SOURCES = new Map<string, StageSource>();
export function registerStageSource(id: string, fn: StageSource): void {
  if (STAGE_SOURCES.has(id)) throw new Error(`Fonte de etapa já registrada: ${id}`);
  STAGE_SOURCES.set(id, fn);
}
/** Mensagem usada quando a regra cita uma fonte de etapa não registrada/fornecida. */
export const STAGE_SOURCE_GAP = {
  dimensionId: "class.offeringAxis",
  reason: "Fonte de etapa não registrada. A fonte oficial é a organização da oferta (14.9, class_offering_versions) pelo eixo declarado na regra; rótulo da turma nunca é interpretado.",
} as const;

/**
 * 14.9 — Fonte OFICIAL de etapa: fatos `organizacao-da-oferta-da-turma` do eixo declarado,
 * vigentes na data. A regra escolhe o eixo (`stageSourceId = "organizacao-da-oferta:<eixo>"`);
 * o motor não sabe o que é etapa, ano ou fase.
 */
export function offeringStageSource(facts: readonly CanonicalFact[], axisSchemeId: string): StageSource {
  return (classId, at) => {
    const hits = facts.filter((f) => f.factTypeId === "organizacao-da-oferta-da-turma" && f.subject["classId"] === classId
      && f.subject["axisSchemeId"] === axisSchemeId && f.availability === "disponivel" && !!f.temporal.validFrom
      && f.temporal.validFrom <= at && (f.temporal.validTo == null || f.temporal.validTo >= at));
    if (hits.length !== 1 || hits[0]!.payload?.kind !== "categorico" || !hits[0]!.payload.categoryId) return null; // ausente ou ambíguo ⇒ indeterminado
    const h = hits[0]!;
    return { stageId: h.payload!.kind === "categorico" ? h.payload!.categoryId! : "", sourceRef: `${h.provenance.sourceId}:${h.provenance.recordId}@${h.provenance.recordVersion}` };
  };
}
export const OFFERING_STAGE_SOURCE_PREFIX = "organizacao-da-oferta:";

// ---------------- Regra normativa ----------------

export type AgeGradeDistortionRule = {
  id: string;
  version: number;
  status: "rascunho" | "homologada";
  homologationActRef: string | null;
  population: { factTypeId: "episodio-de-enturmacao"; schoolId?: string; classIds?: readonly string[] };
  stageSourceId: string;
  /** Data de referência explícita da regra (ex.: data-base do Censo). Nunca "hoje". */
  referenceDate: string;
  /** Critério por etapa: idade máxima adequada, em anos completos. Etapa ausente ⇒ sem critério. */
  adequateMaxAgeByStage: Readonly<Record<string, number>>;
  /** Anos acima da idade adequada que caracterizam distorção (declarado, nunca nativo). */
  distortionYearsBeyond: number;
  /** Ausentes: excluídos e declarados, ou tornam o resultado indeterminado. */
  missingData: "excluir-e-declarar" | "indeterminar-resultado";
  operation: { evaluatorId: string; params: Readonly<Record<string, unknown>> };
};

export type StudentClassification = {
  studentId: string;
  status: "em-distorcao" | "sem-distorcao" | "indeterminado";
  reason?: string;
  age: DerivedAge | null;
  provenance: { episodeRef: string; enrollmentRef: string | null; identityVersionRef: string | null; stageSourceRef: string | null; ruleRef: string };
};

export type DistortionReceipt =
  | { ok: false; code: "regra-nao-homologada" | "fonte-de-etapa-nao-registrada" | "avaliador-desconhecido"; detail?: string }
  | {
      ok: true;
      ruleRef: string;
      referenceDate: string;
      populationSize: number;
      classified: number;
      indeterminate: number;
      result: EvaluatorOutput | { numerator: null; denominator: null; value: null; indeterminate: string };
      /** Somente no servidor; a fronteira 14.3 decide o que é divulgado. */
      students: StudentClassification[];
    };

export function computeAgeGradeDistortion(
  rule: AgeGradeDistortionRule | null | undefined,
  facts: readonly CanonicalFact[],
  births: ReadonlyMap<string, BirthSource>,
): DistortionReceipt {
  if (rule?.stageSourceId.startsWith(OFFERING_STAGE_SOURCE_PREFIX) && !STAGE_SOURCES.has(rule.stageSourceId))
    return computeWith(rule, facts, births, offeringStageSource(facts, rule.stageSourceId.slice(OFFERING_STAGE_SOURCE_PREFIX.length)));
  return computeWith(rule, facts, births, rule ? STAGE_SOURCES.get(rule.stageSourceId) : undefined);
}

function computeWith(
  rule: AgeGradeDistortionRule | null | undefined,
  facts: readonly CanonicalFact[],
  births: ReadonlyMap<string, BirthSource>,
  stageSource: StageSource | undefined,
): DistortionReceipt {
  if (!rule || rule.status !== "homologada" || !rule.homologationActRef) return { ok: false, code: "regra-nao-homologada" };
  if (!stageSource) return { ok: false, code: "fonte-de-etapa-nao-registrada", detail: STAGE_SOURCE_GAP.reason };
  const ruleRef = `${rule.id}@${rule.version}`;
  const at = rule.referenceDate;

  // 14.8.4 — população = enturmações oficiais vigentes NA DATA (nunca a turma atual).
  const population = facts.filter((f) =>
    f.factTypeId === rule.population.factTypeId &&
    !!f.temporal.validFrom && f.temporal.validFrom <= at && (f.temporal.validTo == null || f.temporal.validTo >= at) &&
    (!rule.population.schoolId || f.dimensions["schoolId"] === rule.population.schoolId) &&
    (!rule.population.classIds || rule.population.classIds.includes(String(f.dimensions["classId"]))));

  const students: StudentClassification[] = population.map((f) => {
    const studentId = f.subject["studentId"]!;
    const classId = String(f.dimensions["classId"]);
    const enrollmentRef = f.payload?.kind === "referencial" ? (f.payload.references[0]?.id ?? null) : null;
    const birth = births.get(studentId);
    const stage = stageSource(classId, at);
    const prov = { episodeRef: `${f.provenance.sourceId}:${f.provenance.recordId}`, enrollmentRef, identityVersionRef: birth?.identityVersionRef ?? null, stageSourceRef: stage?.sourceRef ?? null, ruleRef };
    const age = birth ? deriveCompletedAge(birth, at) : null;
    if (!age || age.status !== "determinada") return { studentId, status: "indeterminado", reason: age ? age.status === "invalida" ? age.reason : age.reason : "identidade-ausente", age, provenance: prov };
    if (!stage) return { studentId, status: "indeterminado", reason: "etapa-indeterminada", age, provenance: prov };
    const adequate = rule.adequateMaxAgeByStage[stage.stageId];
    if (adequate == null) return { studentId, status: "indeterminado", reason: "etapa-sem-criterio-declarado", age, provenance: prov };
    return { studentId, status: age.years - adequate >= rule.distortionYearsBeyond ? "em-distorcao" : "sem-distorcao", age, provenance: prov };
  });

  const classifiedList = students.filter((s) => s.status !== "indeterminado");
  const indeterminate = students.length - classifiedList.length;
  const base = { ok: true as const, ruleRef, referenceDate: at, populationSize: students.length, classified: classifiedList.length, indeterminate, students };
  if (indeterminate > 0 && rule.missingData === "indeterminar-resultado")
    return { ...base, result: { numerator: null, denominator: null, value: null, indeterminate: `${indeterminate} estudante(s) sem classificação determinável` } };

  const observed = classifiedList.map((s) => ({
    subjectId: s.studentId,
    fact: {
      factTypeId: "classificacao-idade-serie-derivada", familyId: "populacao-matricula-movimentacao",
      subject: { studentId: s.studentId }, dimensions: {}, availability: "disponivel",
      payload: { kind: "categorico", categoryId: s.status, schemeId: ruleRef },
      temporal: { occurredAt: at }, provenance: { domainId: "14.8", sourceId: "derivacao", recordId: s.provenance.episodeRef, recordVersion: null, actRef: rule.homologationActRef },
      schemaVersion: 1,
    } as unknown as CanonicalFact,
  }));
  const out = applyRegisteredEvaluator(rule.operation.evaluatorId, observed, rule.operation.params);
  if (!out) return { ok: false, code: "avaliador-desconhecido", detail: rule.operation.evaluatorId };
  return { ...base, result: out };
}
