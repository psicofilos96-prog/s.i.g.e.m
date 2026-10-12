import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AREAS, areaCapabilities, segregationViolations, verbMatrix, verbOf, type PolicyRule } from "./institutional-profiles";
import { CAPABILITY_INVENTORY } from "../institutional-admin/capability-matrix";

const snap = JSON.parse(readFileSync("docs/data/l43-policy-v8-rules.json", "utf8")) as { rules: PolicyRule[] };
const rules = snap.rules;
const kinds = new Set(rules.map((r) => r[0]));

describe("L43 catálogo de áreas institucionais", () => {
  it("cobre as 20 áreas pedidas, sem id repetido", () => {
    expect(AREAS).toHaveLength(20);
    expect(new Set(AREAS.map((a) => a.id)).size).toBe(20);
  });
  it("todo tipo citado existe na política homologada; área sem tipo declara bloqueio", () => {
    for (const a of AREAS) {
      for (const k of a.kinds) expect(kinds.has(k)).toBe(true);
      if (!a.kinds.length) expect(a.blocker).toBeTruthy();
    }
  });
  it("toda capability da política existe no inventário das migrations", () => {
    const inv = new Set(CAPABILITY_INVENTORY.map((c) => c.id));
    expect(rules.filter((r) => !inv.has(r[1]))).toEqual([]);
  });
  it("segregação: nenhum perfil recebe capability proibida (TI, importação, CIECE etc.)", () => {
    expect(segregationViolations(rules)).toEqual([]);
  });
  it("negativo: se a política desse nota ao TI, a conferência acusaria", () => {
    const bad: PolicyRule[] = [...rules, ["professor", "consultar-registro-funcional", ["network"]]];
    expect(segregationViolations(bad).some((v) => v.area === "docente" && v.rule === "rh")).toBe(true);
  });
  it("TI e importação técnica não têm nenhuma capability hoje", () => {
    for (const id of ["tecnologia", "importacao-tecnica"]) expect(areaCapabilities(AREAS.find((a) => a.id === id)!, rules).size).toBe(0);
  });
  it("verbos separados: consultar ≠ manter ≠ homologar", () => {
    expect(verbOf("consultar-registro-funcional")).toBe("visualizar");
    expect(verbOf("manter-registro-funcional")).toBe("editar");
    expect(verbOf("homologar-politica-de-capacidades")).toBe("aprovar");
    expect(verbOf("xyz-inventado")).toBeNull();
  });
  it("folha nominal: só RH, Direção e Admin Geral consultam registro funcional; capability ampla não", () => {
    const holders = rules.filter((r) => r[1] === "consultar-registro-funcional").map((r) => r[0]).sort();
    expect(holders).toEqual(["administrador-geral-do-sigem", "direcao-escolar", "rh-profissionais-da-rede"]);
  });
  it("pessoa com dois tipos une capacidades sem duplicar", () => {
    const a = { ...AREAS[0]!, kinds: ["professor", "orientacao-pedagogica"] };
    const caps = areaCapabilities(a, rules);
    expect(caps.size).toBe(new Set(rules.filter((r) => a.kinds.includes(r[0])).map((r) => r[1])).size);
  });
  it("matriz mostra áreas bloqueadas com total 0", () => {
    const m = verbMatrix(rules);
    expect(m.filter((x) => x.blocked).every((x) => x.total === 0)).toBe(true);
  });
});
