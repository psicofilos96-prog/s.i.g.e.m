import { describe, expect, it } from "vitest";
import { assessmentRuleActions, assessmentRulesState, groupRules, readablePayload } from "./assessment-rules-view";

const row = (version: number, state: string) => ({ logicalId: "r1", version, state, validFrom: "2027-01-01", validUntil: null, payload: {}, reason: "m", recordedAt: "2026-10-01T00:00:00Z", homologatedAt: null });

describe("NAVRULES.1 regras de Avaliação", () => {
  it("sem versão ⇒ estado vazio; sem vigente ⇒ sem homologada", () => {
    expect(assessmentRulesState({ kind: "lido", rows: [] }).kind).toBe("vazio");
    expect(assessmentRulesState({ kind: "lido", rows: [row(1, "rascunho")] }).kind).toBe("sem-homologada");
    expect(assessmentRulesState({ kind: "lido", rows: [row(1, "vigente")] }).kind).toBe("com-homologada");
    expect(assessmentRulesState({ kind: "acesso-negado" }).kind).toBe("acesso-negado");
  });
  it("histórico decrescente e vigente só pelo estado do banco", () => {
    const [g] = groupRules([row(1, "superada"), row(3, "rascunho"), row(2, "vigente")]);
    expect(g.versions.map((v) => v.version)).toEqual([3, 2, 1]);
    expect(g.current?.version).toBe(2);
    expect(groupRules([row(1, "rascunho")])[0].current).toBeNull();
  });
  it("ações só com as capacidades do domínio", () => {
    expect(assessmentRuleActions([])).toEqual({ draft: false, homologate: false });
    expect(assessmentRuleActions(["configurar-politica-correcao-avaliacao"])).toEqual({ draft: true, homologate: false });
    expect(assessmentRuleActions(["homologar-politica-correcao-avaliacao"])).toEqual({ draft: false, homologate: true });
  });
  it("conteúdo legível; ausência não vira valor", () => {
    expect(readablePayload({ appliesWhenPeriodClosing: true, requiredCapabilities: [], outcome: null })).toEqual([
      { label: "Vale quando o período está fechado", value: "Sim" },
      { label: "Resultado da correção", value: "Não informado" },
      { label: "Capacidades exigidas", value: "Nenhum" },
    ]);
  });
});
