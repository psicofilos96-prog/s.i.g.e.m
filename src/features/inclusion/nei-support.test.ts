import { describe, expect, it } from "vitest";
import { barrierClosed, coverageState, supportNext, supportProblem } from "./nei-support";

describe("NEI apoio e cobertura", () => {
  it("designação exige vínculo a registro existente", () => {
    expect(supportProblem("encaminhada", "designada", "designado", "", "")).not.toBeNull();
    expect(supportProblem("encaminhada", "designada", "designado", "", "med-1")).toBeNull();
  });
  it("encaminhamento exige destino", () => expect(supportProblem("em-analise", "encaminhada", "ok ok", "", "")).not.toBeNull());
  it("não designa sem análise e encaminhamento", () => expect(supportProblem("solicitada", "designada", "pulo", "", "x")).not.toBeNull());
  it("indeferida é terminal", () => expect(supportNext("indeferida")).toEqual([]));
  it("afastado sem substituto fica descoberto", () => {
    expect(coverageState({ mediator_active: true, on_leave: true, substituted: false })).toBe("descoberta");
    expect(coverageState({ mediator_active: true, on_leave: true, substituted: true })).toBe("substituida");
    expect(coverageState({ mediator_active: false, on_leave: false, substituted: false })).toBe("descoberta");
  });
  it("barreira resolvida é encerrada", () => expect(barrierClosed("resolvida")).toBe(true));
});
