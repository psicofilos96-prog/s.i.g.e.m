/**
 * Etapa 13F — Projeção longitudinal e busca autorizada.
 *
 * ORDEM OBRIGATÓRIA
 *   consulta + ator + capacidades + finalidade + escopo
 *     → conjunto AUTORIZADO
 *       → projeção / busca / timeline
 *
 * Nunca "montar tudo e esconder depois": conteúdo não autorizado não entra na
 * projeção, na busca textual, em snippets nem em metadados.
 *
 * A timeline NÃO conhece capítulos do plano de desenvolvimento: a origem é
 * `sourceTypeDefinitionId` resolvido por catálogo. Superação é DERIVADA.
 */
import {
  redactPayload,
  selectAuthorizedResources,
  type AccessEffectRegistry,
} from "./dossier-access";
import type {
  AccessDecision,
  AccessRequestFacts,
  DossierAccessPolicy,
  GovernedResourceDescriptor,
  StudentLifeTimelineProjection,
  TimelineItem,
} from "./dossier-types";
import { STUDENT_LIFE_TIMELINE_PROJECTION_SCHEMA_VERSION } from "./dossier-types";

/** Candidato à timeline, produzido por um adaptador de fonte registrado. */
export type TimelineCandidate = {
  sourceTypeDefinitionId: string;
  resource: GovernedResourceDescriptor;
  payload: Readonly<Record<string, unknown>>;
  effectiveDate: string;
  recordedAt: string;
  titleSnapshot?: string;
  summary?: string;
  /** Entidade que este candidato retifica/substitui, quando houver. */
  supersedesEntityId?: string;
  /** Alunos referidos pelo candidato (um acontecimento pode envolver vários). */
  subjectStudentIds: readonly string[];
};

/** Adaptador aberto: traduz entidades de QUALQUER domínio em candidatos. */
export type TimelineSourceAdapter = (
  entity: unknown,
) => TimelineCandidate | null;

export type TimelineSourceRegistry = Map<string, TimelineSourceAdapter>;

export function createTimelineSourceRegistry(): TimelineSourceRegistry {
  return new Map();
}

export function registerTimelineSource(
  registry: TimelineSourceRegistry,
  sourceTypeDefinitionId: string,
  adapter: TimelineSourceAdapter,
): TimelineSourceRegistry {
  registry.set(sourceTypeDefinitionId, adapter);
  return registry;
}

export type TimelineSourceInput = {
  sourceTypeDefinitionId: string;
  entities: readonly unknown[];
};

function withinWindow(
  isoDate: string,
  window?: { from?: string; to?: string },
): boolean {
  if (!window) return true;
  if (window.from && isoDate < window.from) return false;
  if (window.to && isoDate > window.to) return false;
  return true;
}

function buildCandidates(input: {
  sources: readonly TimelineSourceInput[];
  registry: TimelineSourceRegistry;
  diagnostics: string[];
}): readonly TimelineCandidate[] {
  const candidates: TimelineCandidate[] = [];
  for (const source of input.sources) {
    const adapter = input.registry.get(source.sourceTypeDefinitionId);
    if (!adapter) {
      input.diagnostics.push(
        `Fonte "${source.sourceTypeDefinitionId}" sem adaptador registrado: nada é projetado a partir dela.`,
      );
      continue;
    }
    for (const entity of source.entities) {
      const candidate = adapter(entity);
      if (candidate) candidates.push(candidate);
    }
  }
  return candidates;
}

/**
 * Projeta a linha do tempo do aluno. A superação é derivada da cadeia completa
 * de candidatos (inclusive dos não autorizados), mas a existência de recursos
 * não autorizados nunca é revelada ao consumidor.
 */
