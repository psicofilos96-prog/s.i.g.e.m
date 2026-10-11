import { describe, expect, it } from "vitest";
import { assignProvidence, concludeProvidence, decideMakeup, overlayAgenda, pedagogyView, schoolDaysPicture } from "./calendar-pedagogy";

const days = [{ date: "2026-03-02", effect: "letivo" as const }, { date: "2026-03-03", effect: "letivo" as const }, { date: "2026-03-04", effect: "nao-letivo" as const }, { date: "2026-03-05", effect: "letivo" as const }];

describe("Direção — calendário e pedagogia", () => {
  it("dias previstos/realizados/pendentes; sem calendário ou indeterminado não fecha", () => {
    expect(schoolDaysPicture({ calendarId: null, regime: null, days }, new Set(), "2026-03-10").state).toBe("indeterminado");
    expect(schoolDaysPicture({ calendarId: "eja", regime: "semestral", days }, new Set(["2026-03-02"]), "2026-03-04"))
      .toMatchObject({ state: "apurado", regime: "semestral", previstos: 3, realizados: 1, pendentes: 1 });
    expect(schoolDaysPicture({ calendarId: "c", regime: "anual", days: [...days, { date: "2026-03-06", effect: "indeterminado" }] }, new Set(), "2026-03-01"))
      .toMatchObject({ state: "parcial", previstos: null });
  });
  it("agenda não altera efeito; reposição só validada pela Supervisão", () => {
    expect(overlayAgenda(days, [{ date: "2026-03-04", title: "Festa" }])[2]).toMatchObject({ effect: "nao-letivo", schoolEvents: ["Festa"] });
    const m = { id: "r", schoolId: "A", date: "2026-03-07", replaces: "2026-03-03", requestedBy: "dir", status: "solicitada" as const };
    expect(decideMakeup(m, "dir2", [], "validada", "ok")).toMatchObject({ code: "reposicao:nao-competente" });
    expect(decideMakeup(m, "sup", ["construir-calendario-da-rede"], "validada", "ok").ok).toBe(true);
  });
  it("sem fechamento não há nota nem aprovação", () => {
    const v = pedagogyView({ classId: "c1", plansShared: null, lessonsRecorded: 4, instruments: [], periodClosed: false, results: [{ studentId: "a", value: "8" }],
      standingRegistered: false, standings: [{ studentId: "a", standing: "aprovado" }], council: { minuteClosed: false }, interventionPlans: null, goals: [{ id: "g", homologated: false }], curricularRefs: [] });
    expect(v).toMatchObject({ resultados: "aguardando fechamento do período", situacao: "situação oficial não registrada", planejamentos: "não registrado", metas: [], conselho: "sessão em preparação" });
  });
  it("providência só concluída pelo setor dono com registro próprio", () => {
    const a = assignProvidence({ id: "p", schoolId: "A", sector: "orientacao", assignedBy: "dir", subjectRef: "st1", due: null }, true); if (!a.ok) throw 0;
    expect(concludeProvidence(a.providence, "dir", "direcao", "x")).toMatchObject({ code: "providencia:setor-diferente" });
    expect(concludeProvidence(a.providence, "op", "orientacao", null)).toMatchObject({ code: "providencia:sem-registro-do-setor" });
    expect(concludeProvidence(a.providence, "op", "orientacao", "rec1").ok).toBe(true);
  });
});
