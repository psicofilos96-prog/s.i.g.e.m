import { describe, expect, it } from "vitest";
import { bridgeComposedDay, composedCalendarBasis, countComposedSchoolDays, projectComposedPlannedLessons } from "./calendar-composition-bridge";
import { ratioOverSchoolDays } from "./calendar-basis";

const K = "2026-04-01T12:00:00.000001+00:00";
const ctx = { state: "derivado", allocation: "a-1", school: "esc-a", class: "t-1", academicYear: "ano", position: null, axis: "nao-derivado" };
const norm = (mult: string, rules: unknown[] = [], bindings: unknown[] = [{ dimensionId: "letivo", effectPrimitive: "school_day_effect", effectContractVersion: 1 }], hs = "homologada") => ({
  state: "norma-homologada", normId: "ccn-x", versionId: "nv-1", version: 1, validFrom: "2026-01-01", validTo: null,
  recordedAt: "2026-01-01T00:00:00+00:00", actId: "ato",
  configuration: { recorded: true, multiplicity: mult, dimensionRules: rules },
  homologation: { state: hs, recordId: "h-1", sequence: 1, effectiveFrom: "2026-01-01", recordedAt: "2026-01-02T00:00:00+00:00", exercisedCapabilityId: "cap-sintetica" },
  effectBindings: bindings,
});
const row = (v: string, id: string, eff: boolean | null, o: Record<string, unknown> = {}) => ({
  day_state: "declarado", version_id: v, reference_issue: null, homologation_state: "homologada", declaration_kind: "faixa", declaration_id: id,
  starts_on: "2026-02-01", ends_on: "2026-06-30", event_label: null, day_type_id: `cdt-${id}`, day_type_version_id: `tv-${id}`, day_type_version: 1,
  day_type_label: "Rótulo irrelevante", school_day_effect: eff, ...o,
});
const cand = (cal: string, rows: unknown[], o: Record<string, unknown> = {}) => ({
  resolution: "candidato", calendarId: cal, versionId: `${cal}-v`, version: 1,
  scopes: [{ scopeKey: `${cal}-s`, windowFrom: "2026-02-01", windowTo: "2026-12-15" }], dayRows: rows, ...o,
});
const ev = (n: unknown, candidates: unknown[], on = "2026-04-01", knownAt = K) => ({ contract: "b4.6.5c/1", snapshot: { on, knownAt }, context: ctx, norm: n, candidates });
const exp = { on: "2026-04-01", knownAt: K };
const agree = { dimensionId: "letivo", operation: "exigir-concordancia", onAbsence: "indeterminado" };

