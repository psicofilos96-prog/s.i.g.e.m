import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { projectManual, projectWorkflow, filterTasks, operationalAgenda, sortTasks, describeRecurrence, dedupeKey, type TaskEvent, type ManualTaskRow } from "./task-model";

const row: ManualTaskRow = { id: "t1", schoolId: "esc", title: "Conferir lista", description: null, priorityId: null, dueOn: null, recurrence: null, sourceKind: null, sourceRef: null, createdAt: "2026-10-01" };
const ev = (seq: number, o: Partial<TaskEvent>): TaskEvent => ({ seq, kind: "status", assigneeEngagement: null, status: null, comment: null, actor: "u", recordedAt: "2026-10-01T10:00", ...o });
const opened = ev(1, { status: "aberta" });
const sql = readFileSync("drizzle/migrations/0095_operational_tasks.sql", "utf8");

describe("central de tarefas", () => {
  it("tarefa sem responsável ou com atuação encerrada é órfã e sai de 'Minhas'", () => {
    const noOne = projectManual(row, [opened], new Map(), new Set())!;
    expect(noOne.orphan).toBe(true);
    const lost = projectManual(row, [opened, ev(2, { kind: "atribuicao", assigneeEngagement: "eng-a" })], new Map(), new Set())!;
    expect(lost.orphan).toBe(true);
    expect(filterTasks([lost], { view: "minhas", myEngagements: new Set(["eng-a"]) })).toHaveLength(0);
    expect(filterTasks([lost], { view: "setor", myEngagements: new Set() })).toHaveLength(1);
  });
  it("reatribuição: a última atribuição vale", () => {
    const t = projectManual(row, [opened, ev(2, { kind: "atribuicao", assigneeEngagement: "a" }), ev(3, { kind: "atribuicao", assigneeEngagement: "b" })], new Map(), new Set(["a", "b"]))!;
    expect(t.assignee).toBe("b");
    expect(filterTasks([t], { view: "minhas", myEngagements: new Set(["a"]) })).toHaveLength(0);
    expect(filterTasks([t], { view: "minhas", myEngagements: new Set(["b"]) })).toHaveLength(1);
  });
  it("prazo ausente não vira data nem entra na agenda", () => {
    const t = projectManual(row, [opened], new Map(), new Set())!;
    expect(t.dueOn).toBeNull();
    expect(operationalAgenda([t])).toEqual([]);
    const d = projectManual({ ...row, id: "t2", dueOn: "2026-10-10" }, [opened], new Map(), new Set())!;
    expect(sortTasks([t, d])[0]!.id).toBe("t2");
  });
  it("cadeia quebrada nunca vira estado", () => {
    expect(projectManual(row, [], new Map(), new Set())).toBeNull();
    expect(projectManual(row, [opened, ev(3, { kind: "comentario", comment: "x" })], new Map(), new Set())).toBeNull();
  });
  it("derivada segue o estado real do processo", () => {
    const p = { instanceId: "w1", workflowKey: "k", title: "Transferência", schoolId: "esc", subjectRef: "ref", state: "deferido", seq: 3, dueOn: null, openedBy: "u", mine: false, canAct: false, terminal: true };
    const t = projectWorkflow(p);
    expect(t.open).toBe(false);
    expect(filterTasks([t], { view: "setor", myEngagements: new Set() })).toHaveLength(0);
    expect(filterTasks([t], { view: "concluidas", myEngagements: new Set() })).toHaveLength(1);
  });
  it("recorrência só quando configurada explicitamente", () => {
    expect(describeRecurrence(null)).toBeNull();
    expect(describeRecurrence({ every: "week" })).toBeNull();
    expect(describeRecurrence({ regra: "toda segunda-feira" })).toBe("toda segunda-feira");
    expect(sql).toMatch(/recurrence \? 'regra'/);
  });
  it("duplicidade de evento: chave de origem estável e idempotência no banco", () => {
    expect(dedupeKey("esc", "workflow", "w1", "a", "n1")).toBe(dedupeKey("esc", "workflow", "w1", "b", "n2"));
    expect(sql).toMatch(/dedupe_key text NOT NULL UNIQUE/);
    expect(sql).toMatch(/idempotency_key text NOT NULL UNIQUE/);
    expect(sql).toMatch(/task:dedupe-conflict/);
  });
  it("permissão: gestor por capability; responsável só com atuação vigente; reatribuir só gestor; sem DML direto", () => {
    expect(sql).toMatch(/has_school_capability\('gerir-tarefas-operacionais'/);
    expect(sql).toMatch(/person_id = public.current_person_id\(\) AND public.operational_engagement_active/);
    expect(sql).toMatch(/task:reassign-forbidden/);
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.operational_task_priorities, public.operational_tasks, public.operational_task_events FROM PUBLIC, anon, authenticated/);
    expect(sql).not.toMatch(/INSERT INTO public.operational_task_priorities\(id[^)]*\) VALUES \('/);
    expect(sql).not.toMatch(/calendar_/);
  });
});
