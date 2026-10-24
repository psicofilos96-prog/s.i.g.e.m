import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const sql = readFileSync("drizzle/migrations/0609_archive_legacy_simple_tables.sql", "utf8");
const tables = ["sg_schools", "sg_classes", "sg_students", "sg_staff", "sg_attendance"];

describe("acervo de planilhas não é cadastro operacional", () => {
  it("revoga acesso direto e remove as cinco políticas irrestritas sem apagar o acervo", () => {
    const revoke = sql.match(/REVOKE ALL PRIVILEGES ON TABLE[\s\S]*?FROM PUBLIC, anon, authenticated;/)?.[0];
    expect(revoke).toBeDefined();
    for (const table of tables) {
      expect(revoke).toContain(`public.${table}`);
      expect(sql).toContain(`DROP POLICY IF EXISTS "logados usam" ON public.${table};`);
    }
    expect(sql).not.toMatch(/\b(?:DELETE FROM|TRUNCATE|DROP TABLE|CREATE POLICY|GRANT)\b/i);
  });

  it("todos os cadastros antigos encaminham ao oficial antes de montar a tela", () => {
    const destinations = { alunos: "/alunos", servidores: "/profissionais", turmas: "/turmas", escolas: "/unidades" };
    for (const [legacy, target] of Object.entries(destinations)) {
      const route = readFileSync(`src/routes/cadastro.${legacy}.tsx`, "utf8");
      expect(route).toContain(`throw redirect({ to: "${target}", replace: true })`);
      expect(route).not.toContain("EntityPage");
    }
  });

  it("consulta de matrícula ao acervo mantém a capacidade e a autoria auditada", () => {
    const lookup = readFileSync("drizzle/migrations/0530_locate_student_by_name_inclui_cadastros.sql", "utf8");
    expect(lookup).toContain("has_school_capability('localizar-estudante-para-matricula', _school)");
    expect(lookup).toContain("INSERT INTO public.exact_lookup_events");
    expect(sql).not.toMatch(/(?:DROP|ALTER|REPLACE) FUNCTION/i);
  });
});
