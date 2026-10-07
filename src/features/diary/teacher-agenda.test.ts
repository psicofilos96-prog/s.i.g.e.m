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
