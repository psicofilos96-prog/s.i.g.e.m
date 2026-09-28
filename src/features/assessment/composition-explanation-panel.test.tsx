/** 6D.3.3.3c — testes cirúrgicos da interface "Como este resultado foi formado?". */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type {
  CompositionExplanationProjection,
  ExplainedCategory,
  ExplainedStage,
} from "./composition-explanation-projection";
import {
  CompositionExplanationPanel,
  EXPLANATION_PROTECTED,
  EXPLANATION_TRIGGER,
  EXPLANATION_UNAVAILABLE,
} from "./composition-explanation-panel";

type Available = Extract<CompositionExplanationProjection, { state: "available" }>;

const stage = (raw: number, value: number, over: Partial<ExplainedStage> = {}): ExplainedStage => ({
  point: "periodo",
  valueBeforeRounding: raw,
  value,
  roundingPolicyConsulted: false,
  roundingApplied: false,
  roundingPolicy: null,
  ...over,
});
const used = (id: string, title: string, value: number, weight = 1, corrected = false) => ({
  resolved: true as const,
  instrumentTitle: title,
  appliedOn: "2026-03-10",
  corrected,
  provenance: { entryVersionId: id, instrumentId: `i-${id}`, version: corrected ? 2 : 1 },
  effectiveValue: value,
  effectiveWeight: weight,
});
const cat = (over: Partial<ExplainedCategory> & { id: string; label: string }): ExplainedCategory => ({
  weight: 1,
  usedEntries: [],
  notUsed: [],
  unmetRequirements: [],
  stage: null,
  provenance: { categoryId: over.id },
  ...over,
});
const available = (over: Partial<Available> = {}): Available => ({
  state: "available",
  compositionKind: "fechamento-do-periodo",
  complete: true,
  period: stage(8, 8),
  categories: [cat({ id: "c1", label: "Atividades", usedEntries: [used("v1", "Prova 1", 8)], stage: stage(8, 8, { point: "categoria" }) })],
  unmatched: [],
  notApplicable: [],
  provenance: { modelId: "mdl-x", modelVersion: 3, configurationId: "cfg-x", configurationVersion: 1 },
  ...over,
});

const open = (p: CompositionExplanationProjection, name = "Ana") => {
  const r = render(<CompositionExplanationPanel projection={p} subjectName={name} />);
  fireEvent.click(screen.getByRole("button", { name: `Como o resultado de ${name} foi formado?` }));
  return r;
};

