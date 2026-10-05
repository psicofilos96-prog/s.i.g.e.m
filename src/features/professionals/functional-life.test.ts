import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { functionalPicture, type Sources } from "./functional-life";

const base = { supersedes_id: null, recorded_at: "2026-01-01T00:00:00Z", version: 1 };
const src = (): Sources => ({
  links: [
    { ...base, id: "l1", logical_id: "L1", person_id: "p", functional_registration: "1", link_nature_id: "efetivo", position_id: "cargo-a", valid_from: "2020-01-01", valid_until: null },
    { ...base, id: "l2", logical_id: "L2", person_id: "p", functional_registration: "2", link_nature_id: "contrato", position_id: "cargo-b", valid_from: "2026-02-01", valid_until: "2026-06-30" },
  ],
  postings: [
    { ...base, id: "p1", logical_id: "P1", functional_link_logical_id: "L1", school_id: "e1", functional_status_id: null, valid_from: "2020-01-01", valid_until: null },
    { ...base, id: "p2", logical_id: "P2", functional_link_logical_id: "L2", school_id: "e1", functional_status_id: null, valid_from: "2026-02-01", valid_until: "2026-06-30" },
  ],
  exercises: [{ ...base, id: "x1", logical_id: "X1", functional_link_logical_id: "L1", posting_logical_id: "P1", school_id: "e1", function_id: "coordenacao", valid_from: "2026-01-01", valid_until: null, revoked: false }],
  qualifications: [{ ...base, id: "q1", logical_id: "Q1", person_id: "p", school_id: "e1", qualification_id: "hab-x", valid_from: null, valid_until: null, revoked: false }],
  events: [], processes: [], engagements: [],
});

describe("vida funcional", () => {
  it("dois vínculos simultâneos da mesma pessoa permanecem distintos", () => {
    const [p] = functionalPicture(src(), "e1", "2026-03-01", null);
    expect(p!.links.map((l) => [l.link.logical_id, l.validity])).toEqual([["L1", "vigente"], ["L2", "vigente"]]);
  });
  it("vínculo encerrado continua no histórico, fora da vigência", () => {
    const [p] = functionalPicture(src(), "e1", "2026-08-01", null);
    expect(p!.links.find((l) => l.link.logical_id === "L2")!.validity).toBe("fora-da-vigencia");
  });
  it("lotação, exercício e atuação são distintos; cargo/habilitação não geram atuação", () => {
    const [p] = functionalPicture(src(), "e1", "2026-03-01", null);
    expect(p!.links[0]!.exercises.map((e) => e.function_id)).toEqual(["coordenacao"]);
    expect(p!.engagements).toEqual([]);
    expect(p!.qualifications).toHaveLength(1);
  });
  it("retificação: knownAt anterior vê a versão antiga", () => {
    const s = src();
    s.links.push({ ...s.links[0]!, id: "l1b", version: 2, supersedes_id: "l1", position_id: "cargo-c", recorded_at: "2026-05-01T00:00:00Z" });
    expect(functionalPicture(s, "e1", "2026-03-01", "2026-04-01T00:00:00Z")[0]!.links[0]!.link.position_id).toBe("cargo-a");
    expect(functionalPicture(s, "e1", "2026-03-01", null)[0]!.links[0]!.link.position_id).toBe("cargo-c");
  });
  it("escola sem lotação ⇒ lista vazia (ausência, não zero inventado)", () => {
    expect(functionalPicture(src(), "e2", "2026-03-01", null)).toEqual([]);
  });
  it("início não informado não vira vigente", () => {
    const s = src(); s.postings[0] = { ...s.postings[0]!, valid_from: null };
    expect(functionalPicture(s, "e1", "2026-03-01", null)[0]!.links[0]!.postings[0]!.validity).toBe("inicio-nao-informado");
  });
  it("banco: append-only, leitura por capability da escola, sem folha e sem concessão de capability", () => {
    const sql = readFileSync("drizzle/migrations/0076_functional_life_exercise_qualification_process.sql", "utf8");
    expect(sql).toMatch(/forbid_mutation/);
    expect(sql).toMatch(/has_school_capability\(''consultar-registro-funcional''/);
    expect(sql).not.toMatch(/institutional_engagements\s*\(/i);
    expect(sql).not.toMatch(/salario|folha|previd|consign/i);
  });
});