export function projectStudentLifeTimeline(input: {
  studentId: string;
  policy: DossierAccessPolicy;
  facts: AccessRequestFacts;
  sources: readonly TimelineSourceInput[];
  registry: TimelineSourceRegistry;
  accessRegistry?: AccessEffectRegistry;
  window?: { from?: string; to?: string };
  producedAt: string;
}): StudentLifeTimelineProjection {
  const diagnostics: string[] = [];
  const allCandidates = buildCandidates({
    sources: input.sources,
    registry: input.registry,
    diagnostics,
  });

  // Superação DERIVADA: mapa `entidade superada → entidade que a superou`.
  const supersededBy = new Map<string, string>();
  for (const candidate of allCandidates) {
    if (candidate.supersedesEntityId) {
      supersededBy.set(
        candidate.supersedesEntityId,
        candidate.resource.reference.entityId,
      );
    }
  }

  const pertinent = allCandidates.filter(
    (candidate) =>
      candidate.subjectStudentIds.includes(input.studentId) &&
      withinWindow(candidate.effectiveDate, input.window),
  );

  const selection = selectAuthorizedResources({
    policy: input.policy,
    facts: input.facts,
    resources: pertinent.map((candidate) => candidate.resource),
    ...(input.accessRegistry ? { registry: input.accessRegistry } : {}),
  });
  diagnostics.push(...selection.diagnostics);

  const decisionByResourceId = new Map<string, AccessDecision>();
  for (const entry of selection.authorized) {
    decisionByResourceId.set(entry.resource.reference.entityId, entry.decision);
  }

  const items: TimelineItem[] = [];
  for (const candidate of pertinent) {
    const decision = decisionByResourceId.get(
      candidate.resource.reference.entityId,
    );
    if (!decision) continue; // não autorizado: não entra na projeção.
    const { authorizedPayload, redactedFieldPaths } = redactPayload({
      payload: candidate.payload,
      resource: candidate.resource,
      decision,
    });
    items.push({
      timelineItemId: `${candidate.sourceTypeDefinitionId}:${candidate.resource.reference.entityId}`,
      sourceTypeDefinitionId: candidate.sourceTypeDefinitionId,
      sourceEntityReference: candidate.resource.reference,
      sourceProjectionSchemaVersion:
        STUDENT_LIFE_TIMELINE_PROJECTION_SCHEMA_VERSION,
      effectiveDate: candidate.effectiveDate,
      recordedAt: candidate.recordedAt,
      ...(candidate.titleSnapshot
        ? { titleSnapshot: candidate.titleSnapshot }
        : {}),
      ...(candidate.summary ? { summary: candidate.summary } : {}),
      sensitivityLevelDefinitionId:
        candidate.resource.sensitivityLevelDefinitionId,
      supersededByEntityId:
        supersededBy.get(candidate.resource.reference.entityId) ?? null,
      redactedFieldPaths: [
        ...new Set([
          ...redactedFieldPaths,
          ...(decision.outcome.redactedFieldPaths ?? []),
        ]),
      ],
      authorizedPayload,
    });
  }

  items.sort((left, right) =>
    left.effectiveDate === right.effectiveDate
      ? left.timelineItemId.localeCompare(right.timelineItemId)
      : left.effectiveDate.localeCompare(right.effectiveDate),
  );

  return {
    projectionSchemaVersion: STUDENT_LIFE_TIMELINE_PROJECTION_SCHEMA_VERSION,
    producedAt: input.producedAt,
    studentId: input.studentId,
    ...(input.window ? { window: input.window } : {}),
    policyId: input.policy.policyId,
    policyVersion: input.policy.policyVersion,
    items,
    diagnostics,
  };
}

export type DossierSearchHit = {
  sourceTypeDefinitionId: string;
  sourceEntityReference: GovernedResourceDescriptor["reference"];
  effectiveDate: string;
  /** Trecho extraído SOMENTE de campos autorizados. */
  snippet?: string;
  matchedFieldPaths: readonly string[];
};

/**
 * Busca textual autorizada: a consulta roda sobre o conjunto já autorizado e
 * apenas em campos liberados. Um ator sem acesso não descobre a existência do
 * registro pesquisando uma palavra do conteúdo dele.
 */
export function searchAuthorizedDossier(input: {
  query: string;
  studentId: string;
  policy: DossierAccessPolicy;
  facts: AccessRequestFacts;
  sources: readonly TimelineSourceInput[];
  registry: TimelineSourceRegistry;
  accessRegistry?: AccessEffectRegistry;
  producedAt: string;
}): {
  hits: readonly DossierSearchHit[];
  diagnostics: readonly string[];
} {
  const projection = projectStudentLifeTimeline({
    studentId: input.studentId,
    policy: input.policy,
    facts: input.facts,
    sources: input.sources,
    registry: input.registry,
    ...(input.accessRegistry ? { accessRegistry: input.accessRegistry } : {}),
    producedAt: input.producedAt,
  });

  const needle = input.query.trim().toLocaleLowerCase("pt-BR");
  if (needle.length === 0) {
    return { hits: [], diagnostics: projection.diagnostics };
  }

  const hits: DossierSearchHit[] = [];
  for (const item of projection.items) {
    const matchedFieldPaths: string[] = [];
    let snippet: string | undefined;
    for (const [key, value] of Object.entries(item.authorizedPayload)) {
      if (typeof value !== "string") continue;
      if (value.toLocaleLowerCase("pt-BR").includes(needle)) {
        matchedFieldPaths.push(key);
        snippet ??= value.slice(0, 160);
      }
    }
    if (matchedFieldPaths.length === 0) continue;
    hits.push({
      sourceTypeDefinitionId: item.sourceTypeDefinitionId,
      sourceEntityReference: item.sourceEntityReference,
      effectiveDate: item.effectiveDate,
      ...(snippet ? { snippet } : {}),
      matchedFieldPaths,
    });
  }

  return { hits, diagnostics: projection.diagnostics };
}