describe("6D.3.3.3c — Como este resultado foi formado?", () => {
  it("A. available simples: nível 1 e 2 em linguagem humana, sem IDs técnicos", () => {
    open(available());
    const panel = screen.getByTestId("composition-explanation");
    expect(within(panel).getByTestId("explanation-level-1").textContent).toContain("Resultado do período: 8");
    expect(panel.textContent).toContain("Formado a partir de: Atividades");
    expect(panel.textContent).toContain("Prova 1 · 8");
    expect(panel.textContent).not.toMatch(/mdl-x|cfg-x|v1\b|peso 1/);
    expect(screen.queryByTestId("explanation-level-3")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Detalhes do cálculo" }));
    expect(screen.getByTestId("explanation-level-3").textContent).toContain("mdl-x v3");
  });

  it("B. pesos distintos ficam explícitos; pesos iguais não geram ruído", () => {
    open(
      available({
        categories: [
          cat({ id: "c1", label: "Provas", weight: 2, usedEntries: [used("a", "Prova", 8, 2), used("b", "Recuperação", 6, 1)], stage: stage(7.33, 7.33) }),
          cat({ id: "c2", label: "Trabalhos", weight: 1, usedEntries: [used("c", "Trabalho", 7)], stage: stage(7, 7) }),
        ],
      }),
    );
    const c1 = screen.getByTestId("explanation-category-c1");
    expect(c1.textContent).toContain("peso 2");
    expect(c1.textContent).toContain("Prova · 8 · peso 2");
    expect(c1.textContent).toContain("Recuperação · 6 · peso 1");
    expect(screen.getByTestId("explanation-category-c2").textContent).toContain("Trabalho · 7");
    expect(screen.getByTestId("explanation-category-c2").textContent).not.toContain("Trabalho · 7 · peso");
    // Nenhuma fórmula é a apresentação principal.
    expect(screen.getByTestId("composition-explanation").textContent).not.toMatch(/[×÷=]/);
  });

  it("C. resultado corrigido identificado sem valor anterior nem histórico", () => {
    open(available({ categories: [cat({ id: "c1", label: "Atividades", usedEntries: [used("v2", "Prova 1", 9, 1, true)], stage: stage(9, 9) })] }));
    const t = screen.getByTestId("explanation-level-2").textContent!;
    expect(t).toContain("Resultado corrigido");
    expect(t).not.toMatch(/anterior|antes|histórico|→/i);
  });

  it("D. teto aplicado: transformação explícita; teto não aplicado só nos detalhes", () => {
    open(
      available({
        categories: [
          cat({ id: "c1", label: "Extras", usedEntries: [used("a", "Extra", 3)], cap: { maxScore: 2, applied: true, valueBeforeCap: 3, valueAfterCap: 2 }, stage: stage(2, 2) }),
          cat({ id: "c2", label: "Provas", usedEntries: [used("b", "Prova", 5)], cap: { maxScore: 10, applied: false, valueBeforeCap: 5, valueAfterCap: 5 }, stage: stage(5, 5) }),
        ],
      }),
    );
    const applied = screen.getByTestId("explanation-cap-applied").textContent!;
    expect(applied).toContain("Resultado antes do limite: 3");
    expect(applied).toContain("Limite aplicável: 2");
    expect(applied).toContain("Resultado após o limite: 2");
    expect(screen.getByTestId("explanation-category-c2").textContent).not.toContain("Limite");
    fireEvent.click(screen.getByRole("button", { name: "Detalhes do cálculo" }));
    expect(screen.getByTestId("explanation-level-3").textContent).toContain("Limite previsto: 10. Ele não alterou este resultado.");
  });

  it("E. arredondamento que alterou o resultado é explicado; política desconhecida não é traduzida", () => {
    open(
      available({
        period: stage(7.666, 7.7, {
          roundingPolicyConsulted: true,
          roundingApplied: true,
          roundingPolicy: { known: true, mode: "meio-acima", decimals: 1, provenance: { roundingPolicyId: "rp", modelId: "m", modelVersion: 1 } },
        }),
        categories: [
          cat({ id: "c1", label: "A", usedEntries: [used("a", "P", 7.666)], stage: stage(7.666, 7.666, { roundingPolicyConsulted: true, roundingPolicy: { known: false, provenance: { roundingPolicyId: "rp-x" } } }) }),
        ],
      }),
    );
    const l1 = screen.getByTestId("explanation-level-1").textContent!;
    expect(l1).toContain("antes do arredondamento: 7,666");
    expect(l1).toContain("resultado após arredondamento: 7,7");
    // Consultada sem alteração: nenhum ruído no nível 2.
    expect(screen.getByTestId("explanation-category-c1").textContent).not.toContain("arredondamento");
    fireEvent.click(screen.getByRole("button", { name: "Detalhes do cálculo" }));
    const l3 = screen.getByTestId("explanation-level-3").textContent!;
    expect(l3).toContain("aplicada sem alterar o resultado");
    expect(l3).toContain("metade para cima (1 casa decimal)");
    expect(l3).not.toMatch(/Regra: .*rp-x/);
  });

  it("F/G. não utilizado com razão canônica e 'Não se aplica' em natureza separada", () => {
    open(
      available({
        categories: [
          cat({
            id: "c1",
            label: "Atividades",
            usedEntries: [used("a", "Prova", 8)],
            notUsed: [{ nature: "selected-not-used", reasonKind: "nao-registrado-sem-regra", canonicalReason: "Afastamento", entry: { resolved: true, instrumentTitle: "Seminário", appliedOn: "x", corrected: false, provenance: { entryVersionId: "s", instrumentId: "i", version: 1 } } }],
          }),
        ],
        unmatched: [{ resolved: true, instrumentTitle: "Diagnóstica", appliedOn: "x", corrected: false, provenance: { entryVersionId: "d", instrumentId: "id", version: 1 } }],
        notApplicable: [{ instrumentTitle: "Oficina", provenance: { instrumentId: "o" } }],
      }),
    );
    const out = screen.getByTestId("explanation-outside");
    expect(out.querySelector('[data-nature="selected-not-used"]')!.textContent).toContain("Afastamento");
    expect(out.querySelector('[data-nature="unmatched"]')!.textContent).toContain("não integra a composição");
    const na = screen.getByTestId("explanation-not-applicable");
    expect(na.textContent).toContain("Oficina: não se aplica");
    expect(out.textContent).not.toMatch(/pend[eê]ncia|erro/i);
  });

  it("H. unavailable não produz zero e revela motivos sob 'Por quê?'", () => {
    open({ state: "unavailable", reasons: ["Regra de composição não homologada."], pendingRuleIds: ["r1"] });
    const p = screen.getByTestId("explanation-unavailable");
    expect(p.textContent).toContain(EXPLANATION_UNAVAILABLE);
    expect(p.textContent).not.toMatch(/\b0\b/);
    fireEvent.click(screen.getByRole("button", { name: "Por quê?" }));
    expect(p.textContent).toContain("Regra de composição não homologada.");
    expect(p.textContent).not.toContain("r1");
  });

  it("I. protected não renderiza nenhum valor ou decomposição", () => {
    open({ state: "protected", explanation: "values-not-disclosed" });
    const p = screen.getByTestId("composition-explanation");
    expect(p.textContent).toBe(EXPLANATION_PROTECTED);
    expect(p.textContent).not.toMatch(/\d/);
    expect(screen.queryByRole("button", { name: /Detalhes/ })).toBeNull();
  });

  it("J. abre e fecha por teclado com estado expandido semântico", () => {
    render(<CompositionExplanationPanel projection={available()} subjectName="Bruno" />);
    const btn = screen.getByRole("button", { name: "Como o resultado de Bruno foi formado?" });
    expect(btn.textContent).toBe(EXPLANATION_TRIGGER);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    btn.focus();
    expect(document.activeElement).toBe(btn);
    // Botão nativo: Enter/Espaço disparam click.
    fireEvent.keyDown(btn, { key: "Enter" });
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("region", { name: "Formação do resultado de Bruno" })).toBeTruthy();
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("composition-explanation")).toBeNull();
  });
});
