import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { PeriodAttendanceClosingRecord } from "@/features/diary/attendance-closing-types";
import type { PeriodClosingRecord } from "@/features/assessment/period-closing-types";
import type { AcademicStandingRecord } from "@/features/assessment/academic-standing-types";
import { FACT_CATALOG, FUTURE_FAMILIES, catalogDuplicates, validateFact } from "./fact-catalog";
import { engagementFacts, episodeFacts, periodResultFacts, standingFacts, guardFacts } from "./fact-adapters";
import { periodRecordFromRow, standingRecordFromRow, attendanceRecordFromRow } from "./fact-loader";
import { reverseAudit, semanticallyEquivalent } from "./fact-parity";
import { isDimensionAvailable } from "./institutional-dimension-gaps";

function one<T>(xs: readonly T[]): T {
  const x = xs[0];
  if (x === undefined) throw new Error("vazio");
  return x;
}

const standing = (over: Partial<AcademicStandingRecord> = {}): AcademicStandingRecord =>
  ({
    id: "mem-std-1",
    scopeKey: "k",
    version: 1,
    factKind: "situacao-academica-do-ciclo",
    cycleId: "ciclo-2026",
    cycleKindId: "anual",
    academicYearId: "2026",
    studentId: "est-1",
    ruleSetId: "regra-x",
    ruleSetVersion: 2,
    standingId: "sit-a",
    operationalState: "determinada",
    determinedBy: { actorId: "p", at: "2026-12-18T10:00:00Z" },
    determinedAt: "2026-12-18T10:00:00Z",
    deliberationId: "del-1",
    steps: [],
    facts: [],
    pendencies: [],
    ...over,
  }) as unknown as AcademicStandingRecord;

const periodRecord = {
  id: "mem-pc-1",
  version: 1,
  scope: { classId: "t1", academicYearId: "2026", periodId: "p1", curriculumRef: { kind: "matriz", componentId: "lp" } },
  resultKind: "resultado-consolidado-oficial-do-periodo",
  ruleId: "r",
  ruleVersion: 1,
  calendarId: "cal",
  configurationId: "c",
  closedBy: {},
  closedAt: "2026-05-01T00:00:00Z",
  results: [
    {
      studentId: "est-1",
      studentName: "Nome que não deve vazar",
      entryIds: [],
      usedEntryVersions: [{ versionId: "v1", logicalEntryId: "l1", version: 1 }],
      categories: [{ categoryId: "total", label: "Total", value: null, rounded: false }],
    },
  ],
} as unknown as PeriodClosingRecord;

describe("14.1A — catálogo canônico", () => {
  it("uma fonte por tipo de fato", () => {
    expect(catalogDuplicates()).toEqual([]);
    expect(catalogDuplicates([...FACT_CATALOG, one(FACT_CATALOG)])).toEqual([one(FACT_CATALOG).factTypeId]);
  });
  it("cada tipo declara granularidade e semântica temporal", () => {
    for (const d of FACT_CATALOG) {
      expect(d.granularity.length).toBeGreaterThan(0);
      expect(d.temporal).toBeTruthy();
    }
  });
  it("famílias sem fonte ficam como futuras, incluindo Visitas", () => {
    expect(FUTURE_FAMILIES.map((f) => f.familyId)).toEqual(
      expect.arrayContaining(["educacao-especial-aee", "transporte", "alimentacao", "infraestrutura", "censo-educacenso", "registro-institucional-de-visitas"]),
    );
  });
  it("recusa contagem, taxa ou total publicado como fato", () => {
    const fact = one(standingFacts(standing()));
    const bad = { ...fact, dimensions: { ...fact.dimensions, studentsCount: 30 } };
    expect(validateFact(bad, "academic_standing_versions").map((v) => v.code)).toContain("agregacao-como-fato");
    const rate = { ...fact, dimensions: { taxaAprovacao: 0.9 } };
    expect(validateFact(rate, "academic_standing_versions").map((v) => v.code)).toContain("agregacao-como-fato");
  });
  it("recusa fonte não declarada no catálogo", () => {
    const fact = one(standingFacts(standing()));
    expect(validateFact(fact, "cycle_closing_versions").map((v) => v.code)).toContain("fonte-nao-declarada");
  });
});

