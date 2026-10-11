import { describe, expect, it } from "vitest";
import { confirmService, mealsOverview, neiOverview, reportAssetIrregularity, slaStatus } from "./operations-overview";

describe("Direção — NEI, alimentação, infra, patrimônio", () => {
  it("NEI suprime grupo pequeno e nunca expõe campo clínico", () => {
    expect(neiOverview({ aee: 12, mediacao: 3, cid_registrado: 9, apoios: null })).toEqual({ aee: 12, mediacao: "suprimido (grupo pequeno)", apoios: "não disponível" });
  });
  it("alimentação: ausente não é zero e nada é editável", () => {
    expect(mealsOverview({ menuVersionId: null, forecast: null, served: 0, deliveries: null, nonconformities: null, stockKnown: false }))
      .toMatchObject({ cardapio: "sem cardápio publicado", previsto: "não informado", servido: 0, editavel: false });
  });
  it("serviço só confirmado com evidência e por outra pessoa; patrimônio só comunica", () => {
    expect(confirmService({ id: "os", executedBy: "x", evidenceIds: [] }, "dir", true)).toMatchObject({ code: "infra:sem-evidencia" });
    expect(confirmService({ id: "os", executedBy: "dir", evidenceIds: ["f"] }, "dir", true)).toMatchObject({ code: "infra:autoconfirmacao" });
    expect(confirmService({ id: "os", executedBy: "x", evidenceIds: ["f"] }, "dir", true).ok).toBe(true);
    expect(reportAssetIrregularity({ assetId: "b", schoolId: "A" }, "B", "quebrado")).toMatchObject({ code: "patrimonio:fora-da-escola" });
    const r = reportAssetIrregularity({ assetId: "b", schoolId: "A" }, "A", "quebrado");
    expect(r.ok && r.protocol.movesAsset).toBe(false);
  });
  it("SLA só com regra homologada e calendário lido", () => {
    const p = { id: "p", sector: "infraestrutura" as const, kind: "manutencao", openedOn: "2026-03-02", events: [] };
    const rule = [{ sector: "infraestrutura" as const, kind: "manutencao", businessDays: 2, homologated: true }];
    expect(slaStatus(p, [], ["2026-03-03"], "2026-03-04").state).toBe("sem-prazo");
    expect(slaStatus(p, rule, null, "2026-03-04").state).toBe("sem-prazo");
    expect(slaStatus(p, rule, ["2026-03-03", "2026-03-05", "2026-03-06"], "2026-03-06")).toEqual({ state: "vencido", due: "2026-03-05" });
  });
});
