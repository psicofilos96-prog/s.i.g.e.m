import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PHASE_TONE, STATE_REGISTRY, presentState, type StateDomain } from "./state-presentation";
import { projectWorkflow } from "@/features/statistical-map/map-structures";
import { canSubmit, reviewState } from "@/features/teacher-review/teacher-work-review";
import { ORDER_ACTIONS_FROM, schoolCanEdit, type OrderStatus } from "@/features/school-meals/order-model";

describe("NSTATE.1 — rótulo e cor do estado canônico", () => {
  it("cor vem só da fase: estados equivalentes têm a mesma cor em qualquer domínio", () => {
    for (const d of Object.keys(STATE_REGISTRY) as StateDomain[])
      for (const [v, en] of Object.entries(STATE_REGISTRY[d])) expect(presentState(d, v).tone).toBe(PHASE_TONE[en.phase]);
    expect(presentState("documento", "cancelada").tone).toBe(presentState("solicitacao", "cancelado").tone);
    expect(presentState("calendario", "rascunho").tone).toBe(presentState("mapa", "rascunho").tone);
    expect(presentState("mapa", "devolvido").tone).toBe(presentState("sipe-sia", "ajuste-solicitado").tone);
  });
  it("estado fora do registro nunca é traduzido por palpite", () => {
    expect(presentState("mapa", "aprovada")).toMatchObject({ label: "Situação não reconhecida", known: false, tone: "neutral" });
    expect(presentState("turma", null).label).toBe("Sem situação registrada");
  });
  it("Mapa: envio → devolução → reenvio → aprovação → retificação", () => {
    const ev = (kind: string, at: string, reason?: string) => ({ kind, at, reason: reason ?? null });
    expect(projectWorkflow(true, [], 0).stage).toBe("rascunho");
    expect(projectWorkflow(true, [ev("conferencia", "1")], 0).stage).toBe("enviado");
    const back = projectWorkflow(true, [ev("conferencia", "1"), ev("devolucao", "2", "x")], 0);
    expect([back.stage, back.returnReason]).toEqual(["devolvido", "x"]);
    expect(projectWorkflow(true, [ev("conferencia", "1"), ev("devolucao", "2"), ev("conferencia", "3")], 0).stage).toBe("reenviado");
    expect(projectWorkflow(true, [ev("conferencia", "1"), ev("oficializacao", "2")], 1).stage).toBe("aprovado");
    expect(projectWorkflow(true, [ev("conferencia", "1"), ev("oficializacao", "2"), ev("abertura-correcao", "3")], 1).stage).toBe("em-retificacao");
    expect(projectWorkflow(false, [ev("conferencia", "1")], 0).stage).toBe("rascunho");
  });
  it("SIPE/SIA: só envia quem não está em análise nem com a versão atual aprovada", () => {
    const e = (event: "enviado" | "ajuste-solicitado" | "aprovado", v = "v1") => ({ seq: 1, event, subject_version_id: v, comment: null, by_author: true, recorded_at: "" });
    expect(reviewState([], "v1")).toBe("nao-enviado");
    expect(canSubmit(reviewState([e("enviado")], "v1"))).toBe(false);
    expect(canSubmit(reviewState([e("ajuste-solicitado")], "v1"))).toBe(true);
    expect(canSubmit(reviewState([e("aprovado")], "v1"))).toBe(false);
    expect(reviewState([e("aprovado", "v1")], "v2")).toBe("aprovado-versao-anterior");
  });
  it("Solicitação: ações da tela espelham as transições do banco (0183)", () => {
    const sql = readFileSync("drizzle/migrations/0183_nae2_meal_orders_authorization_consolidation.sql", "utf8");
    expect(sql).toContain("_action = 'analise' THEN\n    IF head.status <> 'submetido'");
    expect(sql).toContain("_action = 'autorizacao' AND head.status NOT IN ('submetido','em-analise')");
    expect(sql).toContain("_action = 'retificacao' AND head.status NOT IN ('autorizado-total','autorizado-parcial','retificado')");
    expect(ORDER_ACTIONS_FROM["em-analise"]).not.toContain("analise");
    expect(ORDER_ACTIONS_FROM.rejeitado).toEqual([]);
    expect(ORDER_ACTIONS_FROM.cancelado).toEqual([]);
    const editable = (Object.keys(ORDER_ACTIONS_FROM) as OrderStatus[]).filter(schoolCanEdit);
    expect(editable.sort()).toEqual(["devolvido", "rascunho"]);
  });
});
