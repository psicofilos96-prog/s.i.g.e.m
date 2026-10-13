import { describe, expect, it } from "vitest";
import { compareClasses, stageRank } from "./class-stage-order";

const r = (e: string, t = "Curricular (etapa de ensino)") => stageRank(e, t);

describe("ordem por etapa", () => {
  it("Infantil < Fundamental I < Fundamental II < EJA < AEE < sem etapa", () => {
    const seq = [
      r("Educação infantil - creche (0 a 3 anos)"),
      r("Educação infantil - pré-escola (4 e 5 anos)"),
      r("Ensino fundamental de 9 anos - 1º Ano"),
      r("Ensino fundamental de 9 anos - 5º Ano"),
      r("Ensino Fundamental de 9 anos - multi"),
      r("Ensino fundamental de 9 anos - 6º Ano"),
      r("Ensino fundamental de 9 anos - 9º Ano"),
      r("EJA - Ensino fundamental - anos iniciais (1º segmento)"),
      r("EJA - Ensino fundamental - anos finais (2º segmento)"),
      stageRank("Não se aplica", "Atendimento educacional especializado (AEE)"),
      stageRank(null, null),
    ];
    expect([...seq].sort((a, b) => a - b)).toEqual(seq);
  });
  it("mesma etapa ordena por nome com número natural", () => {
    const l = [{ name: "TURMA 101", stageRank: 1 }, { name: "TURMA 20", stageRank: 1 }];
    expect(l.sort(compareClasses).map((x) => x.name)).toEqual(["TURMA 20", "TURMA 101"]);
  });
  it("sem etapa vai para o fim", () => {
    const l = [{ name: "A" }, { name: "Z", stageRank: 100 }];
    expect(l.sort(compareClasses).map((x) => x.name)).toEqual(["Z", "A"]);
  });
});
