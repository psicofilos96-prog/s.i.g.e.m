import { describe, expect, it } from "vitest";
import { accessRequestFor, checkEvent, orphanEngagements, stateOf, type DesignationEvent, type LinkContext } from "./role-designations";

const ev = (o: Partial<DesignationEvent>): DesignationEvent => ({
  designationId: "D1", seq: 1, kind: "registro", functionLogicalId: "DIRECAO", linkLogicalId: "L1", personId: "P1",
  schoolId: "E1", validFrom: "2026-02-01", validUntil: null, actRef: "port-10", reason: null, authorUserId: "u9",
  technical: false, recordedAt: "2026-01-20", ...o,
});
const link: LinkContext = { linkLogicalId: "L1", personId: "P1", schoolIds: ["E1"], authorPersonId: null };

describe("designações", () => {
  it("registro válido com ato, vínculo e escola da lotação/exercício", () => {
    expect(checkEvent(ev({}), [], link)).toBeNull();
    expect(checkEvent(ev({ schoolId: "E2" }), [], link)).toBe("vinculo-sem-lotacao-ou-exercicio-na-escola");
    expect(checkEvent(ev({ personId: "P2" }), [], link)).toBe("vinculo-de-outra-pessoa");
  });
  it("sem ato, sem autor, técnico e autodesignação recusados", () => {
    expect(checkEvent(ev({ actRef: "" }), [], link)).toBe("sem-ato");
    expect(checkEvent(ev({ authorUserId: null }), [], link)).toBe("sem-autor");
    expect(checkEvent(ev({ technical: true }), [], link)).toBe("executor-tecnico");
    expect(checkEvent(ev({}), [], link, new Set(), "P1")).toBe("autodesignacao");
  });
  it("exclusividade só quando configurada", () => {
    const other = ev({ designationId: "D0", personId: "P0", linkLogicalId: "L0" });
    expect(checkEvent(ev({}), [other], link)).toBeNull();
    expect(checkEvent(ev({}), [other], link, new Set(["DIRECAO"]))).toBe("exclusiva-ocupada");
  });
  it("situação derivada do ledger; encerramento exige motivo e é final", () => {
    const r = ev({});
    expect(stateOf([r], "D1", "2026-01-25", "2026-12-31")).toBe("futura");
    expect(stateOf([r], "D1", "2026-03-01", "2026-12-31")).toBe("vigente");
    expect(checkEvent(ev({ seq: 2, kind: "encerramento", validUntil: "2026-06-30" }), [r], link)).toBe("sem-motivo");
    const end = ev({ seq: 2, kind: "encerramento", validUntil: "2026-06-30", reason: "término", recordedAt: "2026-06-30" });
    expect(stateOf([r, end], "D1", "2026-07-01", "2026-12-31")).toBe("encerrada");
    expect(stateOf([r, end], "D1", "2026-07-01", "2026-05-01")).toBe("vigente");
    expect(checkEvent(ev({ seq: 3, kind: "retificacao", reason: "x" }), [r, end], link)).toBe("ja-encerrada");
    expect(checkEvent(ev({ seq: 3 }), [r], link)).toBe("seq-inesperado");
    expect(stateOf([r, ev({ seq: 3 })], "D1", "2026-03-01", "2026-12-31")).toBe("ambigua");
  });
  it("acesso: só pedido aguardando decisão, nunca concessão", () => {
    const req = accessRequestFor([ev({})], "D1", "2026-03-01", "2026-12-31");
    expect(req?.status).toBe("aguardando-decisao-competente");
    expect(req?.grantsCapabilities).toBe(false);
    const rev = ev({ seq: 2, kind: "revogacao", reason: "ato anulado" });
    expect(accessRequestFor([ev({}), rev], "D1", "2026-03-01", "2026-12-31")).toBeNull();
    expect(orphanEngagements([ev({}), rev], [{ id: "G1", designationId: "D1", active: true }], "2026-03-01", "2026-12-31")).toEqual(["G1"]);
  });
});
