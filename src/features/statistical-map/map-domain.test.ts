/** 14.10 — Mapa Estatístico: regra, montagem, conferência, oficialização e correção. */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import {
  assembleMapSnapshot, officializationBlocks, projectMapStatus, resolveSnapshotDate, snapshotFingerprint,
  type AssemblyInput, type MapCompetenceRule, type MapEvent, type MapVersionRow,
} from "./map-domain";
import { classOfferingFacts, enrollmentFacts, episodeFacts } from "@/features/ciece/fact-adapters";
import type { IndicatorDefinition } from "@/features/ciece/indicator-engine";
import type { SchoolUnit } from "@/features/schools/school-registry";

const def = (o: Partial<IndicatorDefinition> = {}): IndicatorDefinition => ({
  id: "mapa-matricula", version: 1, label: "Matrícula na data", status: "homologada", factTypeId: "episodio-de-enturmacao", subjectKey: "studentId",
  populationCriteria: {}, temporal: { kind: "fotografia" }, operation: { evaluatorId: "contagem", params: {} }, coverage: "parcial", unit: "estudantes", ...o,
});
const rule = (o: Partial<MapCompetenceRule> = {}): MapCompetenceRule => ({
  id: "regra-prova", version: 1, status: "homologada", homologationActRef: "ato-prova", validFrom: "2026-01-01", validUntil: null,
  definition: { snapshotDate: { kind: "dia-do-mes", day: 15 }, cells: [{ cellId: "matricula", sectionId: "turmas", label: "Matrícula", definition: def() }], blockingCellIds: ["matricula"] }, ...o,
});
const school = (id: string, name = "Escola"): SchoolUnit => ({
  schoolId: id, identifiers: [{ schoolId: id, kind: "inep", value: "33094756" }],
  versions: [{ id: `${id}-v1`, schoolId: id, versionNumber: 1, supersedesVersionId: null, officialName: name, address: null, district: "Centro", locationKind: "urbana", active: true, validFrom: "2020-01-01", originatingActRef: null }],
});
const epi = (id: string, school: string, from: string, ended: string | null = null) => ({ id, enrollment_id: `m-${id}`, student_id: `s-${id}`, school_id: school, class_id: "t1", class_label_snapshot: null, cycle_id: "c26", valid_from: from, originating_act_ref: null, supersedes_id: null, correction_reason: null, created_at: "t", ended_on: ended });
const input = (o: Partial<AssemblyInput> = {}): AssemblyInput => ({
  competence: { schoolId: "e1", year: 2026, month: 4 }, rule: rule(), schools: [school("e1"), school("e2")], classes: [{ id: "t1", name: "600" }],
  facts: episodeFacts([epi("a", "e1", "2026-02-01"), epi("b", "e1", "2026-04-20"), epi("c", "e2", "2026-02-01")] as never),
  observations: { text: "", eventId: null }, ...o,
});
const cell = (s: ReturnType<typeof assembleMapSnapshot>, id: string) => s.cells.find((c) => c.cellId === id)!;

describe("14.10.1 regra de competência", () => {
  it("regra ausente: sem data, sem regra, e não oficializável", () => {
    const s = assembleMapSnapshot(input({ rule: null }));
    expect(s.snapshotDate).toBeNull();
    expect(s.rule).toBeNull();
    expect(cell(s, "inep").state).toBe("indeterminado");
    expect(officializationBlocks(s, null)[0]!.code).toBe("sem-regra-homologada");
    expect(resolveSnapshotDate(rule({ status: "rascunho" }), { year: 2026, month: 4 })).toBeNull();
  });
  it("fotografia na data correta da regra", () => {
    expect(resolveSnapshotDate(rule(), { year: 2026, month: 4 })).toBe("2026-04-15");
    expect(resolveSnapshotDate(rule({ definition: { ...rule().definition, snapshotDate: { kind: "ultimo-dia-do-mes" } } }), { year: 2026, month: 2 })).toBe("2026-02-28");
    const s = assembleMapSnapshot(input());
    expect(cell(s, "matricula").value).toBe(1); // "b" entra em 20/04, depois da fotografia
  });
});