describe("B4.6.5c ponte composição → efeitos", () => {
  it("um calendário homologado: false é não letivo determinado; nada autoriza", () => {
    const d = bridgeComposedDay(ev(norm("exigir-exclusividade"), [cand("a", [row("a-v", "r1", false)])]), exp);
    expect(d).toMatchObject({ state: "nao-letivo", determined: true, schoolDayEffect: false, authorizes: false, publishes: false });
    expect(d.declarations[0]).toMatchObject({ dayTypeVersionId: "tv-r1", dayTypeVersion: 1 });
  });
  it("null nunca é false; efeito ausente impede contagem", () => {
    const d = bridgeComposedDay(ev(norm("exigir-exclusividade"), [cand("a", [row("a-v", "r1", null)])]), exp);
    expect(d.state).toBe("composicao-indeterminada");
    expect(countComposedSchoolDays([d]).count).toBeNull();
  });
  it("sem vínculo explícito ⇒ efeito não vinculado (rótulo nunca decide)", () => {
    const d = bridgeComposedDay(ev(norm("exigir-exclusividade", [], []), [cand("a", [row("a-v", "r1", true, { day_type_label: "Letivo" })])]), exp);
    expect(d.state).toBe("efeito-nao-vinculado"); expect(d.determined).toBe(false);
  });
  it("primitiva/versão de contrato desconhecida, contrato de evidência e linha estranha são inválidos", () => {
    expect(bridgeComposedDay(ev(norm("exigir-exclusividade", [], [{ dimensionId: "x", effectPrimitive: "feriado", effectContractVersion: 1 }]), []), exp).state).toBe("evidencia-invalida");
    expect(bridgeComposedDay(ev(norm("exigir-exclusividade", [], [{ dimensionId: "x", effectPrimitive: "school_day_effect", effectContractVersion: 2 }]), []), exp).state).toBe("evidencia-invalida");
    expect(bridgeComposedDay({ ...ev(norm("exigir-exclusividade"), []), contract: "v0" }, exp).state).toBe("evidencia-invalida");
    expect(bridgeComposedDay(ev(norm("exigir-exclusividade"), [cand("a", [{ ...row("a-v", "r1", true), cor: "verde" }])]), exp).state).toBe("evidencia-invalida");
    expect(bridgeComposedDay(ev(norm("exigir-exclusividade"), [cand("a", [row("a-v", "r1", "true" as never)])]), exp).state).toBe("evidencia-invalida");
    expect(bridgeComposedDay(ev(norm("exigir-exclusividade"), [cand("a", [row("outra-v", "r1", true)])]), exp).state).toBe("evidencia-invalida");
  });
  it("snapshot da evidência deve coincidir com o pedido (µs)", () => {
    expect(bridgeComposedDay(ev(norm("exigir-exclusividade"), [], "2026-04-02"), exp).state).toBe("snapshot-divergente");
    expect(bridgeComposedDay(ev(norm("exigir-exclusividade"), [], "2026-04-01", "2026-04-01T12:00:00.000002+00:00"), exp).state).toBe("snapshot-divergente");
    expect(bridgeComposedDay(ev(norm("exigir-exclusividade"), [cand("a", [row("a-v", "r1", true)])], "2026-04-01", "2026-04-01T09:00:00.000001-03:00"), exp).state).toBe("letivo");
  });
  it("contexto indisponível vindo do banco não gera resultado", () => {
    const d = bridgeComposedDay({ contract: "b4.6.5c/1", snapshot: exp, context: { state: "alocacao-encerrada-na-data", allocation: "a-1" } }, exp);
    expect(d.state).toBe("contexto-indisponivel");
  });
  it("multicalendário compor-por-dimensao preserva todos e não usa versionId único", () => {
    const d = bridgeComposedDay(ev(norm("compor-por-dimensao", [agree]), [cand("b", [row("b-v", "r2", true)]), cand("a", [row("a-v", "r1", true)])]), exp);
    expect(d.state).toBe("letivo");
    expect(d.calendars.map((c) => c.versionId)).toEqual(["a-v", "b-v"]);
    expect(d).not.toHaveProperty("versionId");
  });
  it("conflito entre calendários e dentro do mesmo calendário bloqueia", () => {
    expect(bridgeComposedDay(ev(norm("compor-por-dimensao", [agree]), [cand("a", [row("a-v", "r1", true)]), cand("b", [row("b-v", "r2", false)])]), exp).state).toBe("composicao-indeterminada");
    const inner = [row("a-v", "r1", true, { day_state: "conflito-sem-regra" }), row("a-v", "r2", false, { day_state: "conflito-sem-regra", declaration_kind: "evento" })];
    expect(bridgeComposedDay(ev(norm("exigir-exclusividade"), [cand("a", inner)]), exp).state).toBe("composicao-indeterminada");
    expect(bridgeComposedDay(ev(norm("exigir-exclusividade"), [cand("a", [row("a-v", "r1", true)]), cand("b", [row("b-v", "r2", true)])]), exp).reason).toMatch(/multiplicidade-proibida/);
  });
  it("calendário não homologado/revogado ou candidato indeterminado bloqueia sem descartar", () => {
    const d = bridgeComposedDay(ev(norm("compor-por-dimensao", [agree]), [cand("a", [row("a-v", "r1", true)]), cand("b", [row("b-v", "r2", true, { homologation_state: "revogado" })])]), exp);
    expect(d.state).toBe("composicao-indeterminada"); expect(d.reason).toMatch(/candidato-indeterminado/);
    const w = bridgeComposedDay(ev(norm("exigir-exclusividade"), [cand("a", [row("a-v", "r1", true)]), cand("b", [], { resolution: "janela-nao-registrada" })]), exp);
    expect(w.state).toBe("composicao-indeterminada");
    const ap = bridgeComposedDay(ev(norm("exigir-exclusividade"), [cand("b", [], { resolution: "aplicabilidade-nao-registrada", scopes: [] })]), exp);
    expect(ap.state).toBe("composicao-indeterminada");
  });
  it("norma não homologada/revogada bloqueia", () => {
    expect(bridgeComposedDay(ev({ state: "sem-norma" }, [cand("a", [row("a-v", "r1", true)])]), exp).state).toBe("composicao-indeterminada");
    expect(bridgeComposedDay(ev(norm("exigir-exclusividade", [], undefined, "revogada"), [cand("a", [row("a-v", "r1", true)])]), exp).state).toBe("composicao-indeterminada");
    expect(bridgeComposedDay(ev({ state: "sem-norma", effectBindings: [] }, []), exp).state).toBe("evidencia-invalida");
  });
  it("vários recortes da mesma versão não duplicam", () => {
    const c = cand("a", [row("a-v", "r1", true)], { scopes: [{ scopeKey: "s1", windowFrom: "2026-02-01", windowTo: "2026-12-15" }, { scopeKey: "s2", windowFrom: "2026-04-01", windowTo: "2026-04-30" }] });
    const d = bridgeComposedDay(ev(norm("exigir-exclusividade"), [c]), exp);
    expect(d.state).toBe("letivo"); expect(d.calendars[0]!.scopeKeys).toEqual(["s1", "s2"]);
  });
  it("dia sem declaração em calendário único fica indeterminado; on_absence desconsiderar compõe só com quem declara", () => {
    const nd = row("a-v", "x", null, { day_state: "nao-declarado", declaration_kind: null, declaration_id: null, day_type_id: null, day_type_version_id: null, day_type_version: null });
    expect(bridgeComposedDay(ev(norm("exigir-exclusividade"), [cand("a", [nd])]), exp).state).toBe("composicao-indeterminada");
    const dis = { ...agree, onAbsence: "desconsiderar-candidato-sem-declaracao" };
    expect(bridgeComposedDay(ev(norm("compor-por-dimensao", [dis]), [cand("a", [nd]), cand("b", [row("b-v", "r2", false)])]), exp).state).toBe("nao-letivo");
  });
  it("contagem, projeção e base congelada; razão só com denominador determinado", () => {
    const n = norm("exigir-exclusividade");
    const days = ["2026-04-04", "2026-04-05", "2026-04-06"].map((on, i) =>
      bridgeComposedDay(ev(n, [cand("a", [row("a-v", `r${i}`, i !== 1)])], on), { on, knownAt: K }));
    // sábado e domingo só pelo dado: 04/04 (sáb) declarado letivo, 05/04 (dom) não letivo
    expect(days.map((d) => d.state)).toEqual(["letivo", "nao-letivo", "letivo"]);
    expect(countComposedSchoolDays(days).count).toBe(2);
    expect(countComposedSchoolDays([...days, days[0]!]).count).toBeNull();
    const p = projectComposedPlannedLessons([{ blockId: "b", weekday: 7, units: 2 }, { blockId: "c", weekday: 1, units: 1 }], days);
    expect(p.plannedUnits).toBe(1);
    const basis = composedCalendarBasis(days, { knownAt: K, start: "2026-04-04", end: "2026-04-06" });
    expect(basis).toMatchObject({ kind: "determinado", schoolDays: 2 });
    expect(Object.isFrozen(basis.days[0])).toBe(true);
    expect(ratioOverSchoolDays(1, basis)).toMatchObject({ kind: "calculado", value: 0.5 });
    const gap = composedCalendarBasis(days.slice(0, 2), { knownAt: K, start: "2026-04-04", end: "2026-04-06" });
    expect(ratioOverSchoolDays(1, gap).kind).toBe("indisponivel");
  });
  it("não muta a evidência e congela a saída", () => {
    const e = ev(norm("exigir-exclusividade"), [cand("a", [row("a-v", "r1", true)])]);
    const before = JSON.stringify(e);
    const d = bridgeComposedDay(e, exp);
    expect(JSON.stringify(e)).toBe(before);
    expect(Object.isFrozen(d.calendars[0])).toBe(true);
    expect(Object.isFrozen(e.candidates)).toBe(false);
  });
});
