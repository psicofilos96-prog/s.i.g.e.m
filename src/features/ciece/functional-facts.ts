/** 14.12 — fatos atômicos do registro funcional; o CIECE nunca recebe contagem de pessoal. */
import { CANONICAL_FACT_SCHEMA_VERSION, type CanonicalFact } from "./canonical-fact-types";
import { currentVersions } from "@/features/student-life/institutional-enrollment";
import type { FunctionalEventRow, FunctionalLinkRow, PostingRow } from "@/features/professionals/functional-record";

export function postingFacts(postings: readonly PostingRow[], links: readonly FunctionalLinkRow[]): CanonicalFact[] {
  const link = new Map(currentVersions(links).map((l) => [l.logical_id, l]));
  return currentVersions(postings).map((p) => {
    const l = link.get(p.functional_link_logical_id);
    return {
      schemaVersion: CANONICAL_FACT_SCHEMA_VERSION, factTypeId: "episodio-de-lotacao", familyId: "profissionais-lotacao-atuacao",
      subject: { ...(l ? { personId: l.person_id } : {}), functionalLinkId: p.functional_link_logical_id, postingId: p.logical_id },
      dimensions: { schoolId: p.school_id, ...(p.function_id ? { functionId: p.function_id } : {}), ...(p.functional_status_id ? { functionalStatusId: p.functional_status_id } : {}), ...(l?.position_id ? { positionId: l.position_id } : {}) },
      availability: p.valid_from ? "disponivel" : "indeterminado",
      payload: p.valid_from ? { kind: "categorico", categoryId: p.function_id, schemeId: p.function_id ? `funcao@${p.function_version}` : undefined } : null,
      temporal: p.valid_from ? { validFrom: p.valid_from, validTo: p.valid_until } : {},
      provenance: { domainId: "14.12", sourceId: "professional_postings", recordId: p.id, recordVersion: p.version, actRef: p.originating_act_ref,
        sources: l ? [{ kind: "professional_functional_links", id: l.id, version: l.version }] : [] },
    } as CanonicalFact;
  });
}

export function functionalEventFacts(events: readonly FunctionalEventRow[]): CanonicalFact[] {
  return currentVersions(events).map((e) => ({
    schemaVersion: CANONICAL_FACT_SCHEMA_VERSION, factTypeId: "alteracao-funcional", familyId: "profissionais-lotacao-atuacao",
    subject: { functionalLinkId: e.functional_link_logical_id, eventId: e.logical_id },
    dimensions: { schoolId: e.school_id, eventKindId: e.event_kind_id },
    availability: e.occurred_on ? "disponivel" : "indeterminado",
    payload: e.occurred_on ? { kind: "categorico", categoryId: e.event_kind_id, schemeId: `natureza-de-alteracao-funcional@${e.event_kind_version}` } : null,
    temporal: e.occurred_on ? { occurredAt: e.occurred_on } : {},
    provenance: { domainId: "14.12", sourceId: "professional_functional_events", recordId: e.id, recordVersion: e.version, actRef: e.originating_act_ref },
  } as CanonicalFact));
}
