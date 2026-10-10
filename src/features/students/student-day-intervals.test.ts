import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { groupByStudent, inYear, projectIntervals, type IntervalRow } from "./student-day-intervals";

const row = (id: string, weekday: number, s: string, known: string, student = "a"): IntervalRow => ({ id, weekday, starts_at: `${s}:00`, ends_at: "12:00:00", parser: "jornada-literal-v1", observation_id: "o",
  obs: { student_id: student, class_id: "T", schedule_literal: "Seg a Sex 07:30-12:00", known_at: known, source_ref: "Todas as jornadas.xlsx" } });

describe("jornada declarada 2026", () => {
  it("mostra dias, início, fim e proveniência em ordem segunda→domingo", () => {
    const r = projectIntervals([row("2", 3, "07:30", "2026-07-31T10:00:00Z"), row("1", 1, "07:30", "2026-07-31T10:00:00Z")]);
    expect(r.map((i) => i.weekdayLabel)).toEqual(["Segunda", "Quarta"]);
    expect(r[0]).toMatchObject({ start: "07:30", end: "12:00", parser: "jornada-literal-v1", source: "Todas as jornadas.xlsx", literal: "Seg a Sex 07:30-12:00" });
  });
  it("2027 não entra: só observações conhecidas em 2026", () => {
    expect(inYear("2027-01-02T00:00:00Z")).toBe(false);
    expect(projectIntervals([row("x", 1, "07:30", "2027-02-01T00:00:00Z")])).toEqual([]);
  });
  it("agrupa por estudante na turma", () => {
    const g = groupByStudent(projectIntervals([row("1", 1, "07:30", "2026-07-31", "a"), row("2", 1, "07:30", "2026-07-31", "b")]));
    expect([...g.keys()].sort()).toEqual(["a", "b"]);
  });
  it("não confunde com grade oficial nem carga docente e não grava", () => {
    const src = readFileSync("src/features/students/student-day-intervals.ts", "utf8");
    expect(src).not.toMatch(/class_schedule_at|teaching_assignment|\.insert\(|\.update\(|\.delete\(|client\.server/);
  });
});
