import { describe, it, expect } from "vitest";
import { regimeChecks, preValidate, custodyAppend, currentLocation, regularityAudit, indicator } from "./secretariat-l8-l12";

describe("L8 regimes", () => {
  it("EI sem situação terminal; EJA semestral exige período; sem homologação bloqueia", () => {
    const ei = { offerId: "o", homologated: true, terminalStandings: false, periodicity: "anual" as const, matrixVersionId: "m" };
    expect(regimeChecks(ei, { standing: "aprovado", periodId: null, periods: [] })).toEqual(["oferta sem promoção/reprovação: situação terminal não se aplica"]);
    const eja = { ...ei, terminalStandings: true, periodicity: "semestral" as const };
    expect(regimeChecks(eja, { standing: null, periodId: "2026-2", periods: ["2026-1"] })).toEqual(["período semestral não informado ou fora do calendário"]);
    expect(regimeChecks(null, { standing: null, periodId: null, periods: [] })).toEqual(["regime da oferta não homologado"]);
  });
});

describe("L10 pré-validação", () => {
  it("nunca transmite; GPE e ano errado bloqueiam", () => {
    expect(preValidate({ system: "educacenso", referenceYear: "2026", documentSha256: "h", officialBlockers: [] }, "2026", true, true).state).toBe("conferencia");
    const g = preValidate({ system: "gpe", referenceYear: "2025", documentSha256: null, officialBlockers: [] }, "2026", true, false);
    expect(g.state === "bloqueado" && g.reasons).toEqual(["leiaute de outro ano de referência", "documento oficial do leiaute ausente", "código IBGE do município ausente", "GPE sem contrato de integração"]);
  });
});

describe("L11 guarda documental", () => {
  it("guarda, retirada com motivo, devolução e localização", () => {
    let ev = custodyAppend([], { itemId: "d", kind: "guarda", location: "Arquivo A, caixa 3", principalId: "p", human: true, reason: null, at: "1" });
    expect(ev.ok).toBe(true);
    const e1 = ev.ok ? ev.value : [];
    expect(custodyAppend(e1, { itemId: "d", kind: "retirada", location: null, principalId: "p", human: true, reason: "", at: "2" }, 1)).toEqual({ ok: false, code: "reason-required" });
    expect(custodyAppend(e1, { itemId: "d", kind: "devolucao", location: null, principalId: "p", human: true, reason: null, at: "2" }, 1)).toEqual({ ok: false, code: "not-withdrawn" });
    ev = custodyAppend(e1, { itemId: "d", kind: "retirada", location: null, principalId: "q", human: true, reason: "consulta", at: "2" }, 1);
    expect(currentLocation(ev.ok ? ev.value : [], "d")).toEqual({ location: "Arquivo A, caixa 3", withdrawnBy: "q", reason: null });
  });
});

describe("L12 auditor", () => {
  it("sinaliza sem corrigir; null é não verificável; outra escola fica fora", () => {
    const r = regularityAudit([
      { studentId: "s", schoolId: "A", enrollmentActive: true, enrollmentStart: null, allocated: false, positionDeclared: null, identityDocs: true, guardianActive: true, exitWithoutDestination: false, standingBeforeClosing: false },
      { studentId: "x", schoolId: "B", enrollmentActive: true, enrollmentStart: null, allocated: false, positionDeclared: false, identityDocs: false, guardianActive: false, exitWithoutDestination: true, standingBeforeClosing: true },
    ], "A");
    expect(r.findings.map((f) => f.code)).toEqual(["inicio-ausente", "sem-enturmacao"]);
    expect(r.findings.every((f) => f.autoFix === false)).toBe(true);
    expect(r.unverifiable).toEqual([{ studentId: "s", check: "posicao-ausente" }]);
  });
  it("indicador sem denominador não vira percentual", () => {
    expect(indicator("k", "a/b", "src", 3, 0).value).toBeNull();
    expect(indicator("k", "a/b", "src", null, 4).reason).toBe("fonte não lida");
  });
});
