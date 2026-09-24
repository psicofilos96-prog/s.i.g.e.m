import { describe, expect, it } from "vitest";
import {
  demonstrationStudents,
  type DemonstrationStudent,
} from "@/features/students/students-data";
import { createInstrumentStore } from "./assessment-instrument-store";
import { assessmentConfigurations } from "./assessment-fixtures";
import * as journeyModule from "./assessment-student-journey";
import { buildStudentJourney, classifyItem } from "./assessment-student-journey";
import { studentPlacements } from "./assessment-rules";
import type { AssessmentInstrument } from "./assessment-types";

const cfg = assessmentConfigurations.find((c) => c.id === "cfg-2026-quantitativa-demo")!;
const base = demonstrationStudents.find((s) => s.id === "alu-001")!;

/** Aluno fictício derivado com duas alocações em turmas diferentes no ano. */
function mover(): DemonstrationStudent {
  const s = structuredClone(base);
  const part = s.enrollments[0]!.academicLinks[0]!.participations[0]!;
  const a1 = part.allocations[0]!;
  a1.until = "2026-04-30";
  part.allocations.push({
    ...structuredClone(a1),
    id: "mov-a2",
    classId: "tur-002",
    from: "2026-05-01",
    until: null,
  });
  return s;
}

function ins(
  id: string,
  classId: string,
  appliedOn: string,
  over: Partial<AssessmentInstrument> = {},
): AssessmentInstrument {
  return {
    id,
    configurationId: cfg.id,
    periodId: appliedOn < "2026-05-16" ? "pa-2026-a1" : "pa-2026-a2",
    pedagogicalAssignmentId: "atp-001",
    classId,
    instrumentTypeId: "it-atividade",
    title: id,
    appliedOn,
    periodSource: "legado-demonstrativo",
    status: "aplicado",
    professionalId: "pro-006",
    snapshot: {
      classLabel: classId,
      fieldLabel: "Componente curricular demonstrativo — Linguagens",
    },
    ...over,
  };
}

function src(store: ReturnType<typeof createInstrumentStore>) {
  const s = store.snapshot();
  return {
    instruments: s.instruments,
    entries: s.entries,
    typeLabel: store.typeLabel,
    periodLabel: store.periodLabel,
  };
}