describe("14.1B — adaptadores", () => {
  it("situação sem determinação é indeterminada e sem conteúdo (nunca zero)", () => {
    const f = one(standingFacts(standing({ standingId: null })));
    expect(f.availability).toBe("indeterminado");
    expect(f.payload).toBeNull();
    expect(validateFact(f, "academic_standing_versions")).toEqual([]);
  });
  it("resultado do período preserva null e não carrega nome do estudante", () => {
    const f = one(periodResultFacts(periodRecord));
    expect(JSON.stringify(f)).not.toContain("Nome que não deve vazar");
    expect(f.payload).toEqual({ kind: "estruturado", data: { categories: [{ categoryId: "total", value: null, rounded: false }] } });
    expect(guardFacts([f], "period_closing_versions").violations).toEqual([]);
  });
  it("vigência só vem da fonte: episódio aberto tem validTo null", () => {
    const f = one(episodeFacts([
      { id: "e1", student_id: "est-1", school_id: "s1", class_id: "t1", cycle_id: null, enrollment_id: "m1", valid_from: "2026-02-01", originating_act_ref: null },
    ]));
    expect(f.temporal).toEqual({ validFrom: "2026-02-01", validTo: null });
    expect(f.temporal.occurredAt).toBeUndefined();
  });
  it("atuação não carrega cargo", () => {
    const f = one(engagementFacts([
      { id: "g1", person_id: "p1", engagement_kind_id: "docencia", school_id: "s1", class_id: "t1", component_id: "lp", period_id: null, valid_from: "2026-02-01", valid_until: null, originating_act_ref: "ato" },
    ]));
    expect(JSON.stringify(f)).not.toMatch(/position|cargo/);
    expect(guardFacts([f], "institutional_engagements").violations).toEqual([]);
  });
});

describe("14.1C — paridade semântica e auditoria inversa", () => {
  it("laboratório e banco produzem fatos semanticamente equivalentes", () => {
    const mem = standingFacts(standing());
    const db = standingFacts(standingRecordFromRow({ id: "uuid-db", version_number: 1, record: standing() }));
    expect(one(mem).provenance.recordId).not.toBe(one(db).provenance.recordId);
    expect(semanticallyEquivalent(mem, db)).toBe(true);
    const memP = periodResultFacts(periodRecord);
    const dbP = periodResultFacts(periodRecordFromRow({ id: "uuid-p", version_number: 1, record: periodRecord }));
    expect(semanticallyEquivalent(memP, dbP)).toBe(true);
  });
  it("mudança factual quebra a equivalência", () => {
    expect(semanticallyEquivalent(standingFacts(standing()), standingFacts(standing({ standingId: "sit-b" })))).toBe(false);
  });
  it("do fato ao registro, versão e regra", () => {
    const f = one(periodResultFacts(periodRecord));
    expect(reverseAudit(f)).toEqual({
      sourceId: "period_closing_versions",
      recordId: "mem-pc-1",
      recordVersion: 1,
      rule: { id: "r", version: 1 },
      upstream: [{ kind: "assessment_entry_version", id: "v1", version: 1 }],
    });
  });
  it("adaptador de frequência reutiliza a identidade do banco", () => {
    const rec = { id: "x", version: 9 } as unknown as PeriodAttendanceClosingRecord;
    expect(attendanceRecordFromRow({ id: "db", version_number: 2, record: rec })).toMatchObject({ id: "db", version: 2 });
  });
});

describe("14.1D — dimensões ausentes não são inventadas", () => {
  it("turno, nascimento, sexo e INEP permanecem indisponíveis", () => {
    for (const d of ["classShift", "studentBirthDate", "studentAdministrativeSex", "schoolInep"]) expect(isDimensionAvailable(d)).toBe(false);
  });
  it("o módulo CIECE não lê fixtures nem demonstrações", () => {
    const dir = join(__dirname);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
      expect(readFileSync(join(dir, file), "utf8")).not.toMatch(/fixtures|demonstration|Demonstration/);
    }
  });
});
