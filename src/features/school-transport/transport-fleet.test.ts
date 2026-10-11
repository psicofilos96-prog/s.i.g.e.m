import { describe, expect, it } from "vitest";
import { mappable, publicStopView, suggestStopOrder, tripBlockers, tripCost, tripDistance } from "./transport-fleet";

const today = "2026-10-11";
const v = { id: "v", seats: 20, accessibleSeats: 1, docValidUntil: "2027-01-01" };
const d = { id: "d", personId: "p", licenseValidUntil: "2027-01-01" };
describe("transporte", () => {
  it("viagem regular sem bloqueios", () => expect(tripBlockers(v, d, 20, 1, today)).toEqual([]));
  it("lotação, acessibilidade e documentos", () => {
    expect(tripBlockers({ ...v, docValidUntil: "2026-01-01" }, { ...d, personId: null }, 21, 2, today))
      .toEqual(["documento-do-veiculo", "condutor-sem-pessoa", "lotacao-excedida", "acessibilidade-insuficiente"]);
    expect(tripBlockers({ ...v, seats: null }, d, 1, 0, today)).toContain("capacidade-nao-informada");
  });
  it("mapa só com fonte válida", () => {
    expect(mappable({ lat: -21, lng: -42, source: null })).toBe(false);
    expect(mappable({ lat: -21, lng: -42, source: "cadastro-oficial" })).toBe(true);
  });
  it("visão pública não expõe estudante", () => {
    expect(JSON.stringify(publicStopView({ id: "s", label: "Ponto 1", riders: [{ studentId: "x", address: "Rua A, 10" }] }))).not.toMatch(/Rua|"x"/);
  });
  it("quilometragem e custo", () => {
    expect(tripDistance(100, 90).kind).toBe("inconsistente");
    expect(tripDistance(null, 90).kind).toBe("nao-apurado");
    expect(tripCost(10, null)).toBeNull();
  });
  it("otimização bloqueada sem segurança avaliada; sempre revisão humana", () => {
    expect(suggestStopOrder([{ id: "a", seq: 1, safe: null }]).kind).toBe("bloqueada");
    expect(suggestStopOrder([{ id: "b", seq: 2, safe: true }, { id: "a", seq: 1, safe: true }])).toEqual({ kind: "sugestao", requiresHumanReview: true, order: ["a", "b"] });
  });
});