describe("12D — percurso avaliativo por aluno", () => {
  it("classifica elegível sem lançamento como pendente; saída anterior como não elegível", () => {
    const pl = studentPlacements(mover());
    expect(classifyItem(ins("x", "tur-001", "2026-03-10"), pl, undefined).state).toBe("em-aberto");
    const out = classifyItem(ins("y", "tur-001", "2026-06-10"), pl, undefined);
    expect(out.state).toBe("nao-elegivel");
    expect(out.ineligibility?.reason).toBe("saida-anterior");
    const before = classifyItem(ins("z", "tur-002", "2026-03-10"), pl, undefined);
    expect(before.ineligibility?.reason).toBe("ingresso-posterior");
    expect(
      classifyItem(ins("p", "tur-001", "2026-03-10", { status: "planejado" }), pl, undefined).state,
    ).toBe("planejado");
  });

  it("mantém registros de turmas diferentes no ano sem perda e ignora a colocação atual", () => {
    const store = createInstrumentStore({
      instruments: [
        ins("i-a", "tur-001", "2026-03-10"),
        ins("i-b", "tur-002", "2026-06-10"),
        ins("i-c", "tur-001", "2026-06-11"),
      ],
      entries: [],
    });
    const j = buildStudentJourney({
      student: mover(),
      contextClassId: "tur-001",
      referenceDate: "2026-09-01",
      source: src(store),
    });
    if (j.kind !== "instrumentos") throw new Error(j.kind);
    const items = j.periods.flatMap((p) => p.items);
    expect(items.find((i) => i.instrumentId === "i-a")!.classId).toBe("tur-001");
    expect(items.find((i) => i.instrumentId === "i-b")!.classId).toBe("tur-002");
    expect(j.placementAtReference?.classId).toBe("tur-002");
    // i-c aplicado na turma anterior após a saída: nunca pendência
    expect(items.find((i) => i.instrumentId === "i-c")!.state).toBe("nao-elegivel");
    expect(j.totals["em-aberto"]).toBe(2);
    expect(j.totals["nao-elegivel"]).toBe(1);
  });

  it("não registrado com motivo não é pendência; correção preserva snapshot e versões", () => {
    const store = createInstrumentStore({
      instruments: [ins("i-a", "tur-001", "2026-03-10"), ins("i-b", "tur-001", "2026-03-12")],
      entries: [],
    });
    const s = mover();
    const save = (id: string, value: Parameters<typeof store.saveDraft>[0]["value"]) => {
      // saveDraft usa os alunos de demonstração; alu-001 está em tur-001 nessas datas
      expect(
        store.saveDraft({ instrumentId: id, studentId: s.id, value, configuration: cfg }).ok,
      ).toBe(true);
    };
    save("i-a", { kind: "numerica", value: 70 });
    save("i-b", { kind: "nao-registrado", reason: "Atestado apresentado" });
    store.register("i-a");
    store.register("i-b");
    const original = structuredClone(store.entries("i-a")[0]!.context);
    const r = store.correct({
      entryId: store.entries("i-a")[0]!.id,
      value: { kind: "numerica", value: 80 },
      justification: "Erro de digitação",
      configuration: cfg,
    });
    expect(r.ok).toBe(true);
    const j = buildStudentJourney({
      student: s,
      contextClassId: "tur-001",
      referenceDate: "2026-03-20",
      source: src(store),
    });
    if (j.kind !== "instrumentos") throw new Error(j.kind);
    const [a, b] = j.periods[0]!.items;
    expect(a!.state).toBe("registrado");
    expect(a!.corrected).toBe(true);
    expect(a!.entry!.history![0]!.value).toEqual({ kind: "numerica", value: 70 });
    expect(a!.entry!.context).toEqual(original);
    expect(b!.state).toBe("nao-registrado");
    expect(j.totals["em-aberto"]).toBe(0);
  });

  it("renomeação posterior não altera a leitura histórica", () => {
    const store = createInstrumentStore({
      instruments: [ins("i-a", "tur-001", "2026-03-10")],
      entries: [],
    });
    store.saveDraft({
      instrumentId: "i-a",
      studentId: "alu-001",
      value: { kind: "numerica", value: 50 },
      configuration: cfg,
    });
    const source = {
      ...src(store),
      typeLabel: () => "Tipo renomeado",
      periodLabel: () => "Período renomeado",
    };
    const j = buildStudentJourney({
      student: base,
      contextClassId: "tur-001",
      referenceDate: "2026-03-20",
      source,
    });
    if (j.kind !== "instrumentos") throw new Error(j.kind);
    const item = j.periods[0]!.items[0]!;
    expect(item.historical.periodLabel).not.toBe("Período renomeado");
    expect(item.historical.typeLabel).not.toBe("Tipo renomeado");
    expect(item.current.typeLabel).toBe("Tipo renomeado");
  });

  it("aluno transferido: períodos posteriores são encerramento de percurso", () => {
    const s = structuredClone(base);
    s.enrollments.forEach((e) =>
      e.academicLinks.forEach((l) =>
        l.participations.forEach((p) => p.allocations.forEach((a) => (a.until = "2026-04-30"))),
      ),
    );
    const store = createInstrumentStore({
      instruments: [ins("i-z", "tur-001", "2026-10-01", { periodId: "pa-2026-a3" })],
      entries: [],
    });
    const j = buildStudentJourney({
      student: s,
      contextClassId: "tur-001",
      referenceDate: "2026-10-05",
      source: src(store),
    });
    if (j.kind !== "instrumentos") throw new Error(j.kind);
    expect(j.periods.find((p) => p.periodId === "pa-2026-a3")!.pathClosed).toBe(true);
    expect(j.totals["em-aberto"]).toBe(0);
  });

  it("Educação Infantil usa registros pedagógicos, sem instrumentos, notas ou conceitos", () => {
    const child = demonstrationStudents.find((s) =>
      studentPlacements(s).some((p) => p.classId === "tur-009"),
    )!;
    const store = createInstrumentStore();
    const j = buildStudentJourney({
      student: child,
      contextClassId: "tur-009",
      referenceDate: "2026-09-01",
      source: src(store),
    });
    expect(j.kind).toBe("acompanhamento");
    expect(JSON.stringify(j)).not.toMatch(/"(value|optionId|periods|totals)"/);
  });

  it("projeção é somente leitura: não altera o estado e não expõe escrita", () => {
    const store = createInstrumentStore();
    const before = structuredClone(store.snapshot());
    const j = buildStudentJourney({
      student: base,
      contextClassId: "tur-001",
      referenceDate: "2026-03-20",
      source: src(store),
    });
    expect(store.snapshot()).toEqual(before);
    const hasFn = (v: unknown): boolean =>
      typeof v === "function" || (!!v && typeof v === "object" && Object.values(v).some(hasFn));
    expect(hasFn(j)).toBe(false);
    const names = Object.keys(journeyModule).join(" ");
    expect(names).not.toMatch(/save|register|correct|create|update|delete|set[A-Z]/i);
  });

  it("não introduz cálculo ou inferência de resultado", async () => {
    const fs = await import("node:fs");
    const code = ["assessment-student-journey.ts", "assessment-student-journey-pages.tsx"]
      .map((f) =>
        fs
          .readFileSync(`src/features/assessment/${f}`, "utf8")
          .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""),
      )
      .join("\n");
    expect(code).not.toMatch(
      /\.reduce\(|Math\.(round|floor|ceil)|\b(average|mean|weight|sum|approve|standing)\w*\s*\(|academicStanding|deriveResult/i,
    );
  });
});
