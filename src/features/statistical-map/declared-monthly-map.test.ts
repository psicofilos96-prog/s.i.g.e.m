import { describe, expect, it } from "vitest";
import { compareDeclared, declaredCoverage, groupDeclaredClasses, movementBalance, projectAll, projectDeclared, type DeclaredMap } from "./declared-monthly-map";

const base: DeclaredMap = {
  school_id: "s", month: 7, source_file: "f", source_sheet: "JULHO 2026", inep_declared: "33000001",
  previous_month_enrollment: 71, transfers_in: 0, new_students: 1, transfers_out: 0, dropouts: 0, withdrawn_cancelled: 0,
  total_ii: 72, declared_classes: 2, total_iii: 72,
  classes: [{ modalidade: "EI", etapa: "B", turma: "Berçário", alunos: 30 }, { modalidade: "EI", etapa: "M", turma: "Maternal", alunos: 42 }], consistency_issues: [],
};
const multi = [
  { modalidade: "EF1", etapa: "1º ANO", turma: "(Multisseriada 1º ao 5º ano) A", alunos: 2 },
  { modalidade: "EF1", etapa: "2º ANO", turma: "2º ANO", alunos: 1 },
  { modalidade: "EF1", etapa: "3º ANO", turma: "3º ANO", alunos: 2 },
  { modalidade: "EF1", etapa: "1º ANO", turma: "1º ANO", alunos: 6 },
];

describe("mapa mensal declarado", () => {
  it("fecha a movimentação do mês", () => expect(movementBalance(base)).toBe(72));
  it("parcela ausente não vira zero", () => expect(movementBalance({ ...base, dropouts: null })).toBeNull());
  it("multisseriada: linhas por etapa somam numa só turma", () => {
    const g = groupDeclaredClasses(multi);
    expect(g.map((x) => [x.turma, x.alunos, x.linhas])).toEqual([["(Multisseriada 1º ao 5º ano) A", 5, 3], ["1º ANO", 6, 1]]);
  });
  it("linha igual à etapa sem cabeça multisseriada é turma própria", () => {
    expect(groupDeclaredClasses([multi[1]!, multi[2]!]).length).toBe(2);
  });
  it("declaração coerente e INEP igual = declarado", () => {
    const p = projectDeclared(base, "33000001", { ...base, month: 6, total_ii: 71 });
    expect(p.state).toBe("declarado"); expect(p.previous_month_check).toBe("coincide");
  });
  it("INEP divergente exige reconciliação documental", () => {
    const p = projectDeclared(base, "33000002");
    expect(p.identity).toBe("associada-por-nome"); expect(p.state).toBe("declarado-com-ressalvas");
  });
  it("total III zero com turmas é incoerente, sem alterar números", () => {
    const d = { ...base, total_iii: 0 };
    const p = projectDeclared(d, "33000001");
    expect(p.section_iii).toBe("incoerente"); expect(d.total_iii).toBe(0);
  });
  it("mês anterior divergente é ressalva", () => {
    expect(projectDeclared(base, "33000001", { ...base, month: 6, total_ii: 60 }).previous_month_check).toBe("diverge");
  });
  it("estimativa parcial (0%) nunca dá veredito", () => {
    const c = compareDeclared(base, { distinct_students: 72, classes_with_students: 2, status: "estimativa-parcial" });
    expect(c.every((x) => x.status === "referencia-nao-apurada")).toBe(true);
    expect(compareDeclared(base, { distinct_students: 70, classes_with_students: 2, status: "apurado" }).map((x) => x.status)).toEqual(["diverge", "coincide"]);
    expect(compareDeclared(base, undefined).every((x) => x.status === "indisponivel")).toBe(true);
  });
  it("cobertura conta escolas, meses faltantes e duplicidades", () => {
    const projs = projectAll([base, { ...base, month: 8 }, { ...base, school_id: "t", inep_declared: "x" }], () => "33000001");
    const c = declaredCoverage(projs, 55);
    expect([c.schools_declared, c.competences, c.schools_total]).toEqual([2, 3, 55]);
    expect(c.per_school[0]!.missing).toEqual([2, 3, 4, 5, 6, 9]);
    expect(c.unconfirmed_identity).toEqual(["t"]);
  });
});

describe("linhas-modelo da planilha", () => {
  it("'-' com 0 alunos não conta como turma", () => {
    expect(groupDeclaredClasses([{ modalidade: "EI", etapa: "BERÇÁRIO", turma: "--", alunos: 0 }, { modalidade: "EI", etapa: "M", turma: "Turma 01", alunos: 8 }]).length).toBe(1);
  });
});
