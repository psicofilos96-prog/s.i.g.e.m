/** 14.13 — cada visita vira UM fato atômico; o CIECE nunca recebe contagem de visitas nem dado pessoal. */
import { CANONICAL_FACT_SCHEMA_VERSION, type CanonicalFact } from "./canonical-fact-types";
import { currentVersions } from "@/features/student-life/institutional-enrollment";
import type { VisitRow } from "@/features/school-visits/visit-record";

export function visitFacts(rows: readonly VisitRow[]): CanonicalFact[] {
  return currentVersions(rows).filter((v) => !v.annulled).map((v) => ({
    schemaVersion: CANONICAL_FACT_SCHEMA_VERSION, factTypeId: "visita-institucional", familyId: "registro-institucional-de-visitas",
    subject: { visitId: v.logical_id },
    dimensions: { schoolId: v.school_id, visitorKindId: v.visitor_kind_id },
    availability: "disponivel",
    payload: { kind: "categorico", categoryId: v.visitor_kind_id, schemeId: `tipo-de-visitante@${v.visitor_kind_version}` },
    temporal: { occurredAt: v.visited_on },
    provenance: { domainId: "14.13", sourceId: "institutional_visit_records", recordId: v.id, recordVersion: v.version, actRef: v.originating_act_ref },
  } as CanonicalFact));
}
