import { describe, expect, it } from "vitest";
import { evaluateSteps, recordClosingAct, renewalCandidates, type ClosingRule } from "./year-closing-wizard";

const rule = (step: any, modality: string | null = null): ClosingRule => ({ step, blocks: true, modality, homologated: true, validFrom: "2026-01-01", validTo: null });

describe("assistente de encerramento", () => {
  it("fonte não lida é indeterminado; sem regra nunca bloqueia", () => {
    const s = evaluateSteps([{ key: "frequencia", read: false, pending: null }], [], "regular", "2026-12-20");
    expect(s.find((x) => x.key === "frequencia")).toMatchObject({ state: "indeterminado", blocking: false });
  });
  it("regra por modalidade: bloqueia só a modalidade configurada", () => {
    const r = [{ key: "conselho" as const, read: true, pending: 2 }];
    expect(evaluateSteps(r, [rule("conselho", "eja")], "regular", "2026-12-20").find((x) => x.key === "conselho")!.blocking).toBe(false);
    expect(evaluateSteps(r, [rule("conselho", "eja")], "eja", "2026-12-20").find((x) => x.key === "conselho")!.blocking).toBe(true);
  });
  it("homologação: bloqueio, mesma pessoa e automação recusados; reabrir exige motivo", () => {
    const blocked = evaluateSteps([{ key: "resultados", read: true, pending: 1 }], [rule("resultados")], "regular", "2026-12-20");
    const clear = evaluateSteps([], [], "regular", "2026-12-20");
    const c = (recordClosingAct([], { state: "conferido", personId: "P1", naturalPerson: true, at: "t" }, 0, clear) as any).value;
    expect(recordClosingAct(c, { state: "homologado", personId: "P2", naturalPerson: true, at: "t" }, 1, blocked)).toMatchObject({ code: "closing:blocked-by-rule" });
    expect(recordClosingAct(c, { state: "homologado", personId: "P1", naturalPerson: true, at: "t" }, 1, clear)).toMatchObject({ code: "closing:same-person" });
    expect(recordClosingAct(c, { state: "homologado", personId: "bot", naturalPerson: false, at: "t" }, 1, clear)).toMatchObject({ code: "closing:human-author-required" });
    const h = (recordClosingAct(c, { state: "homologado", personId: "P2", naturalPerson: true, at: "t" }, 1, clear) as any).value;
    expect(recordClosingAct(h, { state: "reaberto", personId: "P2", naturalPerson: true, at: "t" }, 2, clear)).toMatchObject({ code: "closing:reason-required" });
    expect(recordClosingAct(h, { state: "reaberto", personId: "P2", naturalPerson: true, at: "t", reason: "erro na ata" }, 2, clear)).toMatchObject({ ok: true });
  });
  it("rematrícula: só após homologar; transferido e sem decisão separados", () => {
    expect(renewalCandidates([], "conferido")).toMatchObject({ code: "renewal:year-not-closed" });
    const r = renewalCandidates([{ id: "A", exitedOn: null, decision: "renovar" }, { id: "T", exitedOn: "2026-06-01", decision: "renovar" }, { id: "N", exitedOn: null, decision: null }], "homologado");
    expect(r).toMatchObject({ renew: ["A"], transferred: ["T"], pendingDecision: ["N"] });
  });
});
