import { describe, expect, it } from "vitest";
import { inepPersonState, peoplePendencies, type PeopleSummary } from "./people-identity";

const s = (o: Partial<PeopleSummary> = {}): PeopleSummary => ({ students: 10, professionals: 0, without_person: 0, inep_valid: 10, inep_invalid: 0, inep_missing: 0, cpf_present: 3, birth_present: 0, sex_present: 0, staff_records_without_person: 0, collisions: 0, ...o });

describe("pessoas no Educacenso", () => {
  it("INEP de pessoa exige 12 dígitos; ausente fica ausente", () => {
    expect(inepPersonState("110169946800")).toBe("valido");
    expect(inepPersonState("1101699")).toBe("invalido");
    expect(inepPersonState(null)).toBe("ausente");
  });
  it("nascimento e sexo ausentes são pendências, nunca preenchidos", () => {
    const p = peoplePendencies(s());
    expect(p).toContain("10 de 10 sem data de nascimento registrada (alunos)");
    expect(p).toContain("10 de 10 sem sexo registrado (alunos)");
  });
  it("cor/raça sem fonte é declarada por extenso", () => {
    expect(peoplePendencies(s()).some((x) => x.startsWith("Cor/raça obrigatória"))).toBe(true);
  });
  it("duplicidades ficam para a rede", () => {
    expect(peoplePendencies(s({ collisions: 2 }))).toContain("2 possíveis duplicidades aguardando a rede");
  });
});
