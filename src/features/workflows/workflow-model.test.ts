import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { applyTransition, availableTransitions, currentEvent, definitionIssue, dueOf, filterPendings, isTerminal, type Pending, type WorkflowDefinition, type WorkflowEvent } from "./workflow-model";

const def: WorkflowDefinition = {
  states: ["aberto", "em-analise", "concluido", "cancelado"], initial: "aberto", startCapability: "abrir-x", terminal: ["concluido", "cancelado"],
  transitions: [
    { id: "analisar", from: "aberto", to: "em-analise", capability: "analisar-x" },
    { id: "concluir", from: "em-analise", to: "concluido", capability: "analisar-x", kind: "conclusao" },
    { id: "cancelar", from: "aberto", to: "cancelado", capability: "abrir-x", kind: "cancelamento", requiresComment: true },
    { id: "reabrir", from: "concluido", to: "em-analise", capability: "analisar-x", kind: "reabertura", requiresComment: true },
  ],
};
const ev = (seq: number, to: string, extra: Partial<WorkflowEvent & { idempotencyKey: string }> = {}) =>
  ({ id: `e${seq}`, seq, transitionId: null, fromState: null, toState: to, comment: null, attachmentRef: null, dueOn: null, actor: "u", recordedAt: "2027-01-01T00:00:00Z", idempotencyKey: `k${seq}`, ...extra });
const caps = new Set(["abrir-x", "analisar-x"]);

describe("definição", () => {
  it("válida", () => expect(definitionIssue(def)).toBeNull());
  it("recusa curinga, estado inexistente e duplicidade", () => {
    expect(definitionIssue({ ...def, transitions: [{ ...def.transitions[0]!, capability: "*" }] })).toBe("transition-capability");
    expect(definitionIssue({ ...def, transitions: [{ ...def.transitions[0]!, to: "x" }] })).toBe("transition-state");
    expect(definitionIssue({ ...def, transitions: [def.transitions[0]!, def.transitions[0]!] })).toBe("transition-duplicate");
  });
});

describe("transições", () => {
  const evs = [ev(1, "aberto")];
  it("transição válida avança a sequência", () => {
    const r = applyTransition(def, evs, caps, { transitionId: "analisar", expectedSeq: 1, idempotencyKey: "n" });
    expect(r).toMatchObject({ ok: true, replay: false, event: { seq: 2, fromState: "aberto", toState: "em-analise" } });
  });
  it("transição inválida no estado", () => expect(applyTransition(def, evs, caps, { transitionId: "concluir", expectedSeq: 1, idempotencyKey: "n" })).toEqual({ ok: false, reason: "invalid-transition" }));
  it("sem capability", () => expect(applyTransition(def, evs, new Set(["abrir-x"]), { transitionId: "analisar", expectedSeq: 1, idempotencyKey: "n" })).toEqual({ ok: false, reason: "capability-missing" }));
  it("concorrência: base velha recusada", () => expect(applyTransition(def, [...evs, ev(2, "em-analise")], caps, { transitionId: "concluir", expectedSeq: 1, idempotencyKey: "n" })).toEqual({ ok: false, reason: "stale-seq" }));
  it("duplicidade: mesma chave devolve o evento já gravado", () => {
    const r = applyTransition(def, [...evs, ev(2, "em-analise", { idempotencyKey: "dup" })], caps, { transitionId: "analisar", expectedSeq: 1, idempotencyKey: "dup" });
    expect(r).toMatchObject({ ok: true, replay: true });
  });
  it("cancelamento exige comentário quando configurado", () => {
    expect(applyTransition(def, evs, caps, { transitionId: "cancelar", expectedSeq: 1, idempotencyKey: "n" })).toEqual({ ok: false, reason: "comment-required" });
    expect(applyTransition(def, evs, caps, { transitionId: "cancelar", expectedSeq: 1, idempotencyKey: "n", comment: "duplicado" })).toMatchObject({ ok: true, event: { toState: "cancelado" } });
  });
  it("reabertura é nova transição; histórico preservado", () => {
    const h = [ev(1, "aberto"), ev(2, "em-analise"), ev(3, "concluido")];
    expect(isTerminal(def, "concluido")).toBe(true);
    expect(applyTransition(def, h, caps, { transitionId: "reabrir", expectedSeq: 3, idempotencyKey: "n", comment: "erro" })).toMatchObject({ ok: true, event: { seq: 4, toState: "em-analise" } });
  });
  it("cadeia com lacuna nunca é estado", () => {
    expect(currentEvent([ev(1, "aberto"), ev(3, "concluido")])).toBeNull();
    expect(applyTransition(def, [ev(1, "aberto"), ev(3, "x")], caps, { transitionId: "analisar", expectedSeq: 3, idempotencyKey: "n" })).toEqual({ ok: false, reason: "broken-chain" });
  });
  it("ações disponíveis só pelas capabilities", () => expect(availableTransitions(def, "aberto", new Set(["abrir-x"])).map((t) => t.id)).toEqual(["cancelar"]));
});

describe("prazo e filtros", () => {
  it("prazo sem default", () => {
    expect(dueOf([ev(1, "aberto")])).toBeNull();
    expect(dueOf([ev(1, "aberto", { dueOn: "2027-02-01" }), ev(2, "em-analise")])).toBe("2027-02-01");
  });
  const p = (x: Partial<Pending>): Pending => ({ instanceId: "i", workflowKey: "k", title: "t", schoolId: "s", subjectRef: "r", state: "aberto", seq: 1, dueOn: null, openedBy: "u", mine: false, canAct: false, terminal: false, ...x });
  it("minhas = posso agir; setor = abertas; histórico = encerradas; vencido só com prazo", () => {
    const items = [p({ instanceId: "a", canAct: true }), p({ instanceId: "b" }), p({ instanceId: "c", terminal: true }), p({ instanceId: "d", dueOn: "2027-01-01" })];
    expect(filterPendings(items, { view: "minhas" }).map((i) => i.instanceId)).toEqual(["a"]);
    expect(filterPendings(items, { view: "setor" }).map((i) => i.instanceId)).toEqual(["a", "b", "d"]);
    expect(filterPendings(items, { view: "historico" }).map((i) => i.instanceId)).toEqual(["c"]);
    expect(filterPendings(items, { view: "setor", overdueOn: "2027-06-01" }).map((i) => i.instanceId)).toEqual(["d"]);
  });
});

describe("banco", () => {
  const sql = readdirSync("drizzle/migrations").filter((n) => n.includes("workflow_engine")).map((n) => readFileSync(`drizzle/migrations/${n}`, "utf8")).join("\n");
  it("append-only, sem anon, writers com capability, escopo, concorrência e idempotência", () => {
    for (const t of ["workflow_definitions", "workflow_instances", "workflow_events", "workflow_outbox"]) expect(sql).toMatch(new RegExp(`BEFORE UPDATE OR DELETE ON public\\.${t}`));
    expect(sql).toMatch(/FROM anon, PUBLIC/);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
    for (const m of ["capability-missing", "stale-seq", "invalid-transition", "scope-school-required", "definition-not-homologated", "UNIQUE (instance_id, idempotency_key)"]) expect(sql).toContain(m);
    expect(sql).not.toMatch(/INSERT INTO public\.workflow_definitions[^;]*VALUES \('/); // nenhuma definição semeada
  });
});
