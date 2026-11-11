import { describe, expect, it } from "vitest";
import { TEACHER_MENU, activeTeacherItem } from "./teacher-menu";

describe("menu do professor", () => {
  it("tem só os 6 itens do dia a dia", () => {
    expect(TEACHER_MENU.map((i) => i.label)).toEqual(["Minhas aulas", "Chamada", "Registro de aula", "Planejamento", "Notas", "Minhas turmas"]);
  });
  it("Notas abre a aba de avaliações do Diário", () => {
    expect(activeTeacherItem("/diario", "avaliacoes")).toBe("notas");
    expect(activeTeacherItem("/diario")).toBe("inicio");
  });
});
