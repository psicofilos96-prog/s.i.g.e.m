import { describe, it, expect } from "vitest";
import { simulate, shortageRisk, fingerprint, type PlanInput } from "./supply-planner";

const base: PlanInput = {
  schoolId: "E1", from: "2026-03-02", to: "2026-03-06", menuApproved: true,
  servings: [{ date: "2026-03-02", preparationId: "p" }, { date: "2026-03-03", preparationId: "p" }, { date: "2026-03-07", preparationId: "p" }],
  recipes: { p: { yieldPortions: 10, lines: [{ itemId: "arroz", gross: 1000 }] } },
  schoolDays: ["2026-03-02"], attendees: 20,
  lossFactor: { arroz: { factor: 1.05, justification: "ficha v2" } },
  stock: { arroz: { usable: 1500, lots: [{ qty: 1000, expiry: "2026-12-31" }, { qty: 500, expiry: "2026-03-04" }] } },
  commitments: { arroz: 100 }, confirmedDeliveries: [{ itemId: "arroz", qty: 200, on: "2026-03-05" }],
};

describe("planejador de abastecimento", () => {
  it("bloqueia sem cardápio aprovado, calendário ou ficha", () => {
    const r = simulate({ ...base, menuApproved: false, schoolDays: null, recipes: {} });
    expect(r.state === "BLOCKED" && r.reasons.length).toBe(3);
  });
  it("bruta só em dia letivo; perda; lote vencendo excluído; líquida", () => {
    const r = simulate(base);
    if (r.state !== "OK") throw new Error();
    const n = r.needs[0]!;
    expect([n.gross, n.withLoss, n.available, n.net]).toEqual([2000, 2100, 1100, 1000]);
    expect(r.nature).toBe("simulacao");
  });
  it("saldo indeterminado não vira zero", () => {
    const r = simulate({ ...base, stock: { arroz: { usable: null, lots: [] } } });
    expect(r.state === "OK" && r.needs[0]!.net).toBeNull();
  });
  it("recomputável e risco com regra visível", () => {
    expect(fingerprint(base)).toBe(fingerprint({ ...base }));
    expect(fingerprint(base)).not.toBe(fingerprint({ ...base, attendees: 21 }));
    const n = { itemId: "a", gross: 0, withLoss: 0, available: 100, net: 0, basis: [] };
    expect(shortageRisk(n, 50, null).state).toBe("nao-configurado");
    const s = shortageRisk(n, 50, 5);
    expect(s.state).toBe("risco");
    expect(s.rule).toContain("não previsão garantida");
  });
});
