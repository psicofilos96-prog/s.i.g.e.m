import { describe, it, expect } from "vitest";
import { diaryMessage, markAll, unmarkedCount, changedAspects, currentMarks } from "./diary-w-source";

const roster = [{ student_id: "a", display_name: "A", allocation_valid_from: "2027-02-01", allocation_ended_on: null },
  { student_id: "b", display_name: "B", allocation_valid_from: "2027-02-01", allocation_ended_on: null }];
describe("Frente W — Diário", () => {
  it("ausência de marcação nunca vira falta", () => expect(unmarkedCount(roster, {})).toBe(2));
  it("marcar todos é explícito e preserva marcação já feita", () => expect(markAll(roster, "Presente", { b: "Ausente" })).toEqual({ a: "Presente", b: "Ausente" }));
  it("correção só declara o que mudou", () => {
    const l = { facts: { content: "a", observation: "" }, schedule_block_ids: ["b1"], reference_item_ids: ["r1"] } as never;
    expect(changedAspects(l, { content: "a", observation: "", blocks: ["b1"], references: ["r1"] })).toEqual([]);
    expect(changedAspects(l, { content: "b", observation: "", blocks: ["b1"], references: ["r2"] })).toEqual(["conteudo", "referencias"]);
  });
  it("sem chamada, ninguém está ausente", () => expect(currentMarks({ marks: null } as never)).toEqual({}));
  it("preparação explica bloqueio, sem prometer gravação", () => expect(diaryMessage("diary:year-not-operational:em-preparacao")).toMatch(/preparação/));
  it("erro desconhecido diz que nada foi gravado", () => expect(diaryMessage("x")).toMatch(/nada foi gravado/));
});
