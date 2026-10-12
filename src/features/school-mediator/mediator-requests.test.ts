import { describe, it, expect } from "vitest";
import { openRequest, advance, nextStep, currentDeadline, trail, STEPS, type WorkflowDef, type WfEvent, type Step } from "./mediator-requests";

const def: WorkflowDef = { id: "WF", version: 1, homologated: true, processKind: "solicitacao-mediacao", types: ["recurso", "pedagogica"],
  stepCapability: { abertura: null, classificacao: "triar-solicitacoes", encaminhamento: "triar-solicitacoes", analise: "analisar-solicitacao", resposta: "analisar-solicitacao", ciencia: null, encerramento: "triar-solicitacoes" },
  deadlineSchoolDays: { resposta: 2 } };
const med = { personId: "m1", technical: false, designationActive: true };
const base = { defs: [def], type: "recurso", schoolId: "sA", studentId: "e1", subject: "Prancha", text: "Precisamos de prancha de comunicação na sala 5", at: "2026-03-02T09:00:00Z", actor: med };
const staff = { personId: "s1", technical: false, capabilities: ["triar-solicitacoes", "analisar-solicitacao"], isRequester: false };
const req = { personId: "m1", technical: false, capabilities: [], isRequester: true };

describe("Mediador L13 — solicitações pelo protocolo geral", () => {
  it("abertura vira transição do motor geral com chave idempotente e notificação", () => {
    const r = openRequest(base);
    expect(r.ok && r.call).toMatchObject({ rpc: "apply_workflow_transition", definitionId: "WF", step: "abertura" });
    const r2 = openRequest(base);
    expect(r.ok && r2.ok && r.call.idem === r2.call.idem && r.notify.rpc === "emit_notification_event").toBe(true);
  });
  it("sem definição homologada para o tipo, sem designação, clínico ou técnico ⇒ não abre", () => {
    expect(openRequest({ ...base, type: "formacao" }).ok).toBe(false);
    expect(openRequest({ ...base, defs: [{ ...def, homologated: false }] }).ok).toBe(false);
    expect(openRequest({ ...base, defs: null }).ok).toBe(false);
    expect(openRequest({ ...base, actor: { ...med, designationActive: false } }).ok).toBe(false);
    expect(openRequest({ ...base, text: "por causa do laudo do aluno" }).ok).toBe(false);
    expect(openRequest({ ...base, actor: { personId: null, technical: true, designationActive: true } }).ok).toBe(false);
  });
  it("etapas em ordem, cada uma pelo competente; ciência só pelo solicitante", () => {
    let ev: WfEvent[] = [{ seq: 1, processId: "P", step: "abertura", by: "m1", at: "2026-03-02T09:00:00Z", text: "x", payload: {}, idem: "i" }];
    const go = (step: Step, who: typeof staff | typeof req, payload?: Record<string, string>) => {
      const r = advance(def, ev, "P", { step, expectedSeq: ev.length, text: "ato descrito", at: "2026-03-03T10:00:00Z", payload }, who);
      if (!r.ok) throw new Error(r.reasons.join()); ev = [...ev, r.event];
    };
    expect(advance(def, ev, "P", { step: "analise", expectedSeq: 1, text: "ato", at: "t" }, staff).ok).toBe(false);
    expect(advance(def, ev, "P", { step: "classificacao", expectedSeq: 1, text: "", at: "t", payload: { classe: "x" } }, req).ok).toBe(false);
    go("classificacao", staff, { classe: "recurso-acessibilidade" });
    expect(advance(def, ev, "P", { step: "encaminhamento", expectedSeq: 2, text: "", at: "t" }, staff).ok).toBe(false);
    go("encaminhamento", staff, { destino: "NEI" }); go("analise", staff); go("resposta", staff);
    expect(advance(def, ev, "P", { step: "ciencia", expectedSeq: 5, text: "", at: "t" }, staff).ok).toBe(false);
    go("ciencia", req); go("encerramento", staff);
    expect(nextStep(ev, "P")).toBeNull();
    expect(trail(ev, "P").map((t) => t.step)).toEqual([...STEPS]);
  });
  it("prazo só declarado e sobre calendário lido", () => {
    const ev: WfEvent[] = ["abertura", "classificacao", "encaminhamento", "analise"].map((s, i) => ({ seq: i + 1, processId: "P", step: s as Step, by: "x", at: "2026-03-06T10:00:00Z", text: null, payload: {}, idem: String(i) }));
    expect(currentDeadline(def, ev, "P", ["2026-03-06", "2026-03-09", "2026-03-10", "2026-03-11"])).toBe("2026-03-10");
    expect(currentDeadline(def, ev, "P", null)).toBeNull();
    expect(currentDeadline(def, ev.slice(0, 3), "P", ["2026-03-09"])).toBeNull(); // análise sem prazo declarado
  });
});
