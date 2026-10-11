import { describe, it, expect } from "vitest";
import { cell, attendance, estimatedVsServed, alerts, operationalSheet } from "./meals-panel";

describe("painel da alimentação", () => {
  it("distingue zero, não registrado, estimado e confirmado", () => {
    expect(cell(0, "s", null).nature).toBe("zero");
    expect(cell(null, "s", null).nature).toBe("nao-registrado");
    const e = estimatedVsServed(120, 100, null, "2026-03-01");
    expect([e.estimated.nature, e.served.nature, e.days.nature, e.difference]).toEqual(["estimado", "confirmado", "nao-registrado", -20]);
  });
  it("atendimento só das escolas visíveis e ausência não soma", () => {
    const r = attendance([{ schoolId: "E1", stage: "EI", modality: null, journey: "integral", enrolled: 20 }, { schoolId: "E1", stage: "EI", modality: null, journey: "parcial", enrolled: null }, { schoolId: "E2", stage: "EI", modality: null, journey: null, enrolled: 99 }], ["E1"], "stage", "2026-03-01");
    expect(r[0]!.enrolled.nature).toBe("nao-registrado");
  });
  it("alertas com fonte; sem parâmetro configurado vira não verificável", () => {
    const r = alerts({ stock: [{ itemId: "arroz", label: "Arroz", balance: 2, minimum: 5, lotExpiry: "2026-02-01" }, { itemId: "feijao", label: "Feijão", balance: 9, minimum: null, lotExpiry: null }],
      deliveries: [{ id: "d1", plannedOn: "2026-02-20", received: false }], losses: [], menuPublished: null, expiryWindowDays: null }, "2026-03-01");
    expect(r.alerts.map((a) => a.kind).sort()).toEqual(["entrega-atrasada", "estoque-critico", "validade-vencida"]);
    expect(r.unverifiable).toContain("mínimo não configurado: Feijão");
    expect(r.unverifiable).toContain("publicação do cardápio não lida");
    expect(r.alerts.every((a) => a.source && a.asOf)).toBe(true);
  });
  it("ficha usa vínculo vigente e não inventa equipe", () => {
    const f = operationalSheet("E1", [{ kitchenId: "k1", kitchenName: "Central", kind: "centralizada", from: "2025-01-01", to: "2025-12-31" }, { kitchenId: "k2", kitchenName: "Própria", kind: "propria", from: "2026-01-01", to: null }], "2026-03-01", { equipment: null, staff: null, shifts: null });
    expect(f.kitchen!.kitchenId).toBe("k2");
    expect(f.staff).toBe("não registrado");
    expect(f.history).toHaveLength(2);
  });
});
