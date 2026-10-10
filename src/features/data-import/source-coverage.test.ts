import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { COVERAGE, coverageSql, evaluateCoverage, coverageMarkdown } from "./source-coverage";

describe("conferência fonte-documento 2026", () => {
  it("cobre todos os documentos exigidos e as três naturezas", () => {
    for (const k of ["alunos", "turmas", "jornadas", "professores", "servidores", "semed", "escolas", "infraestrutura", "recibos"]) expect(COVERAGE.some((d) => d.key === k)).toBe(true);
    expect(new Set(COVERAGE.map((d) => d.nature))).toEqual(new Set(["censitario", "administrativo", "cadastro-oficial"]));
  });
  it("SQL gerado só conta: sem valores, sem DML/DDL", () => {
    const sql = coverageSql();
    expect(sql).not.toMatch(/\b(insert|update|delete|truncate|alter|create|drop|grant)\b\s/i);
    expect(sql.replace(/count\([a-z_0-9]+\)|count\(\*\)/g, "")).not.toMatch(/select [^']*\b(full_name|display_name)\b/);
  });
  it("divergência e situação por campo; vazio = não fornecido; coluna inexistente = não importado", () => {
    const doc = COVERAGE.find((d) => d.key === "jornadas")!;
    const r = evaluateCoverage(doc, { total: 9692, filled: { schedule_literal: 9692, weekly_load_literal: 9692, link_role: 9692, stage_literal: 9176 } });
    expect(r.divergence).toBe(488);
    expect(r.fields.find((f) => f.column === "stage_literal")?.status).toBe("parcial");
    const a = evaluateCoverage(COVERAGE.find((d) => d.key === "alunos")!, { total: 10, filled: { display_name: 10, institutional_identifier: 0 } });
    expect(a.fields.find((f) => f.column === "institutional_identifier")?.status).toBe("nao-fornecido");
    expect(a.fields.find((f) => f.field === "CPF")?.status).toBe("nao-importado");
  });
  it("sem leitura não há número: nada vira zero", () => {
    const r = evaluateCoverage(COVERAGE[0]!, null);
    expect(r.imported).toBeNull();
    expect(r.fields.every((f) => f.filled === null)).toBe(true);
  });
  it("relatório reproduzível sem PII e painel só faz contagem HEAD", () => {
    const md = coverageMarkdown([evaluateCoverage(COVERAGE[0]!, { total: 55, filled: { official_name: 55 } })], "2026-10-10T00:00:00Z");
    expect(md).toContain("somente leitura");
    const page = readFileSync("src/features/data-import/source-coverage-page.tsx", "utf8");
    expect(page).toMatch(/head: true/);
    expect(page).not.toMatch(/client\.server|\.insert\(|\.update\(|\.delete\(/);
  });
});
