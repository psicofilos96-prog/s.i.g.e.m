import { describe, expect, it } from "vitest";
import { GUIDANCE, scheduleFindings, summarize, type IntegrityInput, type OfficialBlock } from "./schedule-integrity";

const b = (o: Partial<OfficialBlock>): OfficialBlock => ({ blockId: "B1", classId: "T1", day: "seg", start: "07:00", end: "07:50", personIds: ["P1"], schoolId: "E1", componentId: "MAT", minutes: 50, ...o });
const base: IntegrityInput = { blocks: [], regencyComponent: () => "MAT", contractualMinutes: () => 1200, unavailability: [], weekOf: "2026-03-02" };
const kinds = (i: IntegrityInput) => scheduleFindings(i).map((x) => x.kind).sort();

describe("integridade dos horários", () => {
  it("docente em duas escolas ao mesmo tempo, com evidência", () => {
    const fs = scheduleFindings({ ...base, blocks: [b({}), b({ blockId: "B2", classId: "T9", schoolId: "E2" })] });
    expect(fs[0]).toMatchObject({ kind: "duas-escolas-mesmo-horario", subject: "P1", evidence: ["B1", "B2"] });
  });
  it("mesma escola ⇒ pessoa-mesmo-horario; turma duplicada", () => {
    expect(kinds({ ...base, blocks: [b({}), b({ blockId: "B2", personIds: ["P2"] })] })).toEqual(["turma-mesmo-horario"]);
    expect(kinds({ ...base, blocks: [b({}), b({ blockId: "B2", classId: "T2" })] })).toEqual(["pessoa-mesmo-horario"]);
  });
  it("jornada excedida e indeterminada", () => {
    expect(kinds({ ...base, contractualMinutes: () => 40, blocks: [b({})] })).toEqual(["jornada-excedida"]);
    expect(kinds({ ...base, contractualMinutes: () => null, blocks: [b({})] })).toEqual(["jornada-indeterminada"]);
  });
  it("componente conflitante, indisponibilidade e aula sem cobertura", () => {
    expect(kinds({ ...base, regencyComponent: () => "POR", blocks: [b({})] })).toEqual(["componente-conflitante"]);
    expect(kinds({ ...base, blocks: [b({})], unavailability: [{ personId: "P1", from: "2026-03-01", until: null, leaveId: "F1", operationalImpact: "total" }] })).toEqual(["aula-durante-indisponibilidade"]);
    expect(kinds({ ...base, blocks: [b({ personIds: [] })] })).toEqual(["aula-sem-cobertura"]);
  });
  it("afastamento parcial não é tratado como indisponível", () => {
    expect(kinds({ ...base, blocks: [b({})], unavailability: [{ personId: "P1", from: "2026-03-01", until: null, leaveId: "F1", operationalImpact: "parcial" }] })).toEqual([]);
  });
  it("todo achado traz orientação e nenhum corrige", () => {
    const fs = scheduleFindings({ ...base, blocks: [b({ personIds: [] })] });
    expect(fs.every((x) => x.guidance === GUIDANCE[x.kind] && x.guidance.length > 0)).toBe(true);
    expect(summarize(fs)).toEqual({ "aula-sem-cobertura": 1 });
  });
});
