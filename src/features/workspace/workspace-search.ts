/**
 * Etapa 13G — Busca Universal segura contra INFERÊNCIA.
 *
 * A autorização acontece ANTES da formação do conjunto pesquisável. Atributo
 * não autorizado não revela ninguém por autocomplete, snippet, destaque,
 * contagem de resultados nem filtro lateral — exatamente a garantia da 13F.
 *
 * O identificador técnico interno NÃO é critério comum de pesquisa: só é
 * indexado quando o agente possui a capacidade declarada para isso.
 */
import type {
  InstitutionalScopeReference,
  WorkspaceAccessContext,
  WorkspaceDeepLink,
} from "./workspace-types";

export type SearchableAttributeDescriptor = {
  attributeDefinitionId: string;
  labelSnapshot: string;
  value: string;
  /** Capacidades exigidas para o atributo ser pesquisável e exibível. */
  requiredCapacityDefinitionIds: readonly string[];
  /** Identificador institucional exibível (preferencial na experiência). */
  institutionalIdentifier?: boolean;
  /** Identificador técnico interno: nunca critério comum de atendimento. */
  technicalIdentifier?: boolean;
};

export type SearchableSubjectDescriptor = {
  subjectEntityId: string;
  subjectTypeDefinitionId: string;
  scopeEntities: readonly InstitutionalScopeReference[];
  attributes: readonly SearchableAttributeDescriptor[];
  deepLink: WorkspaceDeepLink;
};

export type WorkspaceSearchHit = {
  subjectEntityId: string;
  subjectTypeDefinitionId: string;
  /** Rótulo formado APENAS por atributos autorizados. */
  displaySnapshot: string;
  matchedAttributeDefinitionIds: readonly string[];
  authorizedAttributes: readonly {
    attributeDefinitionId: string;
    labelSnapshot: string;
    value: string;
  }[];
  deepLink: WorkspaceDeepLink;
};

function scopeIntersects(
  actorScopes: readonly InstitutionalScopeReference[],
  subjectScopes: readonly InstitutionalScopeReference[],
): boolean {
  return actorScopes.some((scope) =>
    subjectScopes.some((other) => other.entityId === scope.entityId),
  );
}

function isAttributeAuthorized(
  attribute: SearchableAttributeDescriptor,
  context: WorkspaceAccessContext,
): boolean {
  if (attribute.requiredCapacityDefinitionIds.length === 0) return false; // falha fechada
  return attribute.requiredCapacityDefinitionIds.every((capacity) =>
    context.capacityDefinitionIds.includes(capacity),
  );
}

/**
 * Conjunto pesquisável AUTORIZADO. Sujeitos fora do escopo do agente, ou sem
 * nenhum atributo autorizado, simplesmente não existem para a busca.
 */
export function buildAuthorizedSearchIndex(input: {
  subjects: readonly SearchableSubjectDescriptor[];
  context: WorkspaceAccessContext;
}): readonly {
  subject: SearchableSubjectDescriptor;
  authorizedAttributes: readonly SearchableAttributeDescriptor[];
}[] {
  const index: {
    subject: SearchableSubjectDescriptor;
    authorizedAttributes: readonly SearchableAttributeDescriptor[];
  }[] = [];

  for (const subject of input.subjects) {
    if (!scopeIntersects(input.context.institutionalScopes, subject.scopeEntities)) {
      continue;
    }
    const authorizedAttributes = subject.attributes.filter((attribute) =>
      isAttributeAuthorized(attribute, input.context),
    );
    if (authorizedAttributes.length === 0) continue;
    index.push({ subject, authorizedAttributes });
  }

  return index;
}

/** Busca sobre o conjunto autorizado; nada fora dele é revelado nem contado. */
export function searchAuthorizedSubjects(input: {
  query: string;
  subjects: readonly SearchableSubjectDescriptor[];
  context: WorkspaceAccessContext;
}): readonly WorkspaceSearchHit[] {
  const needle = input.query.trim().toLocaleLowerCase("pt-BR");
  if (needle.length === 0) return [];

  const index = buildAuthorizedSearchIndex({
    subjects: input.subjects,
    context: input.context,
  });

  const hits: WorkspaceSearchHit[] = [];
  for (const entry of index) {
    const matched = entry.authorizedAttributes.filter((attribute) =>
      attribute.value.toLocaleLowerCase("pt-BR").includes(needle),
    );
    if (matched.length === 0) continue;

    const display =
      entry.authorizedAttributes.find(
        (attribute) => !attribute.technicalIdentifier && !attribute.institutionalIdentifier,
      ) ??
      entry.authorizedAttributes.find((attribute) => attribute.institutionalIdentifier) ??
      entry.authorizedAttributes[0];

    hits.push({
      subjectEntityId: entry.subject.subjectEntityId,
      subjectTypeDefinitionId: entry.subject.subjectTypeDefinitionId,
      displaySnapshot: display ? display.value : "",
      matchedAttributeDefinitionIds: matched.map(
        (attribute) => attribute.attributeDefinitionId,
      ),
      authorizedAttributes: entry.authorizedAttributes.map((attribute) => ({
        attributeDefinitionId: attribute.attributeDefinitionId,
        labelSnapshot: attribute.labelSnapshot,
        value: attribute.value,
      })),
      deepLink: entry.subject.deepLink,
    });
  }

  hits.sort((left, right) => left.displaySnapshot.localeCompare(right.displaySnapshot, "pt-BR"));
  return hits;
}
