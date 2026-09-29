import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { CanonicalFact, FactAvailability } from "./canonical-fact-types";
import { computeIndicator, IndicatorRegistry } from "./indicator-engine";
import { proofRegistry, PROOF_DEFINITIONS } from "./indicator-proof-definitions";
import type { SchoolUnit } from "@/features/schools/school-registry";

const standing = (s: string, cat: string | null, a: FactAvailability = "disponivel", cycle = "c26", school = "e1"): CanonicalFact => ({
  factTypeId: "situacao-academica-oficial", familyId: "vida-academica", subject: { studentId: s, cycleId: cycle },
  dimensions: { schoolId: school, classId: "t1", cycleId: cycle }, availability: a,
  payload: a === "disponivel" ? { kind: "categorico", categoryId: cat } : null,
  temporal: { occurredAt: "2026-12-20T00:00:00Z", cycleId: cycle },
  provenance: { domainId: "12I", sourceId: "academic_standing_versions", recordId: `r-${s}`, recordVersion: 1, ruleOrPolicyId: "rs", ruleOrPolicyVersion: 2 },
  schemaVersion: 1,
});
const freq = (s: string, attended: number, applicable: number, period = "p1"): CanonicalFact => ({
  factTypeId: "frequencia-apurada-do-periodo", familyId: "vida-academica", subject: { studentId: s, periodId: period },
  dimensions: { schoolId: "e1", classId: "t1", periodId: period }, availability: "disponivel",
  payload: { kind: "quantitativo", measures: { attendedUnits: attended, applicableUnits: applicable } },
  temporal: { occurredAt: "2026-05-01T00:00:00Z", periodId: period },
  provenance: { domainId: "12H", sourceId: "attendance_closing_versions", recordId: `f-${s}-${period}`, recordVersion: 1 }, schemaVersion: 1,
});
const R = proofRegistry();
const cyc = { cycleId: "c26" };
const run = (id: string, facts: CanonicalFact[], extra: object = {}, schools: SchoolUnit[] = []) =>
  computeIndicator(R, facts, { definitionId: id, reference: cyc, ...extra }, schools);
const g0 = (r: ReturnType<typeof run>) => { if (!r.ok) throw new Error(r.code); return r.groups[0]!; };

