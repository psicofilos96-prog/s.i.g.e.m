import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { allowedNext, contentProblems, monitorGoals, planState, segregationOk, type PlanEvent } from "./annual-plan";

const SQL = readFileSync("drizzle/migrations/0433_dev05_annual_plan_workflow.sql", "utf8");
const ev = (seq: number, kind: PlanEvent["kind"], actor = "x", goal: string | null = null, v: number | null = null): PlanEvent =>
  ({ seq, kind, actorPerson: actor, goalItemId: goal, observedValue: v, createdAt: `2026-0${seq}-01` });

describe("L05 Plano Anual de Formação", () => {
  it("ciclo proposta→análise→aprovação→publicação→monitoramento; devolução encerra a versão", () => {
    expect(planState([])).toBe("rascunho");
    expect(planState([ev(1, "proposta"), ev(2, "analise"), ev(3, "aprovacao"), ev(4, "publicacao"), ev(5, "monitoramento")])).toBe("publicada");
    expect(planState([ev(1, "proposta"), ev(2, "aprovacao")])).toBe("cadeia-invalida");
    expect(allowedNext([ev(1, "proposta"), ev(2, "analise"), ev(3, "devolucao")])).toEqual([]);
  });
  it("autor não analisa nem aprova; analista não aprova", () => {
    const evs = [ev(1, "proposta", "a"), ev(2, "analise", "b")];
    expect(segregationOk("analise", "a", "a", [])).toBe(false);
    expect(segregationOk("aprovacao", "b", "a", evs)).toBe(false);
    expect(segregationOk("aprovacao", "c", "a", evs)).toBe(true);
  });
  it("conteúdo exige diagnóstico, eixo, público; marco com data", () => {
    const p = contentProblems([{ kind: "marco", text: "Encontro", targetValue: null, targetUnit: null, dueOn: null }], "curto");
    expect(p).toHaveLength(4);
  });
  it("meta sem observação não vira zero", () => {
    const items = [{ id: "m1", kind: "meta" as const, text: "Formar coordenadores", targetValue: 40, targetUnit: "pessoas", dueOn: null },
      { id: "m2", kind: "meta" as const, text: "Cobrir escolas", targetValue: 10, targetUnit: "escolas", dueOn: null }];
    const r = monitorGoals(items, [ev(5, "monitoramento", "x", "m1", 12), ev(6, "monitoramento", "x", "m1", 41)]);
    expect(r[0]).toMatchObject({ latest: 41, status: "atingida" });
    expect(r[1]).toMatchObject({ latest: null, status: "nao-monitorada" });
  });
  it("banco: aprovação só pelo fluxo, com ato e segregação; programa só de plano publicado", () => {
    for (const n of ["dev:use-plan-workflow", "act_document_ref IS NOT NULL", "dev:segregation", "dev:invalid-transition", "e.kind = 'publicacao'", "aprovar-plano-de-formacao", "dev:responsible-not-active"]) expect(SQL).toContain(n);
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
});
