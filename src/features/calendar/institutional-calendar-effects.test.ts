import { describe, it, expect } from "vitest";
import {
  resolveCalendarDay, countSchoolDays, projectPlannedLessons, councilAgenda, calendarImpact,
  type DeclarationRow, type CalendarDayInput, type Applicability,
} from "./institutional-calendar-effects";

const K = "2027-01-01T00:00:00.000001Z";
const APP: Applicability = { kind: "declarada", schoolIds: ["esc-1"] };
const row = (p: Partial<DeclarationRow>): DeclarationRow => ({
  day_state: "declarado", version_id: "v1", reference_issue: null, homologation_state: "homologada",
  declaration_kind: "faixa", declaration_id: "r1", starts_on: null, ends_on: null, event_label: null,
  day_type_id: "t-letivo", day_type_version_id: "tv1", day_type_version: 1, day_type_label: "X", school_day_effect: true, ...p,
});
const day = (date: string, rows: DeclarationRow[], cal = "cal-1"): CalendarDayInput => ({ source: "declaracoes", calendarId: cal, date, knownAt: K, rows });
const letivo = (d: string) => day(d, [row({})]);
const feriado = (d: string) => day(d, [row({}), row({ declaration_kind: "evento", declaration_id: "e1", day_type_id: "t-fer", day_type_version_id: "tv2", school_day_effect: false })]);
// semana seg 2027-03-01 .. dom 2027-03-07
const week = ["2027-03-01", "2027-03-02", "2027-03-03", "2027-03-04", "2027-03-05", "2027-03-06", "2027-03-07"];

describe("motor de efeitos do calendário institucional", () => {
  it("feriado declarado (false) e letivo (true) sem regra ⇒ conflito, nunca zero", () => {
    const r = resolveCalendarDay(feriado("2027-03-02"), APP, "esc-1");
    expect(r.state).toBe("conflito-sem-regra");
    expect(countSchoolDays([r]).count).toBeNull();
  });

  it("recesso declarado como nao-letivo remove aulas previstas sem gerar ausência; contagem muda", () => {
    const blocks = [{ blockId: "b1", weekday: 2 as const, units: 2 }, { blockId: "b7", weekday: 7 as const, units: 1 }];
    const before = week.map((d) => resolveCalendarDay(letivo(d), APP, "esc-1"));
    const recesso = day("2027-03-02", [row({ declaration_kind: "atribuicao", declaration_id: "2027-03-02", day_type_id: "t-rec", school_day_effect: false })]);
    const after = week.map((d) => resolveCalendarDay(d === "2027-03-02" ? recesso : letivo(d), APP, "esc-1"));
    expect(countSchoolDays(before).count).toBe(7);
    expect(countSchoolDays(after).count).toBe(6);
    expect(projectPlannedLessons(blocks, before).plannedUnits).toBe(3); // domingo cadastrado conta
    const p = projectPlannedLessons(blocks, after);
    expect(p.plannedUnits).toBe(1);
    expect(p.days[1]!.kind).toBe("sem-aula-por-calendario");
  });

  it("efeito NULL ≠ false: evento informativo sozinho fica efeito-nao-declarado; com letivo, é letivo", () => {
    const info = row({ declaration_kind: "evento", day_type_id: "t-info", school_day_effect: null });
    expect(resolveCalendarDay(day("2027-03-06", [info]), APP, "esc-1").state).toBe("efeito-nao-declarado");
    expect(resolveCalendarDay(day("2027-03-06", [row({}), info]), APP, "esc-1").state).toBe("letivo");
  });

  it("sábado/domingo não declarados não viram não letivos", () => {
    const r = resolveCalendarDay(day("2027-03-07", [row({ day_state: "nao-declarado", declaration_kind: null, declaration_id: null, day_type_id: null, day_type_version_id: null, day_type_version: null, school_day_effect: null })]), APP, "esc-1");
    expect(r.state).toBe("nao-declarado");
    expect(projectPlannedLessons([{ blockId: "b", weekday: 7, units: 1 }], [r]).plannedUnits).toBeNull();
  });

  it("estados próprios: acesso negado, indisponível, sem versão, B2.4 inválida, não homologado, revogado", () => {
    expect(resolveCalendarDay({ source: "acesso-negado", date: "2027-03-01", knownAt: K }, APP, "esc-1").state).toBe("acesso-negado");
    expect(resolveCalendarDay({ source: "indisponivel", date: "2027-03-01", knownAt: K, reason: "x" }, APP, "esc-1").state).toBe("fonte-indisponivel");
    expect(resolveCalendarDay(day("2027-03-01", [row({ day_state: "sem-versao-vigente", version_id: null, homologation_state: null })]), APP, "esc-1").state).toBe("sem-versao-vigente");
    expect(resolveCalendarDay(day("2027-03-01", [row({ day_state: "referencia-b2-4-invalida", reference_issue: "ano-inativo" })]), APP, "esc-1").diagnostic).toBe("ano-inativo");
    expect(resolveCalendarDay(day("2027-03-01", [row({ homologation_state: "nao-homologada" })]), APP, "esc-1").state).toBe("nao-homologado");
    expect(resolveCalendarDay(day("2027-03-01", [row({ homologation_state: "revogada" })]), APP, "esc-1").state).toBe("revogado");
    expect(resolveCalendarDay(day("2027-03-01", []), APP, "esc-1").state).toBe("fonte-malformada");
    expect(resolveCalendarDay(day("2027-03-01", [row({}), row({ version_id: "v2" })]), APP, "esc-1").state).toBe("fonte-malformada");
  });

  it("aplicabilidade só declarada: não declarada ou outra escola ⇒ indeterminado", () => {
    expect(resolveCalendarDay(letivo("2027-03-01"), { kind: "nao-declarada" }, "esc-1").state).toBe("aplicabilidade-nao-declarada");
    expect(resolveCalendarDay(letivo("2027-03-01"), APP, "esc-2").state).toBe("nao-aplicavel-a-escola");
  });

  it("conselho só por tipo configurado, nunca por rótulo; sem configuração = estado próprio", () => {
    const cc = row({ declaration_kind: "evento", declaration_id: "ev-cc", event_label: "Conselho de Classe", day_type_id: "t-x", school_day_effect: null });
    const d = [resolveCalendarDay(day("2027-03-03", [row({}), cc]), APP, "esc-1")];
    expect(councilAgenda(d, { kind: "nao-configurada" }).kind).toBe("nao-configurada");
    expect(councilAgenda(d, { kind: "configurada", councilDayTypeIds: ["t-cc"] })).toMatchObject({ items: [] });
    const a = councilAgenda(d, { kind: "configurada", councilDayTypeIds: ["t-x"] });
    expect(a).toMatchObject({ kind: "completa", items: [{ date: "2027-03-03", versionId: "v1" }] });
  });

  it("alteração sinaliza impacto e preserva registros existentes com proveniência de versão", () => {
    const before = [resolveCalendarDay(letivo("2027-03-02"), APP, "esc-1")];
    const rec = day("2027-03-02", [row({ version_id: "v2", day_type_id: "t-rec", school_day_effect: false })]);
    const after = [resolveCalendarDay(rec, APP, "esc-1")];
    const imp = calendarImpact(before, after, { "2027-03-02": ["aula:L1", "frequencia:F1"] });
    expect(imp).toEqual([{ date: "2027-03-02", before: "letivo", after: "nao-letivo", preservedRecords: ["aula:L1", "frequencia:F1"] }]);
    expect(after[0]!.versionId).toBe("v2");
    expect(after[0]!.knownAt).toBe(K);
  });
});
