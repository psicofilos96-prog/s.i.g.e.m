import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aggregateCapacity, buildTree, spaceOn, usableType, validateParent, validateSpaceVersion, type Space, type SpaceTypeVersion, type SpaceVersion } from "./infrastructure-spaces";

const T = (id: string, version: number, level: SpaceTypeVersion["level"], approved = true, approver = "p2"): SpaceTypeVersion => ({
  id, typeKey: `k-${level}`, version, level, label: level, allowedConditions: ["boa", "ruim"], accessibilityFeatures: ["rampa"],
  capacityUnit: "pessoas", authorPerson: "p1", approval: approved ? { approverPerson: approver, decisionRef: "Ata 1" } : null });
const sp = (id: string, level: Space["level"], parentId: string | null, schoolId = "e1"): Space => ({ id, schoolId, parentId, level });
const V = (spaceId: string, version: number, x: Partial<SpaceVersion> = {}): SpaceVersion => ({
  spaceId, version, typeVersionId: "t", name: spaceId, capacity: null, capacitySource: null, accessibility: [], condition: null,
  conditionAssessedOn: null, restrictions: null, validFrom: "2026-01-01", status: "ativo", authorPerson: "p1", reason: null, ...x });
const SQL = readFileSync("drizzle/migrations/0405_ops03_infrastructure_spaces.sql", "utf8");

describe("Centro de Operações L03 — hierarquia física", () => {
  it("tipo só utilizável na última versão aprovada por outra pessoa", () => {
    const types = [T("a1", 1, "ambiente"), T("a2", 2, "ambiente", false)];
    expect(usableType(types, "a1")).toBeNull();
    expect(usableType([T("a1", 1, "ambiente")], "a1")).not.toBeNull();
    expect(usableType([T("a1", 1, "ambiente", true, "p1")], "a1")).toBeNull();
  });
  it("hierarquia: pai do nível imediatamente acima e da mesma escola", () => {
    expect(validateParent("predio", null, "e1")).toBeNull();
    expect(validateParent("ambiente", sp("b", "predio", null), "e1")).toMatch(/pavimento/);
    expect(validateParent("pavimento", sp("b", "predio", null, "e2"), "e1")).toMatch(/outra escola/);
  });
  it("condição e acessibilidade só do tipo; capacidade e condição exigem fonte/data", () => {
    const t = T("a1", 1, "ambiente");
    const base = { typeVersionId: "a1", name: "Sala 1", capacity: 30, capacitySource: null, accessibility: ["elevador"], condition: "otima",
      conditionAssessedOn: null, restrictions: null, validFrom: "2026-01-01", status: "ativo" as const, reason: null };
    const p = validateSpaceVersion(base, sp("s", "ambiente", "f"), t, "2026-10-12").join(" ");
    expect(p).toMatch(/Condição não configurada/);
    expect(p).toMatch(/acessibilidade não configurado/);
    expect(p).toMatch(/Capacidade exige fonte/);
    expect(p).toMatch(/data de avaliação/);
  });
  it("histórico: versão vigente na data e árvore com ausências declaradas", () => {
    const spaces = [sp("b", "predio", null), sp("f", "pavimento", "b"), sp("s1", "ambiente", "f"), sp("s2", "ambiente", "f")];
    const vs = [V("b", 1), V("f", 1), V("s1", 1, { capacity: 30, capacitySource: "medição" }), V("s1", 2, { validFrom: "2026-06-01", capacity: 25, capacitySource: "laudo", reason: "Reforma reduziu a área." }), V("s2", 1)];
    expect(spaceOn(vs, "s1", "2026-05-31")!.capacity).toBe(30);
    expect(spaceOn(vs, "s1", "2026-06-01")!.capacity).toBe(25);
    const tree = buildTree("e1", spaces, vs, "2026-07-01")[0]!;
    expect(tree.children[0]!.children.map((c) => c.capacityLabel)).toEqual(["25 (fonte: laudo)", "não informada"]);
    expect(aggregateCapacity(tree)).toEqual({ value: null, missing: 1 });
    expect(tree.children[0]!.children[1]!.conditionLabel).toBe("não avaliada");
  });
  it("banco: append-only, capacidades, autoaprovação recusada, tipo aprovado, base esperada, sem retroagir", () => {
    for (const t of ["opsst_immutable", "opssta_immutable", "opss_immutable", "opssv_immutable"]) expect(SQL).toContain(`${t} BEFORE UPDATE OR DELETE`);
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
    expect(SQL).toMatch(/has_network_capability\('configurar-tipos-de-espaco'\)/);
    expect(SQL).toMatch(/has_network_capability\('aprovar-tipos-de-espaco'\)/);
    expect(SQL).toMatch(/opstype:self-approval/);
    expect(SQL).toMatch(/has_school_capability\('manter-espacos-escolares'/);
    expect(SQL).toMatch(/opsspace:type-not-approved/);
    expect(SQL).toMatch(/opsspace:conflict/);
    expect(SQL).toMatch(/opsspace:retroactive/);
    expect(SQL).toMatch(/REFERENCES public\.institutional_schools\(id\)/);
  });
});
