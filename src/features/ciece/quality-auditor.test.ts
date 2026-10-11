import { describe, expect, it } from "vitest";
import { audit, RULES } from "./quality-auditor";

describe("auditor de qualidade", () => {
  it("regras cobrem as 7 dimensões, versionadas e com writer", () => {
    expect(new Set(RULES.map((r) => r.dimension)).size).toBe(7);
    expect(RULES.every((r) => r.version >= 1 && r.fix)).toBe(true);
  });
  it("fonte não lida ⇒ não aplicável, nunca achado", () => {
    expect(audit({}).every((f) => f.grade === "nao-aplicavel")).toBe(true);
  });
  it("identificadores e território", () => {
    const fs = audit({ schools: [{ id: "A", inep: "123", ibge: "3302205", district: "" }, { id: "B", inep: "33000001", ibge: "999", district: "x" }, { id: "C", inep: "33000001", ibge: null, district: "x" }], ibgeKnown: () => true });
    expect(fs.map((f) => [f.ruleId, f.grade])).toEqual(expect.arrayContaining([["inep-invalido", "erro-confirmado"], ["distrito-ausente", "pendencia"], ["ibge-invalido", "erro-confirmado"], ["inep-duplicado", "erro-confirmado"]]));
  });
  it("matrícula: sem início = pendência; multiescola = provável; sem enturmação graduado pela data", () => {
    const fs = audit({ enrollments: [{ id: "1", studentId: "s", schoolId: "A", yearId: "y", openedOn: null, hasAllocation: false, author: "u" }, { id: "2", studentId: "s", schoolId: "B", yearId: "y", openedOn: "2026-02-01", hasAllocation: false, author: "u" }] });
    expect(fs.filter((f) => f.ruleId === "sem-enturmacao").map((f) => f.grade)).toEqual(["alerta", "provavel"]);
    expect(fs.find((f) => f.ruleId === "matricula-multiescola")!.grade).toBe("provavel");
  });
  it("duplicidade é só alerta; turma e vínculo incompletos listam o que falta", () => {
    const fs = audit({ people: [{ id: "a", normName: "ana", birth: "2015-01-01" }, { id: "b", normName: "ana", birth: "2015-01-01" }, { id: "c", normName: "ana", birth: null }], classes: [{ id: "t", offering: null, shift: "m", capacity: null }], links: [{ id: "l", from: null, posted: null }] });
    expect(fs.find((f) => f.ruleId === "duplicidade-suspeita")).toMatchObject({ grade: "alerta", subject: "a,b" });
    expect(fs.find((f) => f.ruleId === "turma-incompleta")!.evidence).toBe("sem oferta, capacidade");
    expect(fs.find((f) => f.ruleId === "vinculo-incompleto")!.evidence).toBe("sem início");
  });
});
