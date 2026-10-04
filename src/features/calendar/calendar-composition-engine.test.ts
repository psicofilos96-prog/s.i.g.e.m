import { describe, expect, it } from "vitest";
import { composeCalendarDeclarations as compose, type CompositionCandidate, type NormDimensionRule } from "./calendar-composition-engine";

const snap = { on: "2026-04-01", knownAt: "2026-04-01T12:00:00.000001Z" };
const norm = (mult: "exigir-exclusividade" | "compor-por-dimensao" | null, rules: NormDimensionRule[] = [], over: Record<string, unknown> = {}, hover: Record<string, unknown> = {}) => ({
  state: "norma-homologada", normId: "ccn-x", versionId: "ccnv-1", version: 1, validFrom: "2026-01-01", validTo: "2026-12-31",
  recordedAt: "2026-01-01T00:00:00Z", actId: "ato-1",
  configuration: { recorded: true, multiplicity: mult, dimensionRules: rules },
  homologation: { state: "homologada", recordId: "h-1", sequence: 1, effectiveFrom: "2026-01-01", recordedAt: "2026-01-02T00:00:00Z", exercisedCapabilityId: "cap-x", ...hover },
  ...over,
});
const cand = (cal: string, decls: [string, string, unknown][], o: Partial<CompositionCandidate> = {}) => ({
  resolution: "candidato", calendarId: cal, versionId: `${cal}-v1`, version: 1,
  scopes: [{ scopeKey: `${cal}-s1`, windowFrom: null, windowTo: null }],
  declarations: decls.map(([dimensionId, declarationId, value]) => ({ dimensionId, declarationId, declarationVersionId: `${declarationId}-v1`, value })),
  ...o,
});
const agree: NormDimensionRule = { dimensionId: "letivo", operation: "exigir-concordancia", onAbsence: "indeterminado" };
const union: NormDimensionRule = { dimensionId: "letivo", operation: "uniao-com-diagnostico", onAbsence: "desconsiderar-candidato-sem-declaracao" };

