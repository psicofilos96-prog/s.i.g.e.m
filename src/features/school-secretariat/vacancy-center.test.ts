import { describe, expect, it } from "vitest";
import { allocateConcurrent, available, canMove, canOffer, orderWaitlist, projectDemand } from "./vacancy-center";

const slot = { classId: "t", schoolId: "A", capacity: 25, occupied: 23, reserved: 1 };
describe("central de vagas", () => {
  it("saldo e capacidade ausente", () => {
    expect(available(slot)).toBe(1);
    expect(available({ ...slot, capacity: null })).toBeNull();
  });
  it("não oferta sem vaga, sem capacidade, ou com matrícula vigente", () => {
    expect(canOffer({ ...slot, reserved: 2 }, "s", new Set()).ok).toBe(false);
    expect(canOffer({ ...slot, capacity: null }, "s", new Set())).toEqual({ ok: false, reason: "capacidade-nao-configurada" });
    expect(canOffer(slot, "s", new Set(["s"]))).toEqual({ ok: false, reason: "matricula-ou-oferta-vigente" });
  });
  it("concorrência: só o saldo é concedido", () => {
    expect(allocateConcurrent(slot, ["r1", "r2", "r3"])).toEqual({ granted: ["r1"], refused: ["r2", "r3"] });
  });
  it("fila só com critério homologado; desempate por protocolo", () => {
    const items = [{ requestId: "a", studentRef: "1", protocolAt: "2026-01-02", flags: {} }, { requestId: "b", studentRef: "2", protocolAt: "2026-01-03", flags: { irmao: true } }, { requestId: "c", studentRef: "3", protocolAt: "2026-01-01", flags: {} }];
    expect(orderWaitlist(items, { version: 1, homologated: false, keys: [] }).ok).toBe(false);
    expect(orderWaitlist(items, { version: 1, homologated: true, keys: ["irmao"] })).toEqual({ ok: true, criteriaVersion: 1, order: ["b", "c", "a"] });
  });
  it("fluxo: efetivada é terminal; não pula análise", () => {
    expect(canMove("protocolada", "ofertada")).toBe(false);
    expect(canMove("efetivada", "desistencia")).toBe(false);
  });
  it("projeção exige hipótese", () => {
    expect(projectDemand(100, null).kind).toBe("nao-projetavel");
    expect(projectDemand(100, { label: "+5%", growthPct: 5 })).toEqual({ kind: "estimativa", hypothesis: "+5%", value: 105 });
  });
});
