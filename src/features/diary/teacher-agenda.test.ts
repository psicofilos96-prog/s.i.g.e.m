import { describe, expect, it } from "vitest";
import { agendaConflicts, nextLesson } from "./teacher-agenda";

const b = (id: string, date: string, start: string, end: string) => ({ blockId: id, date, start, end, classLabel: "T", componentLabel: null });

describe("agenda do docente", () => {
  it("sem grade não há próxima aula", () => expect(nextLesson([], "2027-02-01T08:00")).toBeNull());
  it("aula em andamento ainda é a próxima", () =>
    expect(nextLesson([b("a", "2027-02-01", "07:30", "08:20"), b("b", "2027-02-01", "08:20", "09:10")], "2027-02-01T08:00")?.blockId).toBe("a"));
  it("detecta sobreposição no mesmo dia", () =>
    expect(agendaConflicts([b("a", "2027-02-01", "07:30", "08:20"), b("b", "2027-02-01", "08:00", "08:50")])).toHaveLength(1));
  it("blocos encostados não conflitam", () =>
    expect(agendaConflicts([b("a", "2027-02-01", "07:30", "08:20"), b("b", "2027-02-01", "08:20", "09:10")])).toHaveLength(0));
});

import { blocksForDate as bfd } from "./teacher-agenda";
import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("blocksForDate", () => {
  i2("keeps only the consulted weekday and never invents blocks", () => {
    const items = [{ classLabel: "5A", componentLabel: "LP", blocks: [{ id: "b1", day: "mon", start: "07:00", end: "07:50" }, { id: "b2", day: "tue", start: "08:00", end: "08:50" }] }];
    e2(bfd("2026-10-05", "mon", items).map((b) => b.blockId)).toEqual(["b1"]);
    e2(bfd("2026-10-05", null, items)).toEqual([]);
    e2(bfd("2026-10-05", "mon", [])).toEqual([]);
  });
});
