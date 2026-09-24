/** 12D.1 — Saneamento estrutural pré-consolidação (regressão). */
import { describe, expect, it } from "vitest";
import { demonstrationPedagogicalAssignments } from "@/features/pedagogical/pedagogical-data";
import {
  demonstrationStudents,
  type DemonstrationStudent,
} from "@/features/students/students-data";
import { createInstrumentStore } from "./assessment-instrument-store";
import { assessmentConfigurations, instrumentFixtures } from "./assessment-fixtures";
import { buildStudentJourney, plural } from "./assessment-student-journey";
import {
  curriculumKey,
  curriculumRefOf,
  recordingReadiness,
  sameCurriculum,
} from "./assessment-rules";
import type { AssessmentConfiguration, AssessmentInstrument } from "./assessment-types";

const quant = assessmentConfigurations.find((c) => c.id === "cfg-2026-quantitativa-demo")!;
const conc = assessmentConfigurations.find((c) => c.id === "cfg-2026-conceitual-demo")!;
const atp1 = demonstrationPedagogicalAssignments.find((a) => a.id === "atp-001")!;
const alu1 = demonstrationStudents.find((s) => s.id === "alu-001")!;

function ins(id: string, over: Partial<AssessmentInstrument> = {}): AssessmentInstrument {
  return {
    ...structuredClone(instrumentFixtures[0]!),
    id,
    title: id,
    ...over,
  };
}
function mkStore(instruments: AssessmentInstrument[]) {
  return createInstrumentStore({ instruments, entries: [] });
}
function source(store: ReturnType<typeof createInstrumentStore>) {
  const s = store.snapshot();
  return {
    instruments: s.instruments,
    entries: s.entries,
    typeLabel: store.typeLabel,
    periodLabel: store.periodLabel,
  };
}
function journey(
  student: DemonstrationStudent,
  store: ReturnType<typeof createInstrumentStore>,
  configurations?: AssessmentConfiguration[],
) {
  const j = buildStudentJourney({
    student,
    contextClassId: "tur-001",
    referenceDate: "2026-03-20",
    source: source(store),
    ...(configurations ? { configurations } : {}),
  });
  if (j.kind !== "instrumentos") throw new Error(j.kind);
  return j;
}

describe("12D.1 — identidade de componente", () => {
  it("renomear o componente não quebra instrumento nem lançamento", () => {
    const renamed = { ...atp1, field: "Linguagens (nome novo)" };
    const i = ins("i1");
    const r = recordingReadiness({
      professionalId: "pro-006",
      assignment: renamed,
      instrument: i,
      period: { start: "2026-02-05", end: "2026-05-15" },
    });
    expect(r.reasons).not.toContain("Componente ou campo diferente da atuação.");
    expect(sameCurriculum(i.curriculumRef, curriculumRefOf(renamed))).toBe(true);
  });

  it("dois componentes diferentes com o mesmo nome continuam distintos", () => {
    const a = { ...atp1, id: "x-1", fieldId: "mat", field: "Mesmo nome" };
    const b = { ...atp1, id: "x-2", fieldId: "cie", field: "Mesmo nome" };
    expect(sameCurriculum(curriculumRefOf(a), curriculumRefOf(b))).toBe(false);
    expect(curriculumKey(curriculumRefOf(a))).not.toBe(curriculumKey(curriculumRefOf(b)));
    const c = { ...atp1, id: "x-3", field: "Mesmo nome" };
    const d = { ...atp1, id: "x-4", field: "Mesmo nome" };
    expect(sameCurriculum(curriculumRefOf(c), curriculumRefOf(d))).toBe(false);
  });

  it("instrumento sem identidade estável não é aceito pelo rótulo", () => {
    const i = ins("i1");
    delete i.curriculumRef;
    const r = recordingReadiness({
      professionalId: "pro-006",
      assignment: atp1,
      instrument: i,
      period: { start: "2026-02-05", end: "2026-05-15" },
    });
    expect(r.ready).toBe(false);
  });

  it("nenhuma chave de identidade é derivada de nome", () => {
    expect(curriculumKey(curriculumRefOf(atp1))).not.toContain(atp1.field!);
  });
});

