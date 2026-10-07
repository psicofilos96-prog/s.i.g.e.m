import { describe, expect, it } from "vitest";
import { findConflicts, type GridBlock } from "./schedule-conflicts";

const b = (id: string, cls: string, start: string, end: string, people: string[], room: string | null = null): GridBlock =>
  ({ blockId: id, classId: cls, day: "seg", start, end, personIds: people, roomId: room });

describe("NHOR.2 conflitos de grade", () => {
  it("professor em duas turmas ao mesmo tempo é conflito de pessoa", () => {
    const c = findConflicts([b("1", "A", "07:00", "07:50", ["p"]), b("2", "B", "07:30", "08:20", ["p"])]);
    expect(c.map((x) => x.kind)).toEqual(["pessoa"]);
  });
  it("blocos encostados (fim = início) não conflitam", () => {
    expect(findConflicts([b("1", "A", "07:00", "07:50", ["p"]), b("2", "A", "07:50", "08:40", ["p"])])).toEqual([]);
  });
  it("sala ausente nunca vira conflito; sala igual sim", () => {
    expect(findConflicts([b("1", "A", "07:00", "08:00", []), b("2", "B", "07:00", "08:00", [])])).toEqual([]);
    expect(findConflicts([b("1", "A", "07:00", "08:00", [], "s1"), b("2", "B", "07:00", "08:00", [], "s1")])[0]!.kind).toBe("sala");
  });
  it("dias diferentes não conflitam", () => {
    expect(findConflicts([b("1", "A", "07:00", "08:00", ["p"]), { ...b("2", "B", "07:00", "08:00", ["p"]), day: "ter" }])).toEqual([]);
  });
});
