import { describe, expect, it } from "vitest";
import { draftFollowUpDefinition, followUpIssues, projectHistory, startKey, PERMANENCE_STAGES } from "./follow-up-flow";
import { applyTransition, type WorkflowEvent } from "@/features/workflows/workflow-model";

const { status, definition: d } = draftFollowUpDefinition((s) => `acompanhar-${s}`);
const ev = (seq: number, tid: string | null, from: string | null, to: string, comment: string | null = null): WorkflowEvent & { idempotencyKey: string } =>
  ({ id: `e${seq}`, seq, transitionId: tid, fromState: from, toState: to, comment, attachmentRef: null, dueOn: null, actor: "p", recordedAt: "t", idempotencyKey: `k${seq}` });

describe("L07 fluxo de acompanhamento", () => {
  it("esqueleto é rascunho com as 9 etapas e passa nas regras", () => {
    expect(status).toBe("rascunho-nao-homologado");
    expect(d.states).toEqual([...PERMANENCE_STAGES]);
    expect(followUpIssues(d)).toEqual([]);
  });
  it("retorno sem justificativa e fluxo sem reabertura são recusados", () => {
    const bad = { ...d, transitions: d.transitions.map((t) => t.id === "retornar-analise" ? { ...t, requiresComment: false } : t).filter((t) => t.kind !== "reabertura") };
    expect(followUpIssues(bad)).toEqual(expect.arrayContaining(["retorno-sem-justificativa:retornar-analise", "sem-reabertura"]));
  });
  it("retorno exige comentário, concorrência e idempotência pelo motor; histórico distingue movimentos", () => {
    const caps = new Set(d.transitions.map((t) => t.capability));
    const evs = [ev(1, null, null, "identificacao"), ev(2, "avancar-identificacao", "identificacao", "verificacao")];
    expect(applyTransition(d, evs, caps, { transitionId: "retornar-verificacao", expectedSeq: 2, idempotencyKey: "x" })).toEqual({ ok: false, reason: "comment-required" });
    expect(applyTransition(d, evs, caps, { transitionId: "retornar-verificacao", expectedSeq: 1, idempotencyKey: "x", comment: "dados" })).toEqual({ ok: false, reason: "stale-seq" });
    expect(applyTransition(d, evs, caps, { transitionId: "x", expectedSeq: 2, idempotencyKey: "k2" })).toMatchObject({ ok: true, replay: true });
    const h = projectHistory(d, [...evs, ev(3, "retornar-verificacao", "verificacao", "identificacao", "rever"), ev(4, "reabrir", "encerramento", "acolhimento", "voltou a faltar")]);
    expect(h.ok && h.items.map((i) => i.movement)).toEqual(["inicio", "avanco", "retorno", "reabertura"]);
    expect(h.ok && h.reopenings).toBe(1);
    expect(projectHistory(d, [ev(2, null, null, "identificacao")])).toEqual({ ok: false, reason: "cadeia-invalida" });
    expect(startKey("D", "C")).toBe("perm-flow|D|C");
  });
});
