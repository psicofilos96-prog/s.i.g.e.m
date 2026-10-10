import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error módulo .mjs de script técnico
import { parseAudit, verdict } from "../../../scripts/audit2026-master.mjs";

const sql = readFileSync("scripts/audit2026/master-audit.sql", "utf8").replace(/--.*$/gm, "");

describe("AUD2026.MASTER — auditoria mestre 2026", () => {
  it("é somente leitura (nenhum DML/DDL)", () => {
    expect(sql).not.toMatch(/\b(insert|update|delete|truncate|alter|create|drop|grant)\b\s/i);
  });
  it("não lê colunas de PII", () => {
    expect(sql).not.toMatch(/\b(name|nome|cpf|birth|nascimento|email)\b/i);
  });
  it("assert diferente de zero reprova", () => {
    const a = parseAudit("assert|dup_aluno_turma|1\nschool|33000000|turmas|9|9|MATCH");
    expect(verdict(a).ok).toBe(false);
    expect(verdict(a).failed).toEqual(["dup_aluno_turma"]);
  });
  it("indicador divergente do recibo reprova; não comparável não", () => {
    expect(verdict(parseAudit("school|1|turmas|9|8|DIFF")).ok).toBe(false);
    expect(verdict(parseAudit("school|1|infra||40|NAO_COMPARAVEL\nassert|x|0")).ok).toBe(true);
  });
  it("cobre todos os domínios exigidos", () => {
    for (const k of ["turmas", "alunos", "matriculas_total", "matriculas_aee", "profissionais_docentes", "infraestrutura_observacoes", "jornada_intervalos", "escola_com_matricula_sem_jornada_turma"]) expect(sql).toContain(k);
  });
});
