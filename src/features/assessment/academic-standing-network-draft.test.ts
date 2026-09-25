import { describe, expect, it } from "vitest";
import { networkStandingDraftRuleSets, networkDocumentedStandings } from "./academic-standing-fixtures";
import { ruleSetDeterminesStanding, standingRuleIssues } from "./academic-standing-governance";

describe("rascunho institucional das situações documentadas", () => {
  it("cadastra apenas APROVADO, REPROVADO e TRANSFERIDO com IDs estáveis e rótulo histórico", () => {
    expect(networkDocumentedStandings.map((s) => [s.id, s.historicalLabel])).toEqual([
      ["sit-rede-aprovado", "APROVADO"],
      ["sit-rede-reprovado", "REPROVADO"],
      ["sit-rede-transferido", "TRANSFERIDO"],
    ]);
  });
  it("TRANSFERIDO é vida escolar e não resultado de promoção", () => {
    const t = networkDocumentedStandings.find((s) => s.code === "TRANSFERIDO")!;
    expect(t.origin).toBe("vida-escolar");
    expect(t.properties.produzResultadoDePromocao).toBe(false);
  });
  it("permanece rascunho, sem critérios nem colegiado, e não determina situação", () => {
    const [rs] = networkStandingDraftRuleSets;
    expect(rs!.status).toBe("rascunho");
    expect(rs!.bodies).toHaveLength(0);
    expect(rs!.steps).toHaveLength(0);
    expect(ruleSetDeterminesStanding(rs!)).toBe(false);
  });
  it("critério que atribua TRANSFERIDO é recusado pela validação", () => {
    const [rs] = networkStandingDraftRuleSets;
    const issues = standingRuleIssues({
      ...rs!,
      steps: [
        {
          id: "x", order: 1, label: "Teste",
          when: { id: "n", kind: "comparacao", fact: { factId: "f", scope: { kind: "ciclo" } }, operator: "verdadeiro", parameter: { kind: "sem-parametro" } },
          consequence: { kind: "atribuir-situacao", standingId: "sit-rede-transferido" },
          stopsOnMatch: true,
        },
      ],
    });
    expect(issues.some((i) => i.includes("vida escolar"))).toBe(true);
  });
});