describe("14.10.3/4 montagem", () => {
  it("duas escolas na mesma competência não se misturam", () => {
    expect(cell(assembleMapSnapshot(input()), "matricula").value).toBe(1);
    expect(cell(assembleMapSnapshot(input({ competence: { schoolId: "e2", year: 2026, month: 4 } })), "matricula").value).toBe(1);
    expect(cell(assembleMapSnapshot(input({ competence: { schoolId: "e2", year: 2026, month: 4 } })), "nome-oficial").recordRefs[0]).toContain("e2-v1");
  });
  it("zero observado ≠ ausente ≠ indeterminado ≠ sem fonte", () => {
    const zero = cell(assembleMapSnapshot(input({ facts: [] })), "matricula");
    expect(zero).toMatchObject({ state: "disponivel", value: 0 });
    expect(cell(assembleMapSnapshot(input()), "endereco")).toMatchObject({ state: "ausente", value: null });
    expect(cell(assembleMapSnapshot(input({ rule: null })), "endereco").state).toBe("indeterminado");
    expect(cell(assembleMapSnapshot(input()), "telefone")).toMatchObject({ state: "sem-fonte", origin: "sem-fonte", notes: ["Informação ainda sem fonte institucional no SIGEM."] });
  });
  it("proveniência completa em célula calculada e automática", () => {
    const s = assembleMapSnapshot(input());
    expect(cell(s, "matricula")).toMatchObject({ ruleRef: "mapa-matricula@1", reference: { at: "2026-04-15" }, recordRefs: ["class_enrollment_episodes:a"] });
    expect(cell(s, "inep")).toMatchObject({ value: "33094756", source: "institutional_school_identifiers", recordRefs: ["institutional_school_record_versions:e1-v1@1"] });
  });
  it("turma usa a classificação oficial vigente na data, nunca campo legado", () => {
    const off = classOfferingFacts([{ id: "o1", class_id: "t1", logical_id: "L", version: 1, supersedes_id: null, valid_from: "2026-01-01", valid_until: null, originating_act_ref: null, axes: [{ scheme_id: "modalidade", value_id: "regular", value_version: 1 }] }]);
    expect(cell(assembleMapSnapshot(input({ facts: off })), "turma:t1").value).toBe("modalidade: regular");
  });
});

