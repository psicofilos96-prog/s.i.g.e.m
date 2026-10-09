import { describe, expect, it } from "vitest";
import { SECRETARIAT_TASKS } from "./secretariat-tasks";

describe("NSEC.UX — tarefas da Secretaria", () => {
  it("cobre as jornadas pedidas, uma vez cada", () => {
    expect(SECRETARIAT_TASKS.map((t) => t.id)).toEqual(["matricular", "achar", "trocar-turma", "transferir", "renovar", "documento", "vagas", "livro"]);
  });
  it("linguagem curta e sem jargão técnico", () => {
    for (const t of SECRETARIAT_TASKS) {
      expect(t.hint.length).toBeLessThanOrEqual(45);
      expect(`${t.title} ${t.hint}`).not.toMatch(/homolog|capability|episódio|vínculo|enturma|id\b|uuid/i);
    }
  });
});
