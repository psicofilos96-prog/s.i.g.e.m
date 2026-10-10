import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const calls: string[] = [];
let denied = false;
vi.mock("@/integrations/supabase/client", () => {
  const builder = (table: string) => {
    const state: { sel?: string } = {};
    const b: Record<string, unknown> = {};
    const result = () => {
      if (denied) return { data: null, error: { message: "permission denied" }, count: null };
      if (state.sel?.includes("institutional_students")) return { data: [
        { id: "e1", student_id: "s1", enrollment_id: "m1", class_id: "T", valid_from: "2026-02-01", supersedes_id: null, institutional_students: { display_name: "Bruna" }, class_enrollment_episode_endings: [] },
        { id: "e2", student_id: "s2", enrollment_id: "m2", class_id: "T", valid_from: null, supersedes_id: null, institutional_students: { display_name: "Ana" }, class_enrollment_episode_endings: [{ ended_on: "2026-05-10", reason_label: "Transferência" }] },
      ], error: null, count: 2 };
      if (state.sel?.includes("class_id")) return { data: [
        { id: "e1", supersedes_id: null, student_id: "s1", class_id: "T", class_enrollment_episode_endings: [] },
        { id: "x9", supersedes_id: null, student_id: "s1", class_id: "AEE1", class_enrollment_episode_endings: [] },
      ], error: null };
      return { data: [
        { id: "e1", supersedes_id: null, student_id: "s1", enrollment_id: "m1", class_enrollment_episode_endings: [] },
        { id: "e2", supersedes_id: null, student_id: "s2", enrollment_id: "m2", class_enrollment_episode_endings: [{ ended_on: "2026-05-10" }] },
      ], error: null };
    };
    for (const k of ["eq", "ilike", "order", "abortSignal", "in", "limit"]) b[k] = () => b;
    b.select = (s: string) => { state.sel = s; calls.push(`${table}:select`); return b; };
    b.range = async () => result();
    b.then = (res: (v: unknown) => unknown) => Promise.resolve(result()).then(res);
    return b;
  };
  return { supabase: { from: (t: string) => builder(t) } };
});

import { currentEpisodes, otherActiveByStudent, projectRoster, readClassRoster, rosterCounts } from "./class-roster";

describe("diário nominal da turma", () => {
  it("dupla matrícula: mesmo aluno vigente em outra turma é sinalizado; contagem de alunos é distinta", () => {
    const m = otherActiveByStudent([
      { id: "a", supersedes_id: null, student_id: "s1", class_id: "T", ended: false },
      { id: "b", supersedes_id: null, student_id: "s1", class_id: "U", ended: false },
      { id: "c", supersedes_id: null, student_id: "s1", class_id: "V", ended: true },
    ], "T");
    expect(m.get("s1")).toBe(1);
    const c = rosterCounts([
      { id: "a", supersedes_id: null, student_id: "s1", enrollment_id: "m1", ended: false },
      { id: "b", supersedes_id: null, student_id: "s1", enrollment_id: "m2", ended: false },
    ]);
    expect(c).toMatchObject({ distinctStudents: 1, distinctEnrollments: 2, episodes: 2 });
  });

  it("AEE: vínculo é AEE só quando a turma declara tipo AEE", () => {
    const row = { id: "a", student_id: "s", enrollment_id: "m", class_id: "T", valid_from: null, supersedes_id: null, studentName: null, ending: null };
    expect(projectRoster([row], { isAee: true, otherActive: new Map() })[0].bond).toBe("aee");
    expect(projectRoster([row], { isAee: false, otherActive: new Map() })[0].bond).toBe("regular");
  });

  it("saída registrada vira encerrado com data e motivo; correção remove o episódio substituído", () => {
    const [e] = projectRoster([{ id: "a", student_id: "s", enrollment_id: "m", class_id: "T", valid_from: null, supersedes_id: null, studentName: null, ending: { ended_on: "2026-05-10", reason_label: "Transferência" } }], { isAee: false, otherActive: new Map() });
    expect(e.situation).toEqual({ kind: "encerrado", on: "2026-05-10", reason: "Transferência" });
    expect(currentEpisodes([{ id: "old", supersedes_id: null }, { id: "new", supersedes_id: "old" }]).map((r) => r.id)).toEqual(["new"]);
  });

  it("leitura paginada com a sessão: ordena por nome, conta vigentes/encerrados e detecta dupla matrícula", async () => {
    denied = false;
    const r = await readClassRoster("T", { page: 0, search: "", sort: "nome", isAee: false });
    expect(r.entries.map((e) => e.studentName)).toEqual(["Ana", "Bruna"]);
    expect(r.counts).toMatchObject({ distinctStudents: 2, active: 1, ended: 1 });
    expect(r.entries.find((e) => e.studentId === "s1")?.otherActiveClasses).toBe(1);
    expect(calls.every((c) => c.startsWith("class_enrollment_episodes"))).toBe(true);
  });

  it("escola sem permissão: falha fechada, sem lista", async () => {
    denied = true;
    await expect(readClassRoster("T", { page: 0, search: "", sort: "nome", isAee: false })).rejects.toThrow(/permission/);
    denied = false;
  });

  it("não usa cliente privilegiado nem grava nada", () => {
    const src = readFileSync("src/features/classes/class-roster.ts", "utf8") + readFileSync("src/features/classes/class-roster-panel.tsx", "utf8");
    expect(src).not.toMatch(/client\.server|supabaseAdmin|\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
  });
});
