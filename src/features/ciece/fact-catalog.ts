/**
 * 14.1A — Catálogo canônico: UMA fonte por tipo de fato, granularidade atômica
 * e semântica temporal declaradas. Famílias sem fonte ficam como "futura".
 */
import type { CanonicalFact, FactFamilyId, FactPayloadKind } from "./canonical-fact-types";

export type FactTemporalSemantics = "ocorrencia" | "vigencia" | "periodo" | "ciclo";

export type CatalogSourceStatus = "persistida" | "futura";

export type FactTypeDefinition = {
  factTypeId: string;
  familyId: FactFamilyId;
  label: string;
  /** Única fonte canônica declarada. */
  sourceId: string;
  sourceStatus: CatalogSourceStatus;
  /** Chaves de `subject` que formam a unidade atômica. */
  granularity: readonly string[];
  temporal: FactTemporalSemantics;
  payloadKind: FactPayloadKind;
  note?: string;
};

export type FutureFamily = { familyId: FactFamilyId; label: string; legitimateSource: string };

export const FACT_CATALOG: readonly FactTypeDefinition[] = [
  {
    factTypeId: "frequencia-apurada-do-periodo",
    familyId: "vida-academica",
    label: "Frequência apurada do estudante no período",
    sourceId: "attendance_closing_versions",
    sourceStatus: "persistida",
    granularity: ["studentId", "classId", "periodId", "accountingUnitId"],
    temporal: "periodo",
    payloadKind: "quantitativo",
  },
  {
    factTypeId: "resultado-oficial-do-periodo",
    familyId: "vida-academica",
    label: "Resultado oficial do estudante no período",
    sourceId: "period_closing_versions",
    sourceStatus: "persistida",
    granularity: ["studentId", "classId", "periodId", "curriculumRef"],
    temporal: "periodo",
    payloadKind: "estruturado",
  },
  {
    factTypeId: "situacao-academica-oficial",
    familyId: "vida-academica",
    label: "Situação acadêmica oficial do estudante no ciclo",
    sourceId: "academic_standing_versions",
    sourceStatus: "persistida",
    granularity: ["studentId", "cycleId"],
    temporal: "ciclo",
    payloadKind: "categorico",
    note: "Fonte única: registro oficial 12I. A 12L só referencia; determinação provisória não entra.",
  },
  {
    factTypeId: "encerramento-da-turma-no-ciclo",
    familyId: "vida-academica",
    label: "Encerramento oficial da turma no ciclo",
    sourceId: "cycle_closing_versions",
    sourceStatus: "persistida",
    granularity: ["classId", "cycleId"],
    temporal: "ciclo",
    payloadKind: "estruturado",
    note: "Via 12L (projectClosingChain). Contagens do diagnóstico ficam só como proveniência.",
  },
  {
    factTypeId: "episodio-de-enturmacao",
    familyId: "populacao-matricula-movimentacao",
    label: "Episódio de enturmação do estudante",
    sourceId: "class_enrollment_episodes",
    sourceStatus: "persistida",
    granularity: ["studentId", "episodeId"],
    temporal: "vigencia",
    payloadKind: "referencial",
    note: "Com login, fonte única é o episódio no banco; a alocação 13C é só laboratório.",
  },
  {
    factTypeId: "vinculo-escolar",
    familyId: "populacao-matricula-movimentacao",
    label: "Vínculo (matrícula) do estudante com a escola",
    sourceId: "school_enrollments",
    sourceStatus: "persistida",
    granularity: ["studentId", "enrollmentId"],
    temporal: "vigencia",
    payloadKind: "categorico",
    note: "14.5: versão vigente da cadeia de correção; término e situação vêm de school_enrollment_endings.",
  },
  {
    factTypeId: "evento-de-movimentacao",
    familyId: "populacao-matricula-movimentacao",
    label: "Evento de movimentação escolar",
    sourceId: "student_movement_events",
    sourceStatus: "persistida",
    granularity: ["studentId", "movementId"],
    temporal: "ocorrencia",
    payloadKind: "categorico",
    note: "14.5: tipo homologado configurável; nunca deduzido do término de enturmação.",
  },
  {
    factTypeId: "identidade-cadastral-do-estudante",
    familyId: "identidade-do-estudante",
    label: "Sexo administrativo na versão cadastral vigente do estudante",
    sourceId: "student_identity_versions",
    sourceStatus: "persistida",
    granularity: ["studentId"],
    temporal: "vigencia",
    payloadKind: "categorico",
    note: "14.7: atributo corrigível por versão encadeada; data de nascimento fica na fonte e NÃO entra no fato (minimização).",
  },
  {
    factTypeId: "turno-da-turma",
    familyId: "oferta-e-turma",
    label: "Turno da turma na vigência declarada",
    sourceId: "class_shift_versions",
    sourceStatus: "persistida",
    granularity: ["classId"],
    temporal: "vigencia",
    payloadKind: "categorico",
    note: "14.7: pertence à turma, nunca copiado ao estudante; valor vem do catálogo homologado 'turno'.",
  },
  {
    factTypeId: "episodio-de-atuacao",
    familyId: "profissionais-lotacao-atuacao",
    label: "Episódio de atuação institucional da pessoa",
    sourceId: "institutional_engagements",
    sourceStatus: "persistida",
    granularity: ["personId", "engagementId"],
    temporal: "vigencia",
    payloadKind: "categorico",
  },
];

