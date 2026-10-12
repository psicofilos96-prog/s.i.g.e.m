import { describe, it, expect } from "vitest";
import { projectFollowups, planFollowupWrite, validateOpen, actionStatus, awaitingTeacherFeedback, teacherView, centralFollowupCounts, type FollowupEvent, type FollowupOpen } from "./op-teacher-followup";
import type { OpDesignation } from "./op-designations";

const open = (o: Partial<FollowupOpen> = {}): FollowupOpen => ({ kind: "abrir", type: "planejamento", teacherPersonIds: ["prof"], schoolId: "s1", classId: "c1", componentId: "mat", date: "2026-10-01", objective: "Alinhar planejamento", aspects: ["sequência"], guidance: "Revisar objetivos", actions: [{ text: "Ajustar plano", dueDate: "2026-10-10" }], ...o });
const ev = (seq: number, body: FollowupEvent["body"], author = "op", at = `2026-10-0${seq}`): FollowupEvent => ({ id: `e${seq}`, logicalId: "f1", seq, at, authorPersonId: author, idempotencyKey: `k${seq}`, body });
const desig: OpDesignation = { logicalId: "d1", role: "orientador-da-unidade", personId: "op", schoolIds: ["s1"], classIds: null, from: "2026-01-01", to: null, substituteOf: null, history: [] };
const access = { personNatural: true, personId: "op", date: "2026-10-05", schoolId: "s1", classId: "c1", purpose: "acompanhamento", designations: [desig], capabilities: [{ id: "registrar-acompanhamento-pedagogico", scope: "escola" as const, schoolId: "s1" }] };

describe("Lote 05 — ficha de acompanhamento docente", () => {
  it("aceita os 8 tipos e valida individual/coletivo/aula", () => {
    expect(validateOpen(open())).toEqual([]);
    expect(validateOpen(open({ type: "individual", teacherPersonIds: ["a", "b"] }))).not.toEqual([]);
    expect(validateOpen(open({ type: "coletivo" }))).not.toEqual([]);
    expect(validateOpen(open({ type: "aula", classId: null }))).not.toEqual([]);
  });
  it("bloqueia conversão em avaliação funcional ou sanção", () => {
    expect(validateOpen(open({ guidance: "Aplicar advertência" })).join()).toMatch(/formativa/);
    expect(validateOpen(open({ objective: "Avaliação funcional do estágio probatório" }))).not.toEqual([]);
  });
  it("projeta ficha com devolutiva, providência e efeito funcional sempre falso", () => {
    const { list } = projectFollowups([ev(1, open()), ev(2, { kind: "devolutiva", text: "Vou ajustar", byTeacher: true }, "prof"), ev(3, { kind: "providencia-concluida", actionIndex: 0, note: "" }, "op")]);
    expect(list[0]!.functionalEffect).toBe(false);
    expect(list[0]!.actions[0]!.doneAt).toBe("2026-10-03");
    expect(awaitingTeacherFeedback(list[0]!)).toBe(false);
  });
  it("recusa autoacompanhamento, devolutiva com autoria falsa e evento após encerramento", () => {
    expect(projectFollowups([ev(1, open(), "prof")]).rejected).toHaveLength(1);
    expect(projectFollowups([ev(1, open()), ev(2, { kind: "devolutiva", text: "x", byTeacher: true }, "op")]).rejected).toHaveLength(1);
    expect(projectFollowups([ev(1, open()), ev(2, { kind: "encerrar", reason: "concluído" }), ev(3, { kind: "devolutiva", text: "x", byTeacher: true }, "prof")]).rejected).toHaveLength(1);
  });
  it("retificação/anulação só pelo autor com motivo", () => {
    expect(projectFollowups([ev(1, open()), ev(2, { kind: "anular", reason: "" })]).rejected).toHaveLength(1);
    expect(projectFollowups([ev(1, open()), ev(2, { kind: "retificar", reason: "erro", patch: { guidance: "Nova" } }, "outro")]).rejected).toHaveLength(1);
    expect(projectFollowups([ev(1, open()), ev(2, { kind: "retificar", reason: "erro", patch: { guidance: "Nova" } })]).list[0]!.guidance).toBe("Nova");
  });
  it("prazo ausente nunca vira atrasado", () => {
    const { list } = projectFollowups([ev(1, open({ actions: [{ text: "a", dueDate: null }, { text: "b", dueDate: "2026-10-02" }] }))]);
    expect(actionStatus(list[0]!, "2026-10-05").map((a) => a.status)).toEqual(["sem prazo registrado", "prazo vencido"]);
  });
  it("executor: idempotente, fail-closed sem capacidade, base esperada, central não registra", () => {
    const e1 = ev(1, open());
    expect(planFollowupWrite({ access, existing: [], event: e1 }).ok).toBe(true);
    expect(planFollowupWrite({ access, existing: [e1], event: e1 })).toMatchObject({ ok: true, duplicate: true });
    expect(planFollowupWrite({ access: { ...access, capabilities: [] }, existing: [], event: e1 }).ok).toBe(false);
    expect(planFollowupWrite({ access: { ...access, personNatural: false }, existing: [], event: e1 }).ok).toBe(false);
    expect(planFollowupWrite({ access, existing: [], event: ev(2, { kind: "encerrar", reason: "x" }) }).ok).toBe(false);
    const central = { ...access, designations: [{ ...desig, role: "coordenacao-central-op" as const, schoolIds: "rede" as const }] };
    expect(planFollowupWrite({ access: central, existing: [], event: e1 }).ok).toBe(false);
  });
  it("professor responde só à própria ficha, sem capacidade de OP", () => {
    const e1 = ev(1, open());
    const prof = { ...access, personId: "prof", designations: [], capabilities: [] };
    expect(planFollowupWrite({ access: prof, existing: [e1], event: ev(2, { kind: "devolutiva", text: "ok", byTeacher: true }, "prof") }).ok).toBe(true);
    const other = { ...prof, personId: "x" };
    expect(planFollowupWrite({ access: other, existing: [e1], event: ev(2, { kind: "devolutiva", text: "ok", byTeacher: true }, "x") }).ok).toBe(false);
  });
  it("LGPD: professor não vê colegas; central só contagem suprimida", () => {
    const { list } = projectFollowups([ev(1, open({ type: "coletivo", teacherPersonIds: ["prof", "p2"] }))]);
    expect(teacherView(list, "prof")[0]!.teacherPersonIds).toEqual(["prof"]);
    expect(teacherView(list, "p9")).toEqual([]);
    expect(centralFollowupCounts(list)).toEqual({ "s1:coletivo": "suprimido" });
  });
});
