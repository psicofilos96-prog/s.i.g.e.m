import { describe, expect, it } from "vitest";
import { confer, resolveLayout, summarizeConference, type LayoutRef, type Rule } from "./initial-enrollment-conference";

const l25: LayoutRef = { year: "2025", stageKey: "matricula-inicial", version: 1, sourceSha256: "a", inepConfronted: true };
const l26: LayoutRef = { ...l25, year: "2026" };
const inep: Rule = { id: "inep-8-digitos", version: 1, entity: "escola", layoutYear: "2026", stageKey: "matricula-inicial", basis: "Registro 00 campo INEP", officialSource: "Leiaute 2026 doc sha a", severity: "impeditiva", blocksExport: true, fix: "ficha da unidade",
  check: (r) => (r["inep"] == null ? null : /^\d{8}$/.test(String(r["inep"]))) };
const start: Rule = { id: "matricula-com-inicio", version: 1, entity: "matricula", layoutYear: "2026", stageKey: "matricula-inicial", basis: "data de entrada", officialSource: null, severity: "alerta", blocksExport: true, fix: "Secretaria",
  check: (r) => r["openedOn"] != null };
const recs = { escola: [{ id: "e1", inep: "33012345" }, { id: "e2", inep: "123" }, { id: "e3", inep: null }], matricula: [{ id: "m1", openedOn: null }] };

describe("CIECE L09 conferência de Matrícula Inicial", () => {
  it("sem leiaute do ano: recusa; outro ano só com confirmação explícita", () => {
    expect(resolveLayout("2026", "matricula-inicial", [l25]).kind).toBe("recusado");
    const r = confer("2026", "matricula-inicial", [l25], [inep], recs);
    expect(r.officialStatus).toBe("nao-executada"); expect(r.exportBlocked).toBe(true);
    const a = resolveLayout("2026", "matricula-inicial", [l25], { fromYear: "2025", toYear: "2026", actor: "ciece", at: "x", reason: "" });
    expect(a.kind).toBe("recusado");
  });
  it("oficial: regra, fonte, afetados, não verificáveis e bloqueio só por regra oficial", () => {
    const r = confer("2026", "matricula-inicial", [l26], [inep, start], recs);
    const f = r.findings.find((x) => x.ruleId === "inep-8-digitos")!;
    expect(f.affected).toEqual(["e2"]); expect(f.unverifiable).toEqual(["e3"]); expect(f.blocksExport).toBe(true);
    expect(r.findings.find((x) => x.ruleId === "matricula-com-inicio")!.blocksExport).toBe(false); // sem fonte oficial
    expect(r.exportBlocked).toBe(true);
    expect(summarizeConference(r)["escola"]).toEqual({ impeditiva: 1, alerta: 0, informativa: 0, naoVerificavel: 1 });
  });
  it("por analogia nunca é oficial e regra de outro leiaute é pulada", () => {
    const rule25 = { ...inep, layoutYear: "2025", version: 2 };
    const r = confer("2026", "matricula-inicial", [l25], [rule25, inep], recs, { fromYear: "2025", toYear: "2026", actor: "ciece", at: "x", reason: "sem leiaute 2026" });
    expect(r.officialStatus).toBe("conferencia-por-analogia");
    expect(r.findings[0]!.blocksExport).toBe(false);
    expect(r.skippedRules).toEqual([{ ruleId: "inep-8-digitos", reason: "regra-de-outro-leiaute" }]);
    expect(r.exportBlockReasons).toContain("leiaute-por-analogia: arquivo oficial não pode ser gerado");
  });
  it("fonte não lida é pulada, nunca conforme; leiaute não confrontado bloqueia", () => {
    const r = confer("2026", "matricula-inicial", [{ ...l26, inepConfronted: false }], [inep], {});
    expect(r.skippedRules[0]!.reason).toBe("fonte-nao-lida");
    expect(r.exportBlockReasons).toContain("leiaute-nao-confrontado-com-inep");
  });
});
