import { describe, expect, it } from "vitest";
import { supportByClass } from "./teaching-support";

describe("N10.2.4 — mediação vigente na área do professor", () => {
  const classes = [{ classId: "c1", className: "1º A" }];
  const names: Record<string, string> = { s1: "Ana", s2: "Bia" };
  it("professor relacionado vê só nomes das próprias turmas", () => {
    const r = supportByClass([{ class_id: "c1", student_id: "s1", has_active_mediation: true }, { class_id: "c1", student_id: "s2", has_active_mediation: false }], classes, (id) => names[id] ?? null);
    expect(r).toEqual([{ classId: "c1", className: "1º A", students: ["Ana"] }]);
  });
  it("não relacionado / fora da lista: nada aparece, nem por id", () => {
    expect(supportByClass([{ class_id: "c9", student_id: "s1", has_active_mediation: true }], classes, (id) => names[id] ?? null)).toEqual([]);
    expect(supportByClass([{ class_id: "c1", student_id: "sx", has_active_mediation: true }], classes, (id) => names[id] ?? null)).toEqual([]);
  });
});
