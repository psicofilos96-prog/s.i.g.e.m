import { describe, expect, it } from "vitest";
import { functionalPicture, type Sources } from "./functional-life";

// NPROF.1 — profissional em duas escolas com mudança de lotação e atuação encerrada.
const base = { supersedes_id: null, recorded_at: "2026-01-01T00:00:00Z", version: 1 };
const eng = (id: string, school: string, from: string, until: string | null) => ({ id, person_id: "p", engagement_kind_id: "docencia", school_id: school, scope_level: "escola", valid_from: from, valid_until: until, created_at: "2026-01-01T00:00:00Z" });
const src = (endings: Sources["engagementEndings"] = []): Sources => ({
  links: [{ ...base, id: "l1", logical_id: "L1", person_id: "p", functional_registration: "1", link_nature_id: "efetivo", position_id: null, valid_from: "2020-01-01", valid_until: null }],
  postings: [
    { ...base, id: "pA", logical_id: "PA", functional_link_logical_id: "L1", school_id: "eA", functional_status_id: null, valid_from: "2026-01-01", valid_until: "2026-04-30" },
    { ...base, id: "pB", logical_id: "PB", functional_link_logical_id: "L1", school_id: "eB", functional_status_id: null, valid_from: "2026-05-01", valid_until: null },
  ],
  exercises: [], qualifications: [], events: [], processes: [],
  engagements: [eng("gA", "eA", "2026-01-01", null), eng("gB", "eB", "2026-05-01", null)],
  engagementEndings: endings,
});

describe("NPROF.1 — trajetória do profissional por data", () => {
  it("lotação muda de escola sem apagar o passado", () => {
    const [a] = functionalPicture(src(), "eA", "2026-06-01", null);
    expect(a!.links[0]!.postings.map((p) => p.validity)).toEqual(["fora-da-vigencia"]);
    const [aPast] = functionalPicture(src(), "eA", "2026-03-01", null);
    expect(aPast!.links[0]!.postings[0]!.validity).toBe("vigente");
    const [b] = functionalPicture(src(), "eB", "2026-06-01", null);
    expect(b!.links[0]!.postings[0]!.validity).toBe("vigente");
  });

  it("atuação encerrada por ato próprio deixa de aparecer a partir do fim, mas aparece antes", () => {
    const endings = [{ engagement_id: "gA", ended_on: "2026-04-30", created_at: "2026-04-30T12:00:00Z" }];
    expect(functionalPicture(src(endings), "eA", "2026-05-15", null)[0]!.engagements).toEqual([]);
    expect(functionalPicture(src(endings), "eA", "2026-03-01", null)[0]!.engagements.map((e) => e.id)).toEqual(["gA"]);
  });

  it("encerramento registrado depois do knownAt não reescreve o que se sabia", () => {
    const endings = [{ engagement_id: "gA", ended_on: "2026-04-30", created_at: "2026-06-01T00:00:00Z" }];
    expect(functionalPicture(src(endings), "eA", "2026-05-15", "2026-05-20T00:00:00Z")[0]!.engagements.map((e) => e.id)).toEqual(["gA"]);
  });

  it("encerramentos ilegíveis: atuação não é afirmada como vigente", () => {
    expect(functionalPicture(src(null), "eB", "2026-06-01", null)[0]!.engagements).toEqual([]);
  });

  it("atuação de outra escola não aparece", () => {
    expect(functionalPicture(src(), "eB", "2026-06-01", null)[0]!.engagements.map((e) => e.id)).toEqual(["gB"]);
  });
});
