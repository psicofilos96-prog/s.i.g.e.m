import { describe, expect, it } from "vitest";
import { nextStep, processes, stepProblems, type StepRow } from "./reclassification";

const row = (seq: number, step: StepRow["step"]): StepRow => ({ process_id: "p", seq, step, student_id: "s", student_name: "Ana", kind: "avanco", content: "x", outcome: null, recorded_at: "" });

describe("reclassificação", () => {
  it("etapas seguem a ordem e encerram no despacho", () => {
    expect(nextStep(0)).toBe("abertura");
    expect(nextStep(4)).toBe("despacho");
    expect(nextStep(5)).toBeNull();
    expect(processes([row(2, "comissao"), row(1, "abertura")])[0]!.next).toBe("avaliacao");
  });
  it("despacho exige resultado", () => {
    expect(stepProblems("despacho", "texto", null)).toHaveLength(1);
    expect(stepProblems("despacho", "texto", "deferido")).toHaveLength(0);
  });
});
