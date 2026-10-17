import { describe, expect, it } from "vitest";
import { ageOn, filterListing, listingRows, type ListingRow } from "./student-listing";

const r = (id: string, cls: string | null, birth: string, cpf = true): ListingRow => ({ student_id: id, student_name: `Aluno ${id}`, birth_date: birth, class_id: cls, class_label: cls, has_cpf: cpf, vaccination: null });
const none = { classId: "", birthMonth: "", search: "", noCpf: false };

describe("listagens personalizáveis", () => {
  it("idade conta o aniversário só quando ele já passou", () => {
    expect(ageOn("2018-10-18", "2026-10-17")).toBe(7);
    expect(ageOn("2018-10-17", "2026-10-17")).toBe(8);
  });
  it("filtra por turma, sem turma, mês de nascimento e falta de CPF", () => {
    const rows = [r("1", "A", "2018-03-01"), r("2", null, "2018-10-05", false), r("3", "B", "2017-10-09")];
    expect(filterListing(rows, { ...none, classId: "A" }).map((x) => x.student_id)).toEqual(["1"]);
    expect(filterListing(rows, { ...none, classId: "sem-turma" }).map((x) => x.student_id)).toEqual(["2"]);
    expect(filterListing(rows, { ...none, birthMonth: "10" }).map((x) => x.student_id)).toEqual(["2", "3"]);
    expect(filterListing(rows, { ...none, noCpf: true }).map((x) => x.student_id)).toEqual(["2"]);
  });
  it("ausência aparece por extenso, nunca vazia", () => {
    const [x] = listingRows([{ ...r("1", null, "2018-01-01"), birth_date: null }], "2026-10-17");
    expect(x?.nascimento).toBe("Não registrado");
    expect(x?.turma).toBe("Sem turma");
    expect(x?.vacinacao).toBe("Não registrado");
  });
});
