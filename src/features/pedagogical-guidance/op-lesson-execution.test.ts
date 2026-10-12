import { describe, it, expect } from "vitest";
import { lessonPanel, opLessonAction, centralLessonCounts, type LessonRow, type PanelSources } from "./op-lesson-execution";

const row = (slot: string, date: string, situation: any, record: LessonRow["record"] = null, rectified = false): LessonRow => ({
  planned: { slotKey: slot, date, assignmentId: "a1", classId: "c1", componentId: "mat", titularProfessionalId: "prof" },
  view: { situation, rectified, notes: situation === "Inconsistente" ? ["Registro de outro docente sem substituição declarada."] : [] },
  schoolId: "s1", periodId: "b3", record,
});
const src: PanelSources = { schedule: true, diary: true, plans: true, readAt: "2026-10-12" };
const filters = { schoolId: "s1", from: "2026-10-01", to: "2026-10-31" };
const rec = (skills: string[], ev: string[] = []) => ({ contents: ["Frações"], skillItemIds: skills, evidenceRefs: ev });
const plan = { classId: "c1", componentId: "mat", from: "2026-10-01", to: "2026-10-10", skillItemIds: ["H1", "H2"], planVersionId: "pv1" };
const run = (rows: LessonRow[], o: any = {}) => lessonPanel({ filters, rows, plans: [plan], sources: src, today: "2026-10-12", ...o });

describe("Lote 08 — aulas e execução curricular", () => {
  it("ausência de registro é pendência de conferência, nunca não ministrada", () => {
    const r = run([row("x", "2026-10-02", "Prevista"), row("y", "2026-10-20", "Prevista")]);
    expect(r.counts!.pendentesDeConferencia).toBe(1);
    expect(r.counts!.naoRealizadasDeclaradas).toBe(0);
    expect(r.pending[0]!.kind).toBe("conferir-registro");
    expect(r.pending[0]!.note).toMatch(/não afirma/);
  });
  it("separa registrada, com evidência, retificada e inconsistente", () => {
    const r = run([row("a", "2026-10-02", "Realizada", rec(["H1"], ["foto"]), true), row("b", "2026-10-03", "Realizada", rec(["H2"])), row("c", "2026-10-04", "Inconsistente")]);
    expect(r.counts).toMatchObject({ registradas: 2, comEvidencia: 1, retificadas: 1, inconsistentes: 1 });
    expect(r.pending.map((p) => p.kind)).toEqual(["conferir-inconsistencia"]);
  });
  it("divergências plano × diário", () => {
    const r = run([row("a", "2026-10-02", "Realizada", rec(["H1", "H9"])), row("b", "2026-10-15", "Realizada", rec(["H1"]))]);
    const kinds = r.divergences.map((d) => d.kind).sort();
    expect(kinds).toEqual(["habilidade-planejada-nao-registrada", "habilidade-registrada-fora-do-plano", "sem-plano-no-periodo"]);
    expect(r.divergences.find((d) => d.kind === "habilidade-planejada-nao-registrada")!.itemIds).toEqual(["H2"]);
  });
  it("fontes: sem grade bloqueia; diário/plano não lidos = null e sem divergência", () => {
    expect(run([], { sources: { ...src, schedule: false } }).blocked).toMatch(/Grade/);
    expect(run([], { sources: { ...src, readAt: null } }).blocked).toBeTruthy();
    const r = run([row("x", "2026-10-02", "Prevista")], { sources: { ...src, diary: false } });
    expect(r.counts!.registradas).toBeNull();
    expect(r.pending).toEqual([]);
    expect(run([row("a", "2026-10-02", "Realizada", rec(["H9"]))], { sources: { ...src, plans: false } }).divergences).toEqual([]);
  });
  it("filtra por turma/componente/data e escola", () => {
    expect(run([row("a", "2026-09-01", "Prevista")]).counts!.previstas).toBe(0);
    expect(run([{ ...row("a", "2026-10-02", "Prevista"), schoolId: "s9" }]).counts!.previstas).toBe(0);
  });
  it("OP só confere/comenta; autoria e retificação são do professor", () => {
    expect(opLessonAction("conferir").ok).toBe(true);
    for (const k of ["registrar", "retificar", "declarar-nao-realizada"] as const) expect(opLessonAction(k).ok).toBe(false);
  });
  it("central recebe só contagens", () => {
    expect(Object.keys(centralLessonCounts(run([row("a", "2026-10-02", "Prevista")]).counts)!)).toEqual(["previstas", "registradas", "pendentesDeConferencia"]);
  });
});