describe("14.2 motor de indicadores", () => {
  it("1. determinístico", () => {
    const f = [standing("a", "aprovado"), standing("b", "retido")];
    expect(run("prova-percentual-situacao", f)).toEqual(run("prova-percentual-situacao", f));
  });
  it("2. zero verdadeiro permanece zero", () => {
    const g = g0(run("prova-percentual-situacao", [standing("a", "retido")]));
    expect(g.status).toBe("calculado"); expect(g.value).toBe(0); expect(g.numerator).toBe(0);
  });
  it("3/7. ausência não vira zero; cobertura parcial explícita", () => {
    const g = g0(run("prova-estudantes-por-situacao", [standing("a", "aprovado"), standing("b", null, "ausente")]));
    expect(g.value).toBe(1); expect(g.absentSubjects).toBe(1); expect(g.coverage).toEqual({ eligible: 2, observed: 1, complete: false });
  });
  it("4. população vazia ≠ zero", () => {
    const g = g0(run("prova-estudantes-por-situacao", []));
    expect(g.status).toBe("populacao-vazia"); expect(g.value).toBeNull();
  });
  it("5. indeterminado não é classificado", () => {
    const g = g0(run("prova-estudantes-por-situacao", [standing("a", "aprovado"), standing("b", null, "indeterminado")], { groupBy: "categoria" }));
    expect(g.groupKey).toBe("(sem valor declarado)"); expect(g.indeterminateSubjects).toBe(1); expect(g.value).toBeNull();
  });
  it("6. não aplicável sai do denominador", () => {
    const g = g0(run("prova-percentual-situacao", [standing("a", "aprovado"), standing("b", null, "nao-aplicavel")]));
    expect(g.denominator).toBe(1); expect(g.value).toBe(100);
  });
  it("8. cobertura completa exigida falha fechada", () => {
    const g = g0(run("prova-percentual-situacao", [standing("a", "aprovado"), standing("b", null, "ausente")]));
    expect(g.status).toBe("cobertura-incompleta"); expect(g.value).toBeNull();
  });
  it("9. versão histórica da escola", () => {
    const unit: SchoolUnit = { schoolId: "e1", identifiers: [], versions: [
      { id: "v1", schoolId: "e1", versionNumber: 1, supersedesVersionId: null, officialName: "E", address: null, district: "Centro", locationKind: "urbana", active: true, validFrom: "2020-01-01", originatingActRef: null },
      { id: "v2", schoolId: "e1", versionNumber: 2, supersedesVersionId: "v1", officialName: "E", address: null, district: "Norte", locationKind: "urbana", active: true, validFrom: "2027-01-01", originatingActRef: null },
    ] };
    const r = run("prova-estudantes-por-situacao", [standing("a", "aprovado")], { filters: { "school.schoolDistrict": "Centro" } }, [unit]);
    const g = g0(r); expect(g.value).toBe(1); expect(g.factRefs[0]!.schoolVersionId).toBe("v1");
  });
  it("10. contagem pronta não alimenta indicador (fonte fora do catálogo)", () => {
    const fake = { ...standing("a", "aprovado"), provenance: { ...standing("a", "x").provenance, sourceId: "cycle_closing_projection_counts" } };
    expect(g0(run("prova-estudantes-por-situacao", [fake])).status).toBe("populacao-vazia");
  });
  it("11. filtro por escola não mistura", () => {
    const g = g0(run("prova-estudantes-por-situacao", [standing("a", "aprovado"), standing("b", "aprovado", "disponivel", "c26", "e2")], { filters: { schoolId: "e1" } }));
    expect(g.value).toBe(1);
  });
  it("12. filtro temporal não mistura períodos; taxa de presença", () => {
    const r = computeIndicator(R, [freq("a", 9, 10), freq("a", 1, 10, "p2")], { definitionId: "prova-taxa-presenca", reference: { periodId: "p1" } });
    const g = g0(r); expect(g.numerator).toBe(9); expect(g.denominator).toBe(10); expect(g.value).toBe(90);
  });
  it("13. auditoria inversa", () => {
    const ref = g0(run("prova-estudantes-por-situacao", [standing("a", "aprovado")])).factRefs[0]!;
    expect(ref).toMatchObject({ sourceId: "academic_standing_versions", recordId: "r-a", recordVersion: 1, ruleOrPolicyId: "rs" });
  });
  it("14. definição/avaliador desconhecidos falham fechados", () => {
    expect(run("nao-existe", [])).toMatchObject({ ok: false, code: "definicao-desconhecida" });
    const reg = new IndicatorRegistry();
    reg.register({ ...PROOF_DEFINITIONS[0]!, operation: { evaluatorId: "magica", params: {} } });
    expect(computeIndicator(reg, [], { definitionId: PROOF_DEFINITIONS[0]!.id, reference: { at: "2026-03-01" } })).toMatchObject({ ok: false, code: "avaliador-desconhecido" });
    const draft = new IndicatorRegistry(); draft.register({ ...PROOF_DEFINITIONS[0]!, status: "rascunho" });
    expect(computeIndicator(draft, [], { definitionId: PROOF_DEFINITIONS[0]!.id, reference: {} }).ok).toBe(false);
  });
  it("15. dimensão inexistente não é inferida", () => {
    for (const d of ["studentAdministrativeSex", "classShift", "idade"])
      expect(run("prova-estudantes-por-situacao", [standing("a", "aprovado")], { groupBy: d })).toMatchObject({ ok: false, code: "dimensao-indisponivel" });
  });
  it("16. nenhum cálculo em tela importa o motor fora do ciece", () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
    const hits = walk("src").filter((p) => p.endsWith(".tsx") && readFileSync(p, "utf8").includes("indicator-engine"));
    expect(hits).toEqual([]);
  });
  it("17. nada persistido", () => {
    const src = readFileSync("src/features/ciece/indicator-engine.ts", "utf8");
    expect(src).not.toMatch(/supabase|localStorage|\.insert\(|\.upsert\(/);
  });
  it("fatos concorrentes do mesmo sujeito não são somados", () => {
    const g = g0(run("prova-estudantes-por-situacao", [standing("a", "aprovado"), { ...standing("a", "retido"), provenance: { ...standing("a", "x").provenance, recordId: "r2" } }]));
    expect(g.indeterminateSubjects).toBe(1); expect(g.status).toBe("sem-fatos-disponiveis");
  });
});
