import { describe, expect, it } from "vitest";
import { appendFeedback, safeCopy, validateDraft, validationStep, type PlanDraft, type PlanTemplate } from "./plan-editor-model";

const t: PlanTemplate = { id: "m1", version: 2, kinds: ["bimestral", "sequência"], fields: [
  { key: "objetivos", label: "Objetivos", required: true }, { key: "recursos", label: "Recursos", required: false }] };
const d: PlanDraft = { planId: "p1", kind: "bimestral", title: "Frações", start: "2026-03-01", end: "2026-04-30",
  fields: { objetivos: "Comparar frações", recursos: "Régua" }, curricularRefs: ["item:EF06MA07"], adaptations: "Material ampliado",
  templateId: "m1", templateVersion: 2 };
const asg = { start: "2026-02-01", end: "2026-12-20" };

describe("editor de planejamento (Docente L07)", () => {
  it("rascunho válido passa; campos obrigatórios, tipo e período são exigidos", () => {
    expect(validateDraft(d, t, asg)).toEqual([]);
    const bad = { ...d, kind: "anual", fields: { recursos: "x" }, end: "2027-01-10" };
    const e = validateDraft(bad, t, asg).join("|");
    expect(e).toMatch(/Tipo "anual"/); expect(e).toMatch(/Objetivos/); expect(e).toMatch(/atribuição/);
  });
  it("adaptação não aceita diagnóstico", () => {
    expect(validateDraft({ ...d, adaptations: "Aluno com CID F84" }, t, asg).join()).toMatch(/diagnóstico/);
  });
  it("cópia segura cria nova instância sem adaptações e registra origem", () => {
    const c = safeCopy(d, "v9", { start: "2026-08-01", end: "2026-09-30", template: t });
    expect(c.planId).toBeNull(); expect(c.adaptations).toBe(""); expect(c.copiedFromVersionId).toBe("v9");
    expect(d.adaptations).toBe("Material ampliado");
  });
  it("devolutivas exigem seq esperado e texto", () => {
    const l = appendFeedback([], { planVersionId: "v1", authorId: "op", at: "x", kind: "devolutiva", text: "Rever avaliação" }, 0);
    expect(l[0]!.seq).toBe(1);
    expect(() => appendFeedback(l, { planVersionId: "v1", authorId: "p", at: "y", kind: "resposta", text: "ok" }, 0)).toThrow();
  });
  it("validação só com política exigente, validador ≠ autor e com capacidade", () => {
    const plan = { authorId: "p", state: "aguardando-validacao" as const };
    expect(validationStep(null, plan, { id: "op", capabilities: [] }).available).toBe(false);
    const pol = { required: true, capability: "validar-plano" };
    expect(validationStep(pol, plan, { id: "p", capabilities: ["validar-plano"] }).available).toBe(false);
    expect(validationStep(pol, plan, { id: "op", capabilities: [] }).available).toBe(false);
    expect(validationStep(pol, plan, { id: "op", capabilities: ["validar-plano"] }).available).toBe(true);
  });
});
