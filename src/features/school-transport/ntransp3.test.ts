import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
const sql = readFileSync("supabase/tests/ntransp3_transport_e2e.sql", "utf8");
const page = readFileSync("src/features/school-transport/transport-page.tsx", "utf8");
describe("NTRANSP.3", () => {
  it("prova de banco termina em RAISE e cobre cadeia, outra escola e sem capacidade", () => {
    expect(sql).toMatch(/RAISE EXCEPTION 'ntransp3-e2e-ok/);
    for (const c of ["transporte:base-alterada", "transporte:rota-de-outra-escola", "transporte:sem-autorizacao", "transporte:estudante-sem-matricula-na-escola"]) expect(sql).toContain(c);
  });
  it("seção nomeada pelo título visível, sem rótulo duplicado", () => {
    expect(page).toContain("aria-labelledby");
    expect(page).not.toContain('aria-label="Transporte da escola"');
  });
  it("tela não inventa elegibilidade, distância ou prioridade", () => {
    expect(page).not.toMatch(/eleg[ií]vel|dist[aâ]ncia|prioridade/i);
  });
});
