/** Etapa 12C — instrumentos e lançamentos. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assessmentStructureFromCalendar } from "@/features/calendar/calendar-assessment-link";
import { demoActors } from "@/features/calendar/calendar-fixtures";
import { createInMemoryCalendarRepository } from "@/features/calendar/calendar-store";
import { demonstrationPedagogicalAssignments } from "@/features/pedagogical/pedagogical-data";
import {
  demonstrationStudents,
  type DemonstrationStudent,
} from "@/features/students/students-data";
import { assessmentConfigurations, instrumentTypes, periodStructures } from "./assessment-fixtures";
import {
  buildInstrument,
  correctEntry,
  draftEntry,
  entryValueLabel,
  instrumentFlowAvailable,
  instrumentRoster,
  registerEntries,
  resolveInstrumentPeriod,
} from "./assessment-instruments";
import { createInstrumentStore } from "./assessment-instrument-store";
import { deriveResult } from "./assessment-rules";
import type { AssessmentConfiguration, AssessmentInstrument } from "./assessment-types";

const cfg = (id: string) => assessmentConfigurations.find((c) => c.id === id)!;
const quant = cfg("cfg-2026-quantitativa-demo");
const ei = cfg("cfg-2026-ei-acompanhamento");
const conceptual = assessmentConfigurations.find((c) =>
  c.scales.some((s) => s.kind === "conceitual"),
)!;
const legacy = periodStructures.find((s) => s.id === "est-2026-a")!;
const atp = demonstrationPedagogicalAssignments.find((a) => a.id === "atp-001")!;
const NOW = "2026-09-24T12:00:00.000Z";

function build(
  input: Partial<{ title: string; instrumentTypeId: string; appliedOn: string }> = {},
  c: AssessmentConfiguration = quant,
) {
  return buildInstrument({
    id: "ins-t",
    input: { title: "Leitura", instrumentTypeId: "it-prova", appliedOn: "2026-03-10", ...input },
    configuration: c,
    structure: legacy,
    assignment: atp,
    professionalId: atp.professionalId,
    classId: "tur-001",
    now: NOW,
  });
}
function applied(): AssessmentInstrument {
  const r = build();
  if (!r.ok) throw new Error(r.reasons.join());
  return { ...r.value, status: "aplicado" };
}
const roster = (i: AssessmentInstrument, s = demonstrationStudents) => instrumentRoster(i, s);

describe("instrumento", () => {
  it("genérico: sem peso, pontuação máxima, média ou quantidade mínima", () => {
    const r = build();
    expect(r.ok).toBe(true);
    const keys = Object.keys(r.ok ? r.value : {});
    for (const k of ["weight", "peso", "maxScore", "average", "media", "minimum", "contributes"])
      expect(keys).not.toContain(k);
  });
  it("período derivado da data; legado 2026 marcado como não oficial", () => {
    const r = build({ appliedOn: "2026-06-01" });
    if (!r.ok) throw new Error();
    expect(r.value.periodId).toBe("pa-2026-a2");
    expect(r.value.periodSource).toBe("legado-demonstrativo");
    expect(r.value.status).toBe("planejado");
  });
  it("data fora de período é bloqueada", () => {
    const r = build({ appliedOn: "2026-09-06" });
    expect(r.ok).toBe(false);
  });
  it("tipo não admitido pela configuração é recusado", () => {
    expect(build({ instrumentTypeId: "it-pratica" }).ok).toBe(false);
  });
  it("título vazio e atuação fora da vigência", () => {
    expect(build({ title: " " }).ok).toBe(false);
    expect(build({ appliedOn: "2025-03-10" }).ok).toBe(false);
  });
  it("EI fica fora do fluxo pela configuração, não pelo nome da etapa", () => {
    expect(instrumentFlowAvailable(ei)).toBe(false);
    const renamed = { ...quant, label: "Educação Infantil (rótulo)" };
    expect(instrumentFlowAvailable(renamed)).toBe(true);
    expect(build({}, ei).ok).toBe(false);
  });
});

describe("calendário homologado como fonte canônica", () => {
  const repo = createInMemoryCalendarRepository();
  const structure = assessmentStructureFromCalendar(repo.get("cal-rede-2027-regular")!);
  it("calendário em rascunho não fornece período oficial", () => {
    const r = resolveInstrumentPeriod(structure, "2027-03-10", repo);
    expect(r.ok).toBe(false);
  });
  it("após homologação, período e calendarPeriodId vêm do calendário", () => {
    repo.transition("cal-rede-2027-regular", demoActors.supervisao, "enviar-revisao");
    repo.transition("cal-rede-2027-regular", demoActors.supervisao, "homologar", {
      confirmCritical: true,
    });
    const r = resolveInstrumentPeriod(structure, "2027-06-01", repo);
    expect(r.ok && [r.period.calendarPeriodId, r.source, r.official]).toEqual([
      "per-2027-reg-2",
      "calendario-homologado",
      true,
    ]);
    expect(resolveInstrumentPeriod(structure, "2027-09-11", repo).ok).toBe(false);
  });
});

describe("pauta", () => {
  it("elegíveis na data recebem campo; ingresso posterior e saída anterior são informativos", () => {
    const base = roster(applied()).eligible[0]!.student;
    const clone = (id: string, from: string, until: string | null): DemonstrationStudent => {
      const s = structuredClone(base);
      s.id = id;
      s.personName = `Aluno ${id}`;
      s.enrollments.forEach((e) =>
        e.academicLinks.forEach((l) =>
          l.participations.forEach((p) => {
            p.allocations = p.allocations
              .filter((a) => a.classId === "tur-001")
              .map((a) => ({ ...a, from, until }));
          }),
        ),
      );
      return s;
    };
    const r = roster(applied(), [
      base,
      clone("late", "2026-04-01", null),
      clone("gone", "2026-02-01", "2026-03-01"),
    ]);
    expect(r.eligible.map((e) => e.student.id)).toEqual([base.id]);
    expect(r.informative.map((i) => [i.student.id, i.reason])).toEqual([
      ["gone", "saida-anterior"],
      ["late", "ingresso-posterior"],
    ]);
  });
});

describe("lançamentos", () => {
  const inst = applied();
  const row = roster(inst).eligible[0]!;
  const draft = (value: Parameters<typeof draftEntry>[0]["value"], c = quant) =>
    draftEntry({
      instrument: inst,
      configuration: c,
      eligible: row,
      value,
      now: NOW,
      periodLabel: "P1",
      instrumentTypeLabel: "Prova",
    });

  it("pauta só abre com instrumento aplicado (ciclo separado dos lançamentos)", () => {
    const planned = { ...inst, status: "planejado" as const };
    expect(
      draftEntry({
        instrument: planned,
        configuration: quant,
        eligible: row,
        value: { kind: "numerica", value: 5 },
        now: NOW,
        periodLabel: "P",
        instrumentTypeLabel: "T",
      }).ok,
    ).toBe(false);
  });
  it("escala numérica valida limites da configuração", () => {
    expect(draft({ kind: "numerica", value: 80 }).ok).toBe(true);
    expect(draft({ kind: "numerica", value: 101 }).ok).toBe(false);
  });
  it("escala conceitual e descritiva", () => {
    const sc = conceptual.scales.find((s) => s.kind === "conceitual");
    if (sc?.kind !== "conceitual") throw new Error();
    expect(draft({ kind: "conceitual", optionId: sc.options[0]!.id }, conceptual).ok).toBe(true);
    expect(draft({ kind: "conceitual", optionId: "x" }, conceptual).ok).toBe(false);
    expect(draft({ kind: "descritiva", text: "ok" }).ok).toBe(false);
  });
  it("não registrado exige motivo e nunca vira 0", () => {
    expect(draft({ kind: "nao-registrado", reason: "" }).ok).toBe(false);
    const r = draft({ kind: "nao-registrado", reason: "Atestado" });
    if (!r.ok) throw new Error();
    expect(r.value.value).toEqual({ kind: "nao-registrado", reason: "Atestado" });
    expect(JSON.stringify(r.value.value)).not.toMatch(/"value":\s*0/);
    expect(entryValueLabel(r.value.value)).toBe("Não registrado — Atestado");
    expect(deriveResult(quant, [r.value], "instrumento")).toMatchObject({
      status: "sem-regra-homologada",
      official: false,
    });
  });
  it("registrar afeta só os selecionados; registrado exige correção justificada", () => {
    const a = draft({ kind: "numerica", value: 70 });
    if (!a.ok) throw new Error();
    const [reg] = registerEntries([a.value], [a.value.id], NOW);
    expect(reg!.status).toBe("registrado");
    expect(
      draftEntry({
        instrument: inst,
        configuration: quant,
        eligible: row,
        value: { kind: "numerica", value: 1 },
        now: NOW,
        existing: reg!,
        periodLabel: "P",
        instrumentTypeLabel: "T",
      }).ok,
    ).toBe(false);
    expect(
      correctEntry({
        entry: reg!,
        configuration: quant,
        value: { kind: "numerica", value: 75 },
        justification: "",
        now: NOW,
      }).ok,
    ).toBe(false);
    const c = correctEntry({
      entry: reg!,
      configuration: quant,
      value: { kind: "numerica", value: 75 },
      justification: "Erro de digitação",
      now: NOW,
    });
    if (!c.ok) throw new Error();
    expect(c.value.value).toEqual({ kind: "numerica", value: 75 });
    expect(c.value.history).toEqual([
      expect.objectContaining({
        value: { kind: "numerica", value: 70 },
        justification: "Erro de digitação",
      }),
    ]);
  });
  it("contexto histórico preservado", () => {
    const r = draft({ kind: "numerica", value: 50 });
    if (!r.ok) throw new Error();
    expect(r.value.context).toMatchObject({
      classId: "tur-001",
      pedagogicalAssignmentId: "atp-001",
      periodId: "pa-2026-a1",
      appliedOn: "2026-03-10",
      periodSource: "legado-demonstrativo",
      studentName: row.student.personName,
    });
  });
});

describe("imutabilidade retrospectiva (store)", () => {
  it("movimentação do aluno, renomeação de período/tipo e mudança de contexto não reescrevem o lançamento", () => {
    const store = createInstrumentStore({ instruments: [] });
    const created = store.create({
      input: { title: "Prova 1", instrumentTypeId: "it-prova", appliedOn: "2026-03-10" },
      configuration: quant,
      structureId: legacy.id,
      assignmentId: "atp-001",
      professionalId: atp.professionalId,
      classId: "tur-001",
    });
    if (!created.ok) throw new Error(created.reasons.join());
    store.apply(created.value.id);
    const student = roster(created.value).eligible[0]!.student;
    const s = store.saveDraft({
      instrumentId: created.value.id,
      studentId: student.id,
      value: { kind: "numerica", value: 60 },
      configuration: quant,
    });
    if (!s.ok) throw new Error(s.reasons.join());
    store.register(created.value.id);
    const before = structuredClone(store.entries(created.value.id)[0]!);

    const oldPeriodLabel = legacy.periods[0]!.label;
    const oldTypeLabel = instrumentTypes.find((t) => t.id === "it-prova")!.label;
    const oldAllocs = student.enrollments.map((e) => structuredClone(e));
    try {
      legacy.periods[0]!.label = "Etapa renomeada";
      instrumentTypes.find((t) => t.id === "it-prova")!.label = "Tipo renomeado";
      student.enrollments.forEach((e) =>
        e.academicLinks.forEach((l) =>
          l.participations.forEach((p) => p.allocations.forEach((a) => (a.until = "2026-03-11"))),
        ),
      );
      const after = store.entries(created.value.id)[0]!;
      expect(after).toEqual(before);
      expect(after.context?.periodLabel).toBe(oldPeriodLabel);
      expect(after.context?.instrumentTypeLabel).toBe(oldTypeLabel);
    } finally {
      legacy.periods[0]!.label = oldPeriodLabel;
      instrumentTypes.find((t) => t.id === "it-prova")!.label = oldTypeLabel;
      student.enrollments = oldAllocs;
    }
  });
  it("aluno fora da pauta não recebe lançamento", () => {
    const store = createInstrumentStore();
    const r = store.saveDraft({
      instrumentId: "ins-demo-001",
      studentId: "inexistente",
      value: { kind: "numerica", value: 1 },
      configuration: quant,
    });
    expect(r.ok).toBe(false);
  });
});

describe("escopo da 12C", () => {
  it("nenhum campo ou cálculo de média, peso, aprovação, recuperação ou resultado", () => {
    for (const f of [
      "assessment-instruments.ts",
      "assessment-instrument-store.ts",
      "assessment-instrument-pages.tsx",
    ]) {
      const src = readFileSync(`${process.cwd()}/src/features/assessment/${f}`, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "")
        .replace(/"[^"\n]*"|`[^`]*`|“[^”]*”/g, '""');
      expect(src).not.toMatch(
        /\b(average|media|weight|peso|approv|aprova|reprova|recupera|finalResult|resultado)\w*\s*[:=(]/i,
      );
      expect(src).not.toMatch(/\.reduce\(\s*\(\s*\w+\s*,\s*\w+\s*\)\s*=>\s*\w+\s*\+\s*\w+\.value/);
    }
  });
});