describe("B4.6.5b motor de composição", () => {
  it("exclusividade com um calendário determina e nunca autoriza", () => {
    const r = compose({ snapshot: snap, norm: norm("exigir-exclusividade"), candidates: [cand("a", [["letivo", "d1", false]])] });
    expect(r.state).toBe("determinado");
    expect(r.dimensions[0]).toMatchObject({ value: false, state: "determinado" });
    expect(r.authorizes).toBe(false); expect(r.publishes).toBe(false);
  });
  it("exclusividade com dois calendários não escolhe", () => {
    const r = compose({ snapshot: snap, norm: norm("exigir-exclusividade"), candidates: [cand("a", [["letivo", "d1", true]]), cand("b", [["letivo", "d2", true]])] });
    expect(r.state).toBe("multiplicidade-proibida");
  });
  it("vários recortes da mesma versão não criam multiplicidade", () => {
    const c2 = cand("a", [["letivo", "d1", true]], { scopes: [{ scopeKey: "a-s2", windowFrom: "2026-03-01", windowTo: "2026-04-01" }] });
    const r = compose({ snapshot: snap, norm: norm("exigir-exclusividade"), candidates: [cand("a", [["letivo", "d1", true]]), c2] });
    expect(r.state).toBe("determinado");
    expect(r.calendars).toEqual([{ calendarId: "a", versionId: "a-v1", version: 1, scopeKeys: ["a-s1", "a-s2"] }]);
  });
  it("evidência repetida divergente / versões diferentes do mesmo calendário são inválidas", () => {
    expect(compose({ snapshot: snap, norm: norm("exigir-exclusividade"), candidates: [cand("a", [["letivo", "d1", true]]), cand("a", [["letivo", "d1", false]])] }).state).toBe("entrada-invalida");
    expect(compose({ snapshot: snap, norm: norm("exigir-exclusividade"), candidates: [cand("a", []), cand("a", [], { versionId: "a-v2", version: 2 })] }).state).toBe("entrada-invalida");
    const dupId = cand("a", [["letivo", "d1", true], ["letivo", "d1", false]]);
    expect(compose({ snapshot: snap, norm: norm("exigir-exclusividade"), candidates: [dupId] }).state).toBe("entrada-invalida");
  });
  it("conflito dentro do mesmo calendário", () => {
    const r = compose({ snapshot: snap, norm: norm("exigir-exclusividade"), candidates: [cand("a", [["letivo", "d1", true], ["letivo", "d2", false]])] });
    expect(r.state).toBe("indeterminado"); expect(r.dimensions[0]!.state).toBe("conflito");
  });
  it("concordância: iguais determinam; true×false conflitam", () => {
    expect(compose({ snapshot: snap, norm: norm("compor-por-dimensao", [agree]), candidates: [cand("a", [["letivo", "d1", false]]), cand("b", [["letivo", "d2", false]])] }).state).toBe("determinado");
    const r = compose({ snapshot: snap, norm: norm("compor-por-dimensao", [agree]), candidates: [cand("a", [["letivo", "d1", true]]), cand("b", [["letivo", "d2", false]])] });
    expect(r.dimensions[0]!.state).toBe("conflito"); expect(r.state).toBe("indeterminado");
  });
  it("união preserva todas as declarações e sinaliza divergência", () => {
    const r = compose({ snapshot: snap, norm: norm("compor-por-dimensao", [union]), candidates: [cand("b", [["letivo", "d2", false]]), cand("a", [["letivo", "d1", true]])] });
    expect(r.state).toBe("indeterminado");
    expect(r.dimensions[0]).toMatchObject({ state: "divergente", values: [false, true] });
    expect(r.dimensions[0]!.provenance.map((p) => p.declarationId)).toEqual(["d1", "d2"]);
    expect(r.dimensions[0]).not.toHaveProperty("value");
  });
  it("independe da ordem dos candidatos", () => {
    const cs = [cand("a", [["letivo", "d1", true]]), cand("b", [["letivo", "d2", true]]), cand("c", [["letivo", "d3", null]])];
    const r1 = compose({ snapshot: snap, norm: norm("compor-por-dimensao", [union]), candidates: cs });
    const r2 = compose({ snapshot: snap, norm: norm("compor-por-dimensao", [union]), candidates: [...cs].reverse() });
    expect(r1).toEqual(r2);
  });
  it("null é ausência, nunca false; on_absence explícito", () => {
    const nulls = [cand("a", [["letivo", "d1", null]]), cand("b", [["letivo", "d2", false]])];
    const ind = compose({ snapshot: snap, norm: norm("compor-por-dimensao", [agree]), candidates: nulls });
    expect(ind.dimensions[0]).toMatchObject({ state: "indeterminado", absentCalendars: ["a"] });
    const dis = compose({ snapshot: snap, norm: norm("compor-por-dimensao", [union]), candidates: nulls });
    expect(dis.dimensions[0]).toMatchObject({ state: "determinado", value: false, absentCalendars: ["a"] });
    const allMissing = compose({ snapshot: snap, norm: norm("compor-por-dimensao", [union]), candidates: [cand("a", []), cand("b", [["letivo", "d2", null]])] });
    expect(allMissing.dimensions[0]!.state).toBe("indeterminado"); expect(allMissing.state).toBe("indeterminado");
  });
  it("dimensão sem regra não é eliminada", () => {
    const r = compose({ snapshot: snap, norm: norm("compor-por-dimensao", [agree]), candidates: [cand("a", [["letivo", "d1", true], ["conselho", "d9", "cc"]])] });
    expect(r.state).toBe("indeterminado");
    expect(r.dimensions.find((d) => d.dimensionId === "conselho")!.state).toBe("dimensao-sem-regra");
  });
  it("candidato indeterminado bloqueia; não-correspondente é registrado", () => {
    const r = compose({ snapshot: snap, norm: norm("exigir-exclusividade"), candidates: [cand("a", [["letivo", "d1", true]]), cand("b", [], { resolution: "referencia-indeterminada:alocacao" })] });
    expect(r.state).toBe("candidato-indeterminado");
    const ok = compose({ snapshot: snap, norm: norm("exigir-exclusividade"), candidates: [cand("a", [["letivo", "d1", true]]), cand("b", [], { resolution: "nao-corresponde" })] });
    expect(ok.state).toBe("determinado"); expect(ok.excluded).toHaveLength(1);
    expect(compose({ snapshot: snap, norm: norm("exigir-exclusividade"), candidates: [] }).state).toBe("sem-candidato");
  });
  it("estado/operação desconhecidos são inválidos", () => {
    expect(compose({ snapshot: snap, norm: norm("exigir-exclusividade"), candidates: [cand("a", [], { resolution: "dominante" })] }).state).toBe("entrada-invalida");
    expect(compose({ snapshot: snap, norm: norm("prioridade" as never), candidates: [] }).state).toBe("entrada-invalida");
    expect(compose({ snapshot: snap, norm: norm("compor-por-dimensao", [{ ...agree, operation: "maioria" as never }]), candidates: [] }).state).toBe("entrada-invalida");
    expect(compose({ snapshot: snap, norm: norm("compor-por-dimensao", [{ ...agree, onAbsence: "false" as never }]), candidates: [] }).state).toBe("entrada-invalida");
  });
  it("norma ausente/incompleta/não homologada/revogada/ambígua bloqueia", () => {
    for (const s of ["sem-norma", "configuracao-incompleta", "norma-nao-homologada", "ambigua:multiplas-normas-homologadas"])
      expect(compose({ snapshot: snap, norm: { state: s }, candidates: [] }).state).toBe("norma-bloqueada");
    expect(compose({ snapshot: snap, norm: norm(null), candidates: [] }).state).toBe("norma-bloqueada");
    expect(compose({ snapshot: snap, norm: norm("compor-por-dimensao"), candidates: [] }).state).toBe("norma-bloqueada");
    expect(compose({ snapshot: snap, norm: norm("exigir-exclusividade", [agree]), candidates: [] }).state).toBe("norma-bloqueada");
    expect(compose({ snapshot: snap, norm: norm("exigir-exclusividade", [], {}, { state: "revogada" }), candidates: [] }).state).toBe("norma-bloqueada");
    expect(compose({ snapshot: snap, norm: norm("exigir-exclusividade", [], { homologation: null }), candidates: [] }).state).toBe("norma-bloqueada");
    expect(compose({ snapshot: snap, norm: norm("exigir-exclusividade", [], { configuration: { recorded: false, multiplicity: "exigir-exclusividade", dimensionRules: [] } }), candidates: [] }).state).toBe("norma-bloqueada");
  });
  it("proveniência ausente ou flag simulada recusadas", () => {
    expect(compose({ snapshot: snap, norm: norm("exigir-exclusividade", [], { actId: "" }), candidates: [] }).state).toBe("entrada-invalida");
    expect(compose({ snapshot: snap, norm: norm("exigir-exclusividade", [], {}, { exercisedCapabilityId: undefined }), candidates: [] }).state).toBe("entrada-invalida");
    expect(compose({ snapshot: snap, norm: norm("exigir-exclusividade", [], { authorized: true }), candidates: [] }).state).toBe("entrada-invalida");
    expect(compose({ snapshot: snap, norm: { state: "sem-norma", authorized: true }, candidates: [] }).state).toBe("entrada-invalida");
  });
  it("snapshot, datas e precisão de microssegundos", () => {
    expect(compose({ snapshot: { on: "2026-02-30", knownAt: snap.knownAt }, norm: norm("exigir-exclusividade"), candidates: [] }).state).toBe("snapshot-invalido");
    expect(compose({ snapshot: { on: snap.on, knownAt: "2026-04-01T12:00:00" }, norm: norm("exigir-exclusividade"), candidates: [] }).state).toBe("snapshot-invalido");
    // homologação 1µs após knownAt ⇒ não conhecida
    const k = "2026-01-02T00:00:00.000001Z";
    expect(compose({ snapshot: { on: snap.on, knownAt: "2026-01-02T00:00:00Z" }, norm: norm("exigir-exclusividade", [], {}, { recordedAt: k }), candidates: [cand("a", [])] }).state).toBe("norma-bloqueada");
    expect(compose({ snapshot: { on: snap.on, knownAt: k }, norm: norm("exigir-exclusividade", [], {}, { recordedAt: k }), candidates: [cand("a", [["x", "d", 1]])] }).state).toBe("determinado");
    expect(compose({ snapshot: { on: "2027-01-01", knownAt: snap.knownAt }, norm: norm("exigir-exclusividade"), candidates: [] }).state).toBe("norma-bloqueada");
    expect(compose({ snapshot: snap, norm: norm("exigir-exclusividade", [], { validFrom: "2026-13-01" }), candidates: [] }).state).toBe("entrada-invalida");
    const outWin = cand("a", [], { scopes: [{ scopeKey: "s", windowFrom: "2026-05-01", windowTo: "2026-06-01" }] });
    expect(compose({ snapshot: snap, norm: norm("exigir-exclusividade"), candidates: [outWin] }).state).toBe("entrada-invalida");
    const inverted = cand("a", [], { scopes: [{ scopeKey: "s", windowFrom: "2026-06-01", windowTo: "2026-05-01" }] });
    expect(compose({ snapshot: snap, norm: norm("exigir-exclusividade"), candidates: [inverted] }).state).toBe("entrada-invalida");
  });
  it("saída congelada e entrada intacta", () => {
    const input = { snapshot: snap, norm: norm("compor-por-dimensao", [union]), candidates: [cand("b", [["letivo", "d2", false]]), cand("a", [["letivo", "d1", true]])] };
    const before = JSON.parse(JSON.stringify(input));
    const r = compose(input);
    expect(input).toEqual(before);
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.dimensions[0]!.provenance[0])).toBe(true);
    expect(Object.isFrozen(input.candidates)).toBe(false);
  });
});
