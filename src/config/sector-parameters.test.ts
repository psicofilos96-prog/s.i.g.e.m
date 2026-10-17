import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { SECTOR_PARAMETERS, formatParameterValue } from "./sector-parameters";

const migrations = readdirSync("drizzle/migrations").filter((f) => f.endsWith(".sql")).map((f) => readFileSync(`drizzle/migrations/${f}`, "utf8")).join("\n");
const all = Object.values(SECTOR_PARAMETERS).flat();

describe("parâmetros por setor só existem se fazem algo", () => {
  it("cada parâmetro está no catálogo do banco e é lido pelo cálculo declarado", () => {
    for (const p of all) {
      expect(migrations).toContain(`'${p.key}'`);
      expect(migrations).toMatch(new RegExp(`FUNCTION public\\.${p.readBy}[\\s\\S]*sector_parameter_value\\('${p.key}'\\)`));
    }
  });
  it("prazo de não conformidade conta só abertas além dos dias definidos", () => {
    expect(migrations).toMatch(/opened_at AT TIME ZONE 'America\/Sao_Paulo'\)::date \+ dl < _on/);
  });
  it("todo parâmetro tem padrão do sistema: nada bloqueado por falta de definição", () => {
    for (const p of all) {
      if (p.input.kind === "data") expect(migrations).toContain("DATE '2017-12-01'");
      else expect(migrations.split("\n").some((l) => l.includes(`'${p.key}'`) && l.includes("::jsonb"))).toBe(true);
    }
    expect(migrations).toMatch(/coalesce\(\s*\(SELECT v\.value[\s\S]*c\.default_value/);
  });
  it("adesão = refeições servidas ÷ alunos presentes; sem presentes não vira zero", () => {
    expect(migrations).toMatch(/round\(meals \* 100\.0 \/ pres\)/);
    expect(migrations).toMatch(/coalesce\(pres, 0\) = 0 THEN NULL/);
  });
  it("sem valor mostra 'Ainda não definido'", () => {
    const days = all.find((p) => p.input.kind === "dias");
    if (!days) throw new Error("missing-days-parameter");
    expect(formatParameterValue(days, null)).toBe("Ainda não definido");
    expect(formatParameterValue(days, 5)).toBe("5 dia(s)");
  });
});
