import { describe, expect, it } from "vitest";
import { projectMappings, usableAsEquivalence, checkProposal, mappingForHistoricalAssessment } from "./aa-skill-mapping";
import type { RelationAt } from "@/features/curricular-reference/reference-source";

const rel = (o: Partial<RelationAt>): RelationAt => ({ relation_id: "r1", direction: "saida", other_item_id: "saeb-D1", other_code: "D1", other_source_id: "saeb", other_edition_label: "SAEB 2018",
  origin: null, nature: "equivalente", relation_direction: null, justification: "mesma operação", criteria: null, official_locator: "p.12", homologation: "homologada", recorded_at: "2026-03-01T00:00:00Z", ...o });

describe("A&A Lote 03 mapeamento habilidade ↔ referência", () => {
  it("não lido nunca vira lista vazia", () => {
    expect(projectMappings({ itemId: "EF02LP01", knownAt: "2026-10-12", relations: null, noCorrespondence: [] }).state).toBe("nao-lido");
  });
  it("natureza desconhecida ou não homologada nunca é equivalência", () => {
    const r = projectMappings({ itemId: "x", knownAt: "k", relations: [rel({}), rel({ relation_id: "r2", nature: "misteriosa" }), rel({ relation_id: "r3", homologation: "nao-homologada" })],
      noCorrespondence: [{ assessment_id: "a", target_source_id: "saeb", version_no: 1, justification: "sem descritor", criteria: {}, homologation: "homologada", recorded_at: "2026-01-01" }] });
    if (r.state !== "lido") throw new Error();
    expect(r.mappings.map((m) => m.kind)).toEqual(["direta", "tematica", "direta", "nao-estabelecida"]);
    expect(r.mappings.map(usableAsEquivalence)).toEqual([true, false, false, false]);
  });
  it("proposta exige autoria, justificativa, fonte e vigência; escolhe o writer canônico", () => {
    const base = { itemId: "x", otherItemId: "y", targetSource: "saeb", kind: "parcial" as const, justification: "j", sourceLocator: "p.1", validFrom: "2026-02-01", authorPersonId: "p" };
    expect(checkProposal(base)).toEqual({ ok: true, writer: "record_curricular_reference_relation" });
    expect(checkProposal({ ...base, authorPersonId: null, justification: " " }).ok).toBe(false);
    expect(checkProposal({ ...base, kind: "nao-estabelecida" }).ok).toBe(false);
    expect(checkProposal({ ...base, kind: "nao-estabelecida", otherItemId: null })).toMatchObject({ writer: "record_curricular_reference_no_correspondence" });
  });
  it("avaliação histórica usa o mapeamento da data de aplicação", () => {
    const r = projectMappings({ itemId: "x", knownAt: "k", relations: [rel({ recorded_at: "2025-01-01", nature: "tematica" }), rel({ relation_id: "r2", recorded_at: "2026-05-01" })], noCorrespondence: [] });
    if (r.state !== "lido") throw new Error();
    expect(mappingForHistoricalAssessment("2025-11-10", r.mappings)?.kind).toBe("tematica");
    expect(mappingForHistoricalAssessment("2024-01-01", r.mappings)).toBeNull();
  });
});
