import { describe, expect, it } from "vitest";
import { attendanceCalendarNotice, councilAgendaView, COUNCIL_CATEGORY_NOT_CONFIGURED } from "./institutional-calendar-consumers";
import { resolveCalendarDay, type DayResolution } from "./institutional-calendar-effects";

const K = "2026-10-04T08:00:00.000000Z";
// Dados fictícios: calendário presente, homologado, com evento de conselho por tipo declarado.
function presentDay(date: string, dayTypeId: string, effect: boolean | null, label: string): DayResolution {
  return {
    date, knownAt: K, state: effect === null ? "efeito-nao-declarado" : effect ? "letivo" : "nao-letivo",
    determined: effect !== null, calendarId: "cal-ficticio", versionId: "ver-ficticia", homologationState: "homologada",
    declarations: [{ kind: "evento", id: `ev-${date}`, dayTypeId, dayTypeVersionId: `${dayTypeId}-v1`, dayTypeVersion: 1, label, schoolDayEffect: effect }],
    diagnostic: null,
  };
}

describe("B4.6.3e — chamada por data", () => {
  it("laboratório não mostra estado institucional; pendente não mostra estado", () => {
    expect(attendanceCalendarNotice({ phase: "laboratorio", date: "2026-03-02", knownAt: K }).kind).toBe("laboratorio");
    expect(attendanceCalendarNotice({ phase: "incerto", date: "2026-03-02", knownAt: K }).kind).toBe("pendente");
    expect(attendanceCalendarNotice({ phase: "carregando", date: "2026-03-02", knownAt: K }).kind).toBe("pendente");
  });
  it("com sessão e sem calendário aplicável: motivo real e preservação, sem bloqueio", () => {
    const n = attendanceCalendarNotice({ phase: "pronto", date: "2026-03-02", knownAt: K });
    expect(n.kind).toBe("estado");
    if (n.kind !== "estado") return;
    expect(n.summary.kind).toBe("indeterminado");
    expect(n.text).toMatch(/não há calendário institucional declarado/);
    expect(n.preservation).toMatch(/preservadas/);
  });
  it("acesso negado (contrato real) explicado pela data registrada", () => {
    const denied = resolveCalendarDay({ source: "acesso-negado", date: "2026-03-02", knownAt: K }, { kind: "nao-declarada" }, null);
    const n = attendanceCalendarNotice({ phase: "pronto", date: "2026-03-02", knownAt: K, days: [denied] });
    expect(n.kind === "estado" && n.text).toMatch(/negada/);
  });
  it("calendário presente fictício: dia não letivo é informado, não bloqueia nem apaga", () => {
    const n = attendanceCalendarNotice({ phase: "pronto", date: "2026-07-20", knownAt: K, days: [presentDay("2026-07-20", "tipo-ferias", false, "Férias")] });
    expect(n.kind === "estado" && n.summary.kind).toBe("determinado");
    expect(n.kind === "estado" && n.text).toMatch(/dia não letivo/);
  });
});

describe("B4.6.3e — agenda de conselhos", () => {
  const range = { start: "2026-01-01", end: "2026-12-31" };
  it("categoria não configurada: indisponível com motivo, nunca zero conselhos", () => {
    const v = councilAgendaView({ phase: "pronto", range, knownAt: K, config: { kind: "nao-configurada" } });
    expect(v.kind).toBe("indisponivel");
    if (v.kind !== "indisponivel") return;
    expect(v.reasons[0]).toBe(COUNCIL_CATEGORY_NOT_CONFIGURED);
    expect(v.reasons[1]).toMatch(/não há calendário institucional declarado/);
  });
  it("categoria configurada mas fonte ausente: indisponível, sem evento fictício", () => {
    const v = councilAgendaView({ phase: "pronto", range, knownAt: K, config: { kind: "configurada", councilDayTypeIds: ["tipo-conselho"] } });
    expect(v.kind).toBe("indisponivel");
  });
  it("sessão pendente não mostra agenda; laboratório não interfere", () => {
    expect(councilAgendaView({ phase: "incerto", range, knownAt: K, config: { kind: "nao-configurada" } }).kind).toBe("pendente");
    expect(councilAgendaView({ phase: "laboratorio", range, knownAt: K, config: { kind: "nao-configurada" } }).kind).toBe("laboratorio");
  });
  it("calendário presente fictício: só IDs explícitos contam; rótulo 'CC' não identifica conselho", () => {
    const days = [
      presentDay("2026-04-10", "tipo-conselho", true, "Conselho de Classe"),
      presentDay("2026-05-10", "tipo-outro", true, "CC"),
      presentDay("2026-06-10", "tipo-conselho", null, "Conselho sem efeito"),
    ];
    const v = councilAgendaView({ phase: "pronto", range: { start: "2026-04-10", end: "2026-06-10" }, knownAt: K, days, config: { kind: "configurada", councilDayTypeIds: ["tipo-conselho"] } });
    expect(v.kind).toBe("agenda");
    if (v.kind !== "agenda") return;
    expect(v.items.map((i) => i.date)).toEqual(["2026-04-10", "2026-06-10"]);
    expect(v.items.every((i) => i.versionId === "ver-ficticia")).toBe(true);
  });
  it("evento atualizado não reescreve data de sessão existente (agenda é só leitura)", () => {
    const session = Object.freeze({ id: "ses-1", scheduledFor: "2026-04-09T13:00:00Z" });
    const days = [presentDay("2026-04-10", "tipo-conselho", true, "Conselho")];
    councilAgendaView({ phase: "pronto", range: { start: "2026-04-10", end: "2026-04-10" }, knownAt: K, days, config: { kind: "configurada", councilDayTypeIds: ["tipo-conselho"] } });
    expect(session.scheduledFor).toBe("2026-04-09T13:00:00Z");
    expect(Object.isFrozen(days[0])).toBe(false);
  });
});
