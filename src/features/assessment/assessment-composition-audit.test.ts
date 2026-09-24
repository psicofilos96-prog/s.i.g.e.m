/**
 * Etapa 12E — auditoria estática do motor: nenhuma regra acadêmica pode estar
 * codificada no código (anos, notas de corte, nomes de componentes ou etapas).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const engineFiles = [
  "src/features/assessment/assessment-composition.ts",
  "src/features/assessment/assessment-composition-types.ts",
  "src/features/assessment/assessment-composition-projection.ts",
];

/** Comentários explicam as proibições; a auditoria examina apenas o código. */
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

const source = engineFiles.map((f) => stripComments(readFileSync(f, "utf8"))).join("\n");

describe("auditoria do motor de composição", () => {
  it("não referencia anos letivos específicos", () => {
    expect(source).not.toMatch(/\b(20\d{2})\b/);
  });

  it("não referencia componentes, etapas ou modalidades por nome", () => {
    expect(source).not.toMatch(
      /matem[áa]tica|portugu[êe]s|ci[êe]ncias|educa[çc][ãa]o infantil|\bEJA\b|\bAEE\b|bimestre|trimestre/i,
    );
  });

  it("não contém nota de corte, média fixa nem frequência mínima", () => {
    // Nenhuma comparação com valor de corte (nota mínima, percentual de frequência).
    expect(source).not.toMatch(/[<>]=?\s*(?:[2-9]|[1-9]\d)/);
    expect(source).not.toMatch(/m[ée]dia\s*\d|\b\d{2}\s*%|frequ[êe]ncia m[íi]nima/i);
  });

  it("não decide aprovação, reprovação, recuperação ou conselho", () => {
    expect(source).not.toMatch(/aprovad|reprovad|recupera[çc][ãa]o|depend[êe]ncia|conselho/i);
  });

  it("arredonda em um único lugar", () => {
    const engine = stripComments(readFileSync(engineFiles[0]!, "utf8"));
    expect(engine.match(/function applyRounding/g)?.length).toBe(1);
    const others = engineFiles
      .slice(1)
      .map((f) => stripComments(readFileSync(f, "utf8")))
      .join("\n");
    expect(others).not.toMatch(/Math\.round|toFixed|Math\.trunc/);
  });
});
