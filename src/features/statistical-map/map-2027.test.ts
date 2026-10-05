/** T — Mapa Estatístico 2027: regra com escopo, ano operacional, herança travada, regência e exportação. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { assembleMapSnapshot, isRuleApplicable, officializationBlocks, snapshotFingerprint, type AssemblyInput, type MapCompetenceRule } from "./map-domain";
import { episodeFacts } from "@/features/ciece/fact-adapters";
import type { IndicatorDefinition } from "@/features/ciece/indicator-engine";
import type { SchoolUnit } from "@/features/schools/school-registry";
import { MAPA_ESTATISTICO_ESCOLA, mapaEscolaRows } from "@/features/reports/report-registry";
import { runReport, toCsv } from "@/features/reports/report-engine";

const def: IndicatorDefinition = {
  id: "mapa-matricula", version: 1, label: "Matrícula", status: "homologada", factTypeId: "episodio-de-enturmacao", subjectKey: "studentId",
  populationCriteria: {}, temporal: { kind: "fotografia" }, operation: { evaluatorId: "contagem", params: {} }, coverage: "parcial", unit: "estudantes",
};
const rule = (o: Partial<MapCompetenceRule> = {}, d: Partial<MapCompetenceRule["definition"]> = {}): MapCompetenceRule => ({
  id: "r", version: 1, status: "homologada", homologationActRef: null, validFrom: "2027-01-01", validUntil: "2027-12-31",
  definition: { coveredSchoolIds: ["A"], snapshotDate: { kind: "data-declarada-por-competencia", dates: { "2027-03": "2027-03-10", "2027-04": "2027-04-10" } } as never,
    cells: [{ cellId: "matricula", sectionId: "turmas", label: "Matrícula", definition: def }], blockingCellIds: [], previousMonthEnrollmentCellId: "matricula", ...d }, ...o,
});
const school = (id: string): SchoolUnit => ({ schoolId: id, identifiers: [], versions: [{ id: `${id}v`, schoolId: id, versionNumber: 1, supersedesVersionId: null, officialName: id, address: null, district: null, locationKind: null, active: true, validFrom: "2020-01-01", originatingActRef: null }] });
const epi = (id: string, from: string) => ({ id, enrollment_id: `m${id}`, student_id: `s${id}`, school_id: "A", class_id: "t1", class_label_snapshot: null, cycle_id: "c27", valid_from: from, originating_act_ref: null, supersedes_id: null, correction_reason: null, created_at: "t", ended_on: null });
const inp = (o: Partial<AssemblyInput> = {}): AssemblyInput => ({
  competence: { schoolId: "A", year: 2027, month: 4 }, rule: rule(), schools: [school("A"), school("B")], classes: [{ id: "t1", name: "1º ano A" }],
  facts: episodeFacts([epi("1", "2027-02-01"), epi("2", "2027-02-01")] as never), observations: { text: "", eventId: null },
  yearState: "operacional", previousOfficial: null, teaching: [], ...o,
});
const c = (s: ReturnType<typeof assembleMapSnapshot>, id: string) => s.cells.find((x) => x.cellId === id)!;

describe("T regra de competência", () => {
  it("draft não vale; fora da vigência ou da cobertura não vale", () => {
    expect(isRuleApplicable(rule({ status: "rascunho" }), { schoolId: "A", year: 2027, month: 4 })).toBe(false);
    expect(isRuleApplicable(rule(), { schoolId: "B", year: 2027, month: 4 })).toBe(false); // IDOR A/B: regra de A não cobre B
    expect(isRuleApplicable(rule(), { schoolId: "A", year: 2028, month: 1 })).toBe(false);
    expect(isRuleApplicable(rule({}, { coveredSchoolIds: undefined as never }), { schoolId: "A", year: 2027, month: 4 })).toBe(false);
    expect(isRuleApplicable(rule(), { schoolId: "A", year: 2027, month: 4 })).toBe(true);
  });
  it("sem regra: competência aguarda regra, consulta continua e oficialização é bloqueada", () => {
    const s = assembleMapSnapshot(inp({ rule: null }));
    expect(s.snapshotDate).toBeNull();
    expect(officializationBlocks(s, null)[0]!.code).toBe("sem-regra-homologada");
  });
  it("nenhum dia de fotografia é presumido fora da regra", () => {
    expect(assembleMapSnapshot(inp({ competence: { schoolId: "A", year: 2027, month: 5 } })).snapshotDate).toBeNull();
  });
});

describe("T ano operacional", () => {
  it("2026 histórico e 2027 sem estado não viram operação", () => {
    for (const ys of ["historico-importado", "sem-estado", null]) {
      const s = assembleMapSnapshot(inp({ yearState: ys }));
      expect(officializationBlocks(s, rule())[0]!.code).toBe("ano-nao-operacional");
    }
    expect(officializationBlocks(assembleMapSnapshot(inp()), rule())).toEqual([]);
  });
});

describe("T matrícula do mês anterior", () => {
  it("primeiro mês sem predecessor não inventa valor (nem zero)", () => {
    const x = c(assembleMapSnapshot(inp()), "matricula-mes-anterior");
    expect(x.state).toBe("ausente"); expect(x.value).toBeNull(); expect(x.origin).toBe("herdado");
  });
  it("vem travada do snapshot oficial anterior, mesmo que o dado vivo mude", () => {
    const march = assembleMapSnapshot(inp({ competence: { schoolId: "A", year: 2027, month: 3 } }));
    expect(c(march, "matricula").value).toBe(2);
    const prev = { versionId: "v1", version: 1, competenceKey: "2027-03", snapshot: march };
    const april = assembleMapSnapshot(inp({ previousOfficial: prev, facts: episodeFacts([epi("1", "2027-02-01"), epi("2", "2027-02-01"), epi("3", "2027-04-01")] as never) }));
    expect(c(april, "matricula-mes-anterior").value).toBe(2);
    expect(c(april, "matricula").value).toBe(3); // vivo reflete na preparação
    expect(c(april, "matricula-mes-anterior").recordRefs).toEqual(["statistical_map_versions:v1@1"]);
    expect(c(march, "matricula").value).toBe(2); // snapshot anterior não muda
  });
  it("leitura falha ⇒ indeterminado, nunca zero", () => {
    expect(c(assembleMapSnapshot(inp({ previousOfficial: undefined })), "matricula-mes-anterior").state).toBe("indeterminado");
  });
});

describe("T regência e pessoal", () => {
  it("regente só com atribuição docente vigente; lotação não cria regência", () => {
    const none = c(assembleMapSnapshot(inp({ teaching: [] })), "regentes");
    expect(none.state).toBe("ausente"); expect(none.value).toBeNull();
    const yes = c(assembleMapSnapshot(inp({ teaching: [{ classId: "t1", assignmentId: "a", versionId: "av", version: 1, personId: "p", componentLabel: "Língua Portuguesa", state: "vigente" }] })), "regentes");
    expect(yes.state).toBe("disponivel"); expect(yes.recordRefs).toEqual(["teaching_assignment_versions:av@1"]);
    const ended = c(assembleMapSnapshot(inp({ teaching: [{ classId: "t1", assignmentId: "a", versionId: "av", version: 1, personId: "p", componentLabel: null, state: "encerrada" }] })), "regentes");
    expect(ended.state).toBe("ausente");
  });
  it("jornada profissional sem fonte nunca é inventada", () => {
    const j = c(assembleMapSnapshot(inp()), "jornada-profissional");
    expect(j.state).toBe("sem-fonte"); expect(j.value).toBeNull();
  });
});

describe("T exportação", () => {
  it("CSV sai das mesmas células, sem recálculo, e ausência não vira zero", () => {
    const s = assembleMapSnapshot(inp());
    const rows = mapaEscolaRows(s.cells);
    expect(rows).toHaveLength(s.cells.length);
    const csv = toCsv(runReport(MAPA_ESTATISTICO_ESCOLA, { params: { competence: "2027-04", status: "x" } }, rows), { headerLines: ["P"], title: "T" });
    expect(csv).toContain("Matrícula do mês anterior");
    expect(rows.find((r) => r.label === "Matrícula do mês anterior")!.value).toBeNull();
    expect(snapshotFingerprint(s)).toBe(snapshotFingerprint(assembleMapSnapshot(inp())));
  });
});

describe("T garantias no banco e no servidor (inspeção)", () => {
  const fns = readFileSync("src/features/statistical-map/statistical-map.functions.ts", "utf8");
  const m119 = readFileSync("drizzle/migrations/0119_t_map_2027_rule_writers_session.sql", "utf8");
  const m121 = readFileSync("drizzle/migrations/0121_t_map_rule_guard_transition.sql", "utf8");
  it("servidor não usa service_role nem _actor para atos humanos", () => {
    expect(fns).not.toMatch(/supabaseAdmin|client\.server|_actor/);
    expect(fns).toContain("applicable_map_rule_for_school");
  });
  it("rascunho só transita para homologada sem mudar definição; homologada imutável", () => {
    expect(m121).toMatch(/NEW\.definition IS DISTINCT FROM OLD\.definition/);
    expect(m121).toMatch(/OLD\.status = 'homologada'/);
  });
  it("writers por sessão exigem ano operacional e revogam DML direto", () => {
    expect(m119).toMatch(/map_year_state_on/);
    expect(m119).toMatch(/REVOKE/i);
    expect(m119).not.toMatch(/GRANT[^;]*TO\s+anon/i);
  });
});
