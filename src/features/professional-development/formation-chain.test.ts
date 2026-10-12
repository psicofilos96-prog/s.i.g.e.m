import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { certificationAllowed, conclusionAllowed, devErrorMessage, enrollmentStatus, seatsLeft, usableVersion } from "./formation-chain";

const SQL = readFileSync("drizzle/migrations/0431_dev02_core_formation_chain.sql", "utf8");

describe("L02 cadeia de formação", () => {
  it("só a última versão aprovada é utilizável", () => {
    const v = [{ id: "a", parentId: "p", version: 1, authorPerson: "x" }, { id: "b", parentId: "p", version: 2, authorPerson: "x" }];
    expect(usableVersion("curso", v, [{ subject: "curso", versionId: "a", decision: "aprovada" }], "p")).toBeNull();
    expect(usableVersion("curso", v, [{ subject: "curso", versionId: "b", decision: "aprovada" }], "p")?.id).toBe("b");
  });
  it("situação deriva dos eventos e terminal não reabre", () => {
    expect(enrollmentStatus([])).toBe("inscrita");
    expect(enrollmentStatus([{ seq: 1, kind: "confirmacao", attendancePct: null }, { seq: 2, kind: "conclusao", attendancePct: 90 }])).toBe("concluida");
    expect(enrollmentStatus([{ seq: 1, kind: "desistencia", attendancePct: null }, { seq: 2, kind: "confirmacao", attendancePct: null }])).toBe("cadeia-invalida");
    expect(enrollmentStatus([{ seq: 2, kind: "confirmacao", attendancePct: null }])).toBe("cadeia-invalida");
  });
  it("vagas sem configuração são null e desistência libera vaga", () => {
    expect(seatsLeft(null, [])).toBeNull();
    expect(seatsLeft(2, [{ events: [] }, { events: [{ seq: 1, kind: "desistencia", attendancePct: null }] }])).toBe(1);
  });
  it("conclusão exige mínimo configurado; certificação segrega", () => {
    expect(conclusionAllowed(null, 100).ok).toBe(false);
    expect(conclusionAllowed(75, 74).ok).toBe(false);
    expect(conclusionAllowed(75, 75).ok).toBe(true);
    expect(certificationAllowed({ concludedBy: "g", holder: "h", issuer: "g" })).toBe(false);
    expect(certificationAllowed({ concludedBy: "g", holder: "h", issuer: "h" })).toBe(false);
    expect(certificationAllowed({ concludedBy: null, holder: "h", issuer: "z" })).toBe(false);
    expect(certificationAllowed({ concludedBy: "g", holder: "h", issuer: "z" })).toBe(true);
  });
  it("banco impõe as mesmas regras", () => {
    for (const needle of ["dev:self-approval", "dev:seats-not-configured", "dev:min-attendance-not-configured", "dev:segregation", "dev:link-not-of-person", "dev:terminal", "FOR UPDATE", "REVOKE SELECT ON public.dev_certifications"]) expect(SQL).toContain(needle);
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
    expect(devErrorMessage("ERROR: dev:no-seats")).toBe("Não há vagas.");
  });
});
