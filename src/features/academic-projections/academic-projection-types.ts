/**
 * Etapa 12L — Projeções Canônicas do Percurso Acadêmico (contratos).
 *
 * FRONTEIRA DE PUBLICAÇÃO, não nova verdade:
 *   12A–12J → 12K (snapshot oficial) → 12L (projeção canônica) → consumidores
 *
 * A projeção é representação reproduzível dos fatos já congelados pelo
 * encerramento. Ela não calcula, não interpreta, não decide efeito institucional
 * e não formata: não existe `textoBoletim`, `linhaHistorico`, `colunaAta` nem
 * rótulo de tela. Datas trafegam em ISO estruturado; DD/MM/AAAA é apresentação.
 *
 * REGRAS DO CONTRATO
 * - Identificadores são ABERTOS (`dimensionKindId`, `issueTypeId`, `status`,
 *   `sourceTypeId`): tipos conhecidos vivem em cadastros e fixtures, nunca aqui.
 * - Ausência permanece ausência: `null` é indisponibilidade real e campo omitido
 *   é ausência legítima. Nada é convertido em zero, `false` ou "—".
 * - Nada derivável é duplicado: a vigência da versão vem da cadeia e a existência
 *   de situação terminal vem da própria `resolution`.
 * - Rótulos preservados são SNAPSHOTS históricos (`labelSnapshot`), nunca
 *   identidade da dimensão.
 */
import type { FactProvenance, StandingValue } from "@/features/assessment/academic-standing-types";

/**
 * Versão do CONTRATO técnico da projeção — distinta da versão acadêmica do
 * encerramento (`closingVersion`). Permite migrar a fronteira sem destruir a
 * compatibilidade de documentos, CIECE, portais e integrações antigas.
 */
export const ACADEMIC_PROJECTION_SCHEMA_VERSION = 1;

// --------------------------------------------------------------- Referências

/** Escopo aberto: dimensões declaradas, sem vocabulário normativo no contrato. */
export type ProjectionScopeReference = {
  scopeKey?: string;
  dimensions: Readonly<Record<string, string | undefined>>;
};

export type ProjectionSourceReference = {
  kind: string;
  id: string;
  version?: number;
  state?: string;
  labelSnapshot?: string;
  materializedAt?: string;
};

export type AcademicProvenanceProjection = {
  closingSnapshotId: string;
  closingVersion: number;
  policyId: string;
  policyVersion: number;
  materializedAt: string;
  precedingClosingId?: string;
  sourceReferences: readonly ProjectionSourceReference[];
};

// -------------------------------------------------------------------- Fatos

export type ProjectionFact = {
  factId: string;
  /** Denominação vigente no encerramento. Não é identidade do fato. */
  labelSnapshot?: string;
  /** `null` = fato indisponível. Jamais substituído por zero ou presunção. */
  value: StandingValue | readonly StandingValue[] | null;
  unit?: string;
  unavailableReason?: string;
  scopeReference: ProjectionScopeReference;
  provenance: FactProvenance;
};

/**
 * Dimensão acadêmica genérica: componente, campo de experiência, área, eixo,
 * projeto, oficina, itinerário, escopo de frequência ou qualquer estrutura
 * futura. O projetor central não precisa conhecer nenhuma delas.
 */
export type AcademicDimensionProjection = {
  dimensionId: string;
  dimensionKindId: string;
  dimensionDefinitionId?: string;
  parentDimensionId?: string;
  labelSnapshot?: string;
  scopeReference: ProjectionScopeReference;
  facts: readonly ProjectionFact[];
};

// ---------------------------------------------------------------- Pendências

/**
 * Pendência estruturada: consultável por identificador, nunca só por texto.
 * `issueTypeId` e `status` são identificadores abertos.
 */
export type AcademicProjectionIssue = {
  issueId: string;
  issueTypeId: string;
  status: string;
  scopeReference: ProjectionScopeReference;
  sourceReference?: ProjectionSourceReference;
  description?: string;
};

// ----------------------------------------------------------------- Resolução

/**
 * Resolução oficial do percurso. Fonte única: a ausência de `standingId` é a
 * própria ausência de situação acadêmica — não existe indicador paralelo.
 */
export type AcademicResolutionProjection = {
  sourceTypeId?: string;
  standingId?: string;
  /** Estado de completude declarado pelo encerramento (identificador aberto). */
  completeness: string;
  reason?: string;
};

// ---------------------------------------------------------------- Projeções

export type AcademicAttendanceProjection = {
  /** Fatos de frequência não dimensionais, identificados semanticamente. */
  facts: readonly ProjectionFact[];
  /** Frequência por dimensão declarada (componente, turno, escopo, outra). */
  dimensions: readonly AcademicDimensionProjection[];
};

export type StudentAcademicCycleProjection = {
  projectionSchemaVersion: number;
  studentId: string;
  studentNameSnapshot?: string;
  classId: string;
  cycleId: string;
  closingSnapshotId: string;
  closingVersion: number;
  /** DERIVADO da cadeia de encerramentos; nunca estado editável persistido. */
  isCurrentClosingVersion: boolean;
  institutionalState: string;
  cycleStartDate?: string;
  cycleEndDate?: string;
  academicYearId?: string;
  resolution: AcademicResolutionProjection;
  /** Percurso quantitativo e qualitativo, sem achatamento. */
  dimensions: readonly AcademicDimensionProjection[];
  attendance: AcademicAttendanceProjection;
  /** Fatos do percurso que não pertencem a nenhuma dimensão. */
  facts: readonly ProjectionFact[];
  deliberations: readonly ProjectionSourceReference[];
  issues: readonly AcademicProjectionIssue[];
  provenance: AcademicProvenanceProjection;
};

export type ClassAcademicCycleProjection = {
  projectionSchemaVersion: number;
  closingSnapshotId: string;
  closingVersion: number;
  precedingClosingId?: string;
  isCurrentClosingVersion: boolean;
  classId: string;
  cycleId: string;
  unitId?: string;
  academicYearId?: string;
  /** Temporalidade genérica: o contrato não depende do conceito de "ano". */
  cycleStartDate?: string;
  cycleEndDate?: string;
  institutionalState: string;
  act: {
    actId: string;
    kindId: string;
    kindLabelSnapshot: string;
    declaredAt: string;
    declaredByActorId: string;
    declaredByActorNameSnapshot: string;
    justification?: string;
    supersedesClosingId?: string;
  };
  /** Fatos do diagnóstico registrado no encerramento, sem reinterpretação. */
  diagnosisSummary: {
    statusCounts: Readonly<Record<string, number>>;
    applicableMandatory: number;
    satisfiedMandatory: number;
    closable: boolean;
  };
  students: readonly StudentAcademicCycleProjection[];
  dimensions: readonly AcademicDimensionProjection[];
  attendance: AcademicAttendanceProjection;
  facts: readonly ProjectionFact[];
  issues: readonly AcademicProjectionIssue[];
  provenance: AcademicProvenanceProjection;
};

export const ACADEMIC_PROJECTION_MODULE_LABEL = "Projeção canônica do percurso acadêmico";

export const ACADEMIC_PROJECTION_MODULE_NOTE =
  "A projeção publica, em formato estável e rastreável, os fatos acadêmicos oficiais congelados pelo encerramento do ciclo: resultados por dimensão, frequência global e dimensional, deliberações, resolução do percurso quando existir, pendências estruturadas e a proveniência exata das fontes com suas versões. Ela não calcula, não interpreta e não formata nada: cada consumidor futuro decide o que fazer com o fato, e a ausência de dado permanece ausência.";