describe("14.10.6–8 conferência, oficialização e correção", () => {
  const s1 = assembleMapSnapshot(input());
  it("fato alterado entre conferir e oficializar muda a marca (falha fechada)", () => {
    const later = assembleMapSnapshot(input({ facts: episodeFacts([epi("a", "e1", "2026-02-01"), epi("z", "e1", "2026-03-01")] as never) }));
    expect(snapshotFingerprint(s1)).toBe(snapshotFingerprint(assembleMapSnapshot(input())));
    expect(snapshotFingerprint(later)).not.toBe(snapshotFingerprint(s1));
    expect(snapshotFingerprint(assembleMapSnapshot(input({ observations: { text: "x", eventId: "e" } })))).not.toBe(snapshotFingerprint(s1));
  });
  it("mudança real posterior (maio) não altera a fotografia de abril", () => {
    const withMay = assembleMapSnapshot(input({ facts: episodeFacts([epi("a", "e1", "2026-02-01", "2026-05-10"), epi("b", "e1", "2026-04-20"), epi("c", "e2", "2026-02-01")] as never) }));
    expect(cell(withMay, "matricula").value).toBe(1);
  });
  it("situação: preparação → conferido → oficializado → correção v2", () => {
    const ev = (id: string, kind: MapEvent["kind"], at: string, fp: string | null = null): MapEvent => ({ id, kind, recordedAt: at, fingerprint: fp, payload: {} });
    const v1: MapVersionRow = { id: "v1", version: 1, supersedesId: null, conferenceEventId: "c1", fingerprint: "f1", recordedAt: "2026-05-02" };
    const v2: MapVersionRow = { id: "v2", version: 2, supersedesId: "v1", conferenceEventId: "c2", fingerprint: "f2", recordedAt: "2026-06-02" };
    expect(projectMapStatus(false, [], []).id).toBe("nao-aberto");
    expect(projectMapStatus(true, [], []).id).toBe("em-preparacao");
    expect(projectMapStatus(true, [ev("c1", "conferencia", "2026-05-01", "f1")], []).id).toBe("conferido");
    expect(projectMapStatus(true, [ev("c1", "conferencia", "2026-05-01", "f1"), ev("o", "observacoes", "2026-05-01T10")], []).id).toBe("em-preparacao");
    expect(projectMapStatus(true, [ev("c1", "conferencia", "2026-05-01", "f1")], [v1])).toMatchObject({ id: "oficializado", version: 1, corrected: false });
    const both = projectMapStatus(true, [ev("c1", "conferencia", "2026-05-01", "f1"), ev("c2", "conferencia", "2026-06-01", "f2")], [v1, v2]);
    expect(both).toMatchObject({ id: "oficializado", currentVersionId: "v2", corrected: true });
  });
  it("ausência não bloqueia por si; só o que a regra declarar", () => {
    const r = rule({ definition: { ...rule().definition, blockingCellIds: [] } });
    expect(officializationBlocks(assembleMapSnapshot(input({ rule: r })), r)).toEqual([]);
    const r2 = rule({ definition: { ...rule().definition, cells: [{ cellId: "matricula", sectionId: "turmas", label: "Matrícula", definition: def({ status: "rascunho" }) }] } });
    expect(officializationBlocks(assembleMapSnapshot(input({ rule: r2 })), r2)[0]!.code).toBe("celula-exigida-nao-determinada");
  });
});

describe("14.10 garantias no banco e no código (inspeção)", () => {
  const sql = readdirSync("supabase/migrations").map((f) => readFileSync(`supabase/migrations/${f}`, "utf8")).join("\n");
  const m = sql.slice(sql.indexOf("CREATE TABLE public.map_competence_rules"));
  const code = ["map-domain.ts", "statistical-map.functions.ts", "statistical-map-page.tsx"].map((f) => readFileSync(`src/features/statistical-map/${f}`, "utf8")).join("\n");
  it("abertura idempotente e única por escola + competência", () => {
    expect(m).toMatch(/UNIQUE \(school_id, competence_year, competence_month\)/);
    expect(m).toMatch(/IF _id IS NOT NULL THEN RETURN _id; END IF; -- idempotente/);
  });
  it("oficialização imutável, v1 preservada, correção com motivo e base não substituída", () => {
    expect(m).toMatch(/statistical_map_versions_immutable BEFORE UPDATE OR DELETE/);
    expect(m).toMatch(/Correção exige motivo/);
    expect(m).toMatch(/Versão base já substituída/);
    expect(m).toMatch(/Fotografia diferente da conferida/);
  });
  it("sem capacidade, fora da escola ou fora da vigência ⇒ recusa (has_school_capability por escola e data)", () => {
    for (const cap of ["preparar", "conferir", "oficializar", "corrigir"]) expect(m).toMatch(new RegExp(`has_school_capability\\('${cap}-mapa-estatistico'|'${cap}-mapa-estatistico'`));
    expect(sql).toMatch(/e\.valid_from <= _on AND \(e\.valid_until IS NULL OR e\.valid_until >= _on\)/);
  });
  it("campo legado de modalidade removido e nunca lido", () => {
    expect(sql).toMatch(/DROP COLUMN modality_id/);
    expect(readFileSync("src/integrations/supabase/types.ts", "utf8")).not.toMatch(/modality_id/);
    expect(code).not.toMatch(/modality_id|modality_label/);
  });
  it("sem fallback para demonstração e sem campo de digitação de totais ou lacunas", () => {
    expect(code).not.toMatch(/fixture|laborat|demonstra/i);
    expect(code).not.toMatch(/<(input|Input)\b/);
  });
});