describe("12D.1 — configuração temporal", () => {
  it("lançamento guarda configuração e versão; mudança de turma não a troca", () => {
    const store = mkStore([ins("i1")]);
    store.saveDraft({
      instrumentId: "i1",
      studentId: "alu-001",
      value: { kind: "numerica", value: 60 },
      configuration: quant,
    });
    const e = store.entries("i1")[0]!;
    expect(e.context?.configurationId).toBe(quant.id);
    expect(e.context?.configurationVersion).toBe(quant.version);
    const moved = structuredClone(alu1);
    moved.enrollments[0]!.academicLinks[0]!.participations[0]!.allocations[0]!.until = "2026-03-15";
    const item = journey(moved, store).periods.flatMap((p) => p.items)[0]!;
    expect(item.configurationId).toBe(quant.id);
    expect(item.configurationVersion).toBe(1);
  });

  it("mudança posterior da configuração não reinterpreta o registro", () => {
    const store = mkStore([ins("i1")]);
    store.saveDraft({
      instrumentId: "i1",
      studentId: "alu-001",
      value: { kind: "numerica", value: 60 },
      configuration: quant,
    });
    store.register("i1");
    const later = assessmentConfigurations.map((c) =>
      c.id === quant.id ? { ...c, version: 2, scales: [] } : c,
    );
    const item = journey(alu1, store, later).periods.flatMap((p) => p.items)[0]!;
    expect(item.configurationChanged).toBe(true);
    expect(item.configurationVersion).toBe(1);
    expect(item.valueLabel).toBe("60");
  });

  it("configurações diferentes coexistem sem conversão", () => {
    const store = mkStore([
      ins("i1"),
      ins("i2", { configurationId: conc.id, appliedOn: "2026-03-11" }),
    ]);
    store.saveDraft({
      instrumentId: "i1",
      studentId: "alu-001",
      value: { kind: "numerica", value: 60 },
      configuration: quant,
    });
    store.saveDraft({
      instrumentId: "i2",
      studentId: "alu-001",
      value: { kind: "conceitual", optionId: "cc-demo-1" },
      configuration: conc,
    });
    store.register("i1");
    store.register("i2");
    const j = journey(alu1, store);
    expect(j.mixedConfigurations).toBe(true);
    const items = j.periods.flatMap((p) => p.items);
    expect(items.map((i) => i.valueLabel).sort()).toEqual(["60", "Conceito demonstrativo 1"]);
    expect(items.find((i) => i.instrumentId === "i2")!.entry!.value.kind).toBe("conceitual");
  });
});

describe("12D.1 — autoria, prazo, 2026, cálculo", () => {
  it("correção preserva autor, data, justificativa e valor anterior", () => {
    const store = mkStore([ins("i1")]);
    store.saveDraft({
      instrumentId: "i1",
      studentId: "alu-001",
      value: { kind: "numerica", value: 60 },
      configuration: quant,
    });
    store.register("i1");
    const before = store.entries("i1")[0]!;
    expect(before.author?.displayName).toBe("Profissional Fictício Fábio Ribeiro");
    store.correct({
      entryId: before.id,
      value: { kind: "numerica", value: 70 },
      justification: "Revisão da prova",
      configuration: quant,
      correctedBy: { professionalId: "pro-001", pedagogicalAssignmentId: "atp-001" },
    });
    const after = store.entries("i1")[0]!;
    const rev = after.history![0]!;
    expect(rev.value).toEqual({ kind: "numerica", value: 60 });
    expect(rev.valueLabel).toBe("60");
    expect(rev.justification).toBe("Revisão da prova");
    expect(rev.correctedBy?.professionalId).toBe("pro-001");
    expect(rev.correctedBy?.displayName).toBeTruthy();
    expect(rev.replacedAt).toBeTruthy();
    expect(after.author).toEqual(before.author);
    expect(after.context).toEqual(before.context);
  });

  it("ausência de prazo não gera estado atrasado", () => {
    const store = mkStore([ins("i1", { appliedOn: "2026-02-10" })]);
    const j = buildStudentJourney({
      student: alu1,
      contextClassId: "tur-001",
      referenceDate: "2026-12-30",
      source: source(store),
    });
    const text = JSON.stringify(j);
    expect(text).not.toMatch(/atrasad|prazo|vencid|overdue|late/i);
    if (j.kind === "instrumentos")
      expect(j.periods.flatMap((p) => p.items)[0]!.state).toBe("em-aberto");
  });

  it("2026 permanece explicitamente não oficial", () => {
    const store = mkStore([ins("i1")]);
    const j = journey(alu1, store);
    expect(j.hasUnofficial).toBe(true);
    expect(j.periods.flatMap((p) => p.items).every((i) => !i.official)).toBe(true);
    expect(
      instrumentFixtures.every(
        (i) => i.periodSource === "legado-demonstrativo" && !i.calendarPeriodId,
      ),
    ).toBe(true);
  });

  it("concordância singular/plural dos contadores", () => {
    expect(plural(1, "registrado", "registrados")).toBe("registrado");
    expect(plural(0, "registrado", "registrados")).toBe("registrados");
    expect(plural(2, "não elegível", "não elegíveis")).toBe("não elegíveis");
  });

  it("nenhuma média, recuperação, aprovação ou consolidação foi introduzida", async () => {
    const fs = await import("node:fs");
    const clean = (f: string) =>
      fs
        .readFileSync(`src/features/assessment/${f}`, "utf8")
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")
        .replace(/"[^"\n]*"|`[^`]*`/g, '""');
    const pure = [
      "assessment-student-journey.ts",
      "assessment-instruments.ts",
      "assessment-rules.ts",
    ]
      .map(clean)
      .join("\n");
    expect(pure).not.toMatch(
      /\.reduce\(|Math\.(round|floor|ceil)|\b(average|mean|weight|recovery|approve|consolidate)\w*\s*\(/i,
    );
    // 12E: a tela apenas delega ao motor configurável; não faz aritmética própria.
    expect(clean("assessment-student-journey-pages.tsx")).not.toMatch(
      /\.reduce\(|Math\.(round|floor|ceil)|\b(average|mean|weight|recovery|approve)\w*\s*\(/i,
    );
  });
});