export const FUTURE_FAMILIES: readonly FutureFamily[] = [
  { familyId: "organizacao-escolar", label: "Unidade escolar (INEP, código de rede, endereço, distrito, localização)", legitimateSource: "Cadastro Institucional de Unidades Escolares (14.1.1)" },
  { familyId: "profissionais-lotacao-atuacao", label: "Vínculo funcional, lotação e função", legitimateSource: "Profissionais (Etapa 9) persistida" },
  { familyId: "educacao-especial-aee", label: "Educação especial / AEE", legitimateSource: "Domínio próprio futuro (sensível)" },
  { familyId: "transporte", label: "Transporte escolar", legitimateSource: "Domínio próprio futuro" },
  { familyId: "alimentacao", label: "Alimentação escolar", legitimateSource: "Domínio próprio futuro" },
  { familyId: "infraestrutura", label: "Infraestrutura da unidade", legitimateSource: "Cadastro da unidade (futuro)" },
  { familyId: "governanca-mapa-estatistico", label: "Envio, aprovação e override do Mapa", legitimateSource: "CIECE — ato versionado sobre projeção" },
  { familyId: "censo-educacenso", label: "Censo Escolar / Educacenso", legitimateSource: "CIECE — adaptador de exportação" },
  { familyId: "registro-institucional-de-visitas", label: "Visitas recebidas pela escola", legitimateSource: "Fonte canônica futura: Registro Institucional de Visitas (um evento por visita)" },
];

export function factTypeDefinition(id: string): FactTypeDefinition | undefined {
  return FACT_CATALOG.find((d) => d.factTypeId === id);
}

/** Uma fonte por tipo de fato: tipos duplicados no catálogo são erro. */
export function catalogDuplicates(catalog: readonly FactTypeDefinition[] = FACT_CATALOG): string[] {
  const seen = new Set<string>();
  const dup: string[] = [];
  for (const d of catalog) {
    if (seen.has(d.factTypeId)) dup.push(d.factTypeId);
    seen.add(d.factTypeId);
  }
  return dup;
}

const AGGREGATE_KEY = /^(count|total|rate|taxa|percent|percentual|quantidade|soma|media)|(Count|Total|Rate|Percent|Sum|Average)$/;

export type FactViolation = { factTypeId: string; code: string; detail: string };

/**
 * Guarda do adaptador: recusa fato fora do catálogo, publicado por fonte não
 * declarada, sem unidade atômica, com agregação/contagem/taxa, ou com conteúdo
 * quando o estado não é "disponível".
 */
export function validateFact(fact: CanonicalFact, sourceId: string): FactViolation[] {
  const def = factTypeDefinition(fact.factTypeId);
  const v = (code: string, detail: string): FactViolation => ({ factTypeId: fact.factTypeId, code, detail });
  if (!def) return [v("tipo-fora-do-catalogo", fact.factTypeId)];
  const out: FactViolation[] = [];
  if (def.sourceId !== sourceId) out.push(v("fonte-nao-declarada", sourceId));
  if (def.sourceStatus !== "persistida") out.push(v("fonte-futura", def.sourceId));
  for (const key of def.granularity) if (!fact.subject[key]) out.push(v("granularidade-incompleta", key));
  const keys = [...Object.keys(fact.subject), ...Object.keys(fact.dimensions)];
  if (fact.payload?.kind === "quantitativo") keys.push(...Object.keys(fact.payload.measures));
  if (fact.payload?.kind === "estruturado") keys.push(...Object.keys(fact.payload.data));
  for (const key of keys) if (AGGREGATE_KEY.test(key)) out.push(v("agregacao-como-fato", key));
  if (fact.availability !== "disponivel" && fact.payload !== null) out.push(v("conteudo-sem-disponibilidade", fact.availability));
  if (fact.payload && fact.payload.kind !== def.payloadKind) out.push(v("forma-de-conteudo-divergente", fact.payload.kind));
  if (!fact.provenance.recordId) out.push(v("sem-proveniencia", "recordId"));
  return out;
}
