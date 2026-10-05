import { describe, expect, it } from "vitest";
import { balanceText, humanOfferError, journeyDraftIssues, personConflicts, readinessResult, readinessText, scheduleDraftIssues } from "./offer-model";

describe("Frente V — modelo da oferta", () => {
  it("jornada: vazia, invertida e sobreposta são apontadas; adjacência é aceita", () => {
    expect(journeyDraftIssues([])).toHaveLength(1);
    expect(journeyDraftIssues([{ weekday: 1, startsAt: "10:00", endsAt: "09:00" }])[0]).toMatch(/antes do fim/);
    expect(journeyDraftIssues([{ weekday: 1, startsAt: "07:00", endsAt: "10:00" }, { weekday: 1, startsAt: "09:00", endsAt: "11:00" }]).join()).toMatch(/sobrepõem/);
    expect(journeyDraftIssues([{ weekday: 1, startsAt: "07:00", endsAt: "10:00" }, { weekday: 1, startsAt: "10:00", endsAt: "11:00" }])).toEqual([]);
  });
  it("grade exige elemento da matriz e jornada, bloqueia fora da jornada e sobreposição", () => {
    const j = [{ weekday: 1, startsAt: "07:00", endsAt: "11:00" }];
    const b = { blockKey: "b1", weekday: 1, startsAt: "07:00", endsAt: "07:50", matrixVersionId: "mv", itemKey: "i" };
    expect(scheduleDraftIssues([b], j)).toEqual([]);
    expect(scheduleDraftIssues([{ ...b, itemKey: null }], j).join()).toMatch(/elemento curricular/);
    expect(scheduleDraftIssues([b], []).join()).toMatch(/jornada/);
    expect(scheduleDraftIssues([{ ...b, startsAt: "11:00", endsAt: "11:50" }], j).join()).toMatch(/fora da jornada/);
    expect(scheduleDraftIssues([b, { ...b, blockKey: "b2", startsAt: "07:30", endsAt: "08:20" }], j).join()).toMatch(/sobrepõem/);
  });
  it("conflito do profissional é potencial e só por sobreposição real", () => {
    expect(personConflicts([{ id: "a", weekday: 1, startsAt: "07:00", endsAt: "08:00" }, { id: "b", weekday: 1, startsAt: "07:30", endsAt: "08:30" }])).toEqual([["a", "b"]]);
    expect(personConflicts([{ id: "a", weekday: 1, startsAt: "07:00", endsAt: "08:00" }, { id: "b", weekday: 2, startsAt: "07:00", endsAt: "08:00" }])).toEqual([]);
  });
  it("saldo sem carga contratual não é calculável e nunca vira zero", () => {
    expect(balanceText(null, 300)).toMatch(/não calculável/);
    expect(balanceText(null, 0)).not.toMatch(/0 min/);
  });
  it("prontidão: resultado ausente ou desconhecido é indisponível; códigos têm texto", () => {
    expect(readinessResult([])).toBe("unavailable");
    expect(readinessResult([{ scope: "resultado", subjectRef: "", code: "x", state: "talvez" }])).toBe("unavailable");
    expect(readinessResult([{ scope: "resultado", subjectRef: "", code: "x", state: "blocked" }])).toBe("blocked");
    expect(readinessText("jornada-ausente")).toMatch(/jornada/);
    expect(readinessText("codigo-novo")).toMatch(/sem descrição/);
  });
  it("erros do banco viram português sem vazar detalhes", () => {
    expect(humanOfferError(new Error("capability:manter-grade-da-turma"))).toMatch(/competência/);
    expect(humanOfferError(new Error("stale-head"))).toMatch(/Recarregue/);
    expect(humanOfferError(new Error("pg internal xyz"))).toBe("A operação não foi concluída.");
  });
});
