import { describe, it, expect } from "vitest";
import { visibleTimeline, handoverPackage, type Item } from "./mediator-timeline";

const it_ = (o: Partial<Item>): Item => ({ id: "i", kind: "apoio", studentId: "e1", schoolId: "sA", classId: "5A", activity: "Leitura", date: "2026-03-01", authorPersonId: "m1", text: "Apoio na leitura", activeUntil: null, continuity: false, source: "registro-diario", ...o });
const items = [
  it_({ id: "a", date: "2026-02-10" }),                                            // m1, sA
  it_({ id: "g", kind: "orientacao", authorPersonId: "nei", date: "2026-02-01", text: "Antecipar transições" }),
  it_({ id: "c", kind: "barreira", date: "2026-03-20", continuity: true, text: "Barulho no refeitório" }),
  it_({ id: "x", kind: "apoio", date: "2026-03-25", text: "rotina comum" }),
  it_({ id: "b", schoolId: "sB", classId: "6B", authorPersonId: "m2", date: "2026-05-10", text: "Apoio na escola B" }),
  it_({ id: "k", authorPersonId: "m2", schoolId: "sB", date: "2026-05-12", text: "suspeita de transtorno" }),
];
const range = { from: "2026-01-01", to: "2026-12-31" };

describe("Mediador L14 — linha do tempo e continuidade", () => {
  it("autor antigo mantém leitura só dos próprios registros após fim da designação", () => {
    const v = visibleTimeline(items, { personId: "m1", designations: [{ studentId: "e1", schoolId: "sA", from: "2026-02-01", to: "2026-03-31" }] }, "e1", { ...range, to: "2026-06-30" }, { continuityWindowDays: 30 });
    if (v.state !== "ok") throw new Error();
    expect(v.scope).toBe("somente-proprios");
    expect(v.items.map((i) => i.id).sort()).toEqual(["a", "c", "x"]);
  });
  it("nova designação em outra escola recebe só vigentes + continuidade, sem texto de outra escola nem autoria", () => {
    const viewer = { personId: "m2", designations: [{ studentId: "e1", schoolId: "sB", from: "2026-04-01", to: null }] };
    const v = visibleTimeline(items, viewer, "e1", range, { continuityWindowDays: 30 });
    if (v.state !== "ok") throw new Error();
    expect(v.items.map((i) => i.id).sort()).toEqual(["b", "c", "g", "k"]);
    expect(v.items.find((i) => i.id === "c")).toMatchObject({ schoolChanged: true, text: null, author: "outro-profissional" });
    expect(v.items.find((i) => i.id === "k")!.text).toBeNull(); // clínico retido mesmo sendo próprio
  });
  it("sem janela configurada não há continuidade; fonte não lida declarada", () => {
    const viewer = { personId: "m2", designations: [{ studentId: "e1", schoolId: "sB", from: "2026-04-01", to: null }] };
    const v = visibleTimeline(items, viewer, "e1", range, { continuityWindowDays: null });
    expect(v.state === "ok" && v.items.some((i) => i.id === "c")).toBe(false);
    expect(visibleTimeline(null, viewer, "e1", range, { continuityWindowDays: 30 }).state).toBe("nao-disponivel");
  });
  it("filtros por atividade e tipo; sem síntese nem prognóstico", () => {
    const v = visibleTimeline(items, { personId: "m1", designations: [] }, "e1", { ...range, kinds: ["barreira"] }, { continuityWindowDays: 30 });
    expect(v.state === "ok" && v.items.map((i) => i.id)).toEqual(["c"]);
    expect(JSON.stringify(v)).not.toMatch(/tendencia|score|media|evolu[cç][aã]o:/i);
  });
  it("pacote de passagem: só necessário e configurado", () => {
    expect(handoverPackage(items, "e1", "2026-04-01", null).ok).toBe(false);
    const p = handoverPackage(items, "e1", "2026-04-01", 30);
    expect(p.ok && p.items.map((i) => i.id).sort()).toEqual(["c", "g"]);
  });
});
