import { describe, expect, it } from "vitest";
import { classify, summarize, ROUTINE_TRACE } from "./legacy-templates";

describe("modelos legados", () => {
  it("modelo em branco vira candidato; arquivo com nome de pessoa vira registro pessoal", () => {
    expect(classify("S/Atestados/- ATESTADO DE ESCOLARIDADE - limpo - 2026.xlsx")).toMatchObject({ routine: "atestado-escolaridade", kind: "modelo-candidato" });
    expect(classify("S/Atestados/01 - ATESTADO DE ESCOLARIDADE - Fulano - 4 ano.xlsx").kind).toBe("registro-pessoal");
    expect(classify("S/Declaração FREQUENCIA de professor - 2026/PESSOA X/01 - PESSOA X.docx").kind).toBe("registro-pessoal");
  });
  it("formato antigo é marcado como risco de macro (nunca executado)", () => {
    expect(classify("S/Bilhete renovação matrícula - 2024.doc").macroRisk).toBe(true);
  });
  it("resumo nunca lista registro pessoal e agrupa versões", () => {
    const s = summarize(["S/01 - DECLARAÇÃO DE TRANSFERÊNCIA - Fulano.xlsx", "S/Ofício modelo.docx", "S/Ofício modelo (2).docx", "S/pasta/"]);
    expect(s.total).toBe(3);
    expect(JSON.stringify(s.candidates)).not.toMatch(/Fulano/);
    expect(s.versionGroups).toHaveLength(1);
  });
  it("rotina sem tela ou sem norma fica declarada, nunca inventada", () => {
    expect(ROUTINE_TRACE["bolsa-familia"].tela).toBeNull();
    expect(ROUTINE_TRACE["renovacao-matricula"].campos).toEqual([]);
  });
});
