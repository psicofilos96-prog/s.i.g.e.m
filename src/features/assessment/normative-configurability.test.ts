/**
 * Auditoria ANTI-RIGIDEZ ampliada (refinamento 9) do princípio transversal de
 * Configurabilidade Normativa do SIGEM.
 *
 * A auditoria examina os MOTORES (código puro que interpreta regras). Ela não
 * examina fixtures demonstrativas nem telas: lá os valores são configuração
 * declarada, e configuração é exatamente o lugar onde eles devem viver.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const engines = [
  "src/features/assessment/academic-standing-engine.ts",
  "src/features/assessment/assessment-composition.ts",
  "src/features/assessment/cycle-consolidation.ts",
  "src/features/diary/attendance-formula.ts",
  "src/features/diary/attendance-cycle-consolidation.ts",
  "src/features/diary/attendance-scope-dimensions.ts",
];

/** Remove comentários e literais de texto: rótulos não são regra. */
const engineCode = (file: string) =>
  readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")
    .replace(/"[^"\n]*"|'[^'\n]*'|`[^`]*`/g, '""');

describe("configurabilidade normativa — motores", () => {
  it.each(engines)("%s não embute patamares normativos", (file) => {
    const code = engineCode(file);
    expect(code).not.toMatch(/[<>]=?\s*(0\.5|0\.6|0\.75|50|60|70|75|100)\b/);
    expect(code).not.toMatch(/\b(minimo|minimum|cutoff|threshold)\s*=\s*\d/i);
  });

  it.each(engines)("%s não condiciona por etapa, modalidade, segmento ou ano", (file) => {
    expect(engineCode(file)).not.toMatch(
      /anos\s*(iniciais|finais)|ensino\s*fundamental|educacao\s*infantil|\bEJA\b|fase\s*\d|\b(19|20)\d\d\b/i,
    );
  });

  it.each(engines)("%s não embute cargos, colegiados nem competências", (file) => {
    expect(engineCode(file)).not.toMatch(
      /supervisa|secretari[ao]\b|diretor|coordenador|conselho|CIECE|professor\s*=/i,
    );
  });

  it.each(engines)("%s não fixa quantidades, prazos nem granularidades", (file) => {
    const code = engineCode(file);
    expect(code).not.toMatch(/\b(periodos|bimestres|trimestres|semestres)\s*(===|!==|\.length\s*===)\s*\d/i);
    expect(code).not.toMatch(/\b(prazo|deadline|diasUteis|expira\w*)\b/i);
  });

  it.each(engines)("%s não embute efeitos institucionais nem situações", (file) => {
    expect(engineCode(file)).not.toMatch(
      /\b(aprovad|reprovad|retid|retenc|promov|transferid|dependencia|evadid|desistent)\w*\s*[=:]/i,
    );
  });

  it("enumerações abertas: unidade e escopo de apuração são identificadores", () => {
    const types = readFileSync("src/features/diary/attendance-closing-types.ts", "utf8");
    expect(types).toMatch(/AttendanceUnitKind\s*=\s*string/);
    expect(types).toMatch(/AttendanceAccountingScopeKind\s*=\s*string/);
  });

  it("situação acadêmica não tem taxonomia fechada de categoria", () => {
    const types = readFileSync("src/features/assessment/academic-standing-types.ts", "utf8");
    expect(types).not.toMatch(/category\s*\??:\s*"/);
  });

  it("a fórmula de frequência é declarada, não embutida no motor", () => {
    const code = engineCode("src/features/diary/attendance-formula.ts");
    expect(code).toMatch(/formula\.numerator/);
    expect(code).toMatch(/formula\.denominator/);
    expect(code).not.toMatch(/presencas\s*\//);
  });

  it("nomenclatura do ciclo foi saneada nos motores de avaliação", () => {
    for (const file of [
      "src/features/assessment/assessment-rule-types.ts",
      "src/features/assessment/assessment-composition.ts",
      "src/features/assessment/cycle-consolidation.ts",
    ])
      expect(readFileSync(file, "utf8")).not.toMatch(/annual[A-Z]/);
  });
});
