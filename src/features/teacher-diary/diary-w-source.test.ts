import { describe, it, expect } from "vitest";
import { diaryMessage, markAll, unmarkedCount, currentLessons } from "./diary-w-source";

const roster = [{ student_id: "a", display_name: "A", allocation_valid_from: "2027-02-01", allocation_ended_on: null },
  { student_id: "b", display_name: "B", allocation_valid_from: "2027-02-01", allocation_ended_on: null }];
describe("Frente W — Diário", () => {
  it("ausência de marcação nunca vira falta", () => expect(unmarkedCount(roster, {})).toBe(2));
  it("marcar todos é explícito e preserva marcação já feita", () => expect(markAll(roster, "Presente", { b: "Ausente" })).toEqual({ a: "Presente", b: "Ausente" }));
  it("versão vigente é a cabeça da cadeia", () => {
    const v1 = { id: "1", supersedes_version_id: null } as never; const v2 = { id: "2", supersedes_version_id: "1" } as never;
    expect(currentLessons([v1, v2]).map((r: { id: string }) => r.id)).toEqual(["2"]);
  });
  it("preparação explica bloqueio, sem prometer gravação", () => expect(diaryMessage("diary:year-not-operational:em-preparacao")).toMatch(/preparação/));
  it("erro desconhecido diz que nada foi gravado", () => expect(diaryMessage("x")).toMatch(/nada foi gravado/));
});
