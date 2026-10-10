import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("drizzle/migrations/0287_r1_infrastructure_scoped_read.sql", "utf8");

describe("R1 — leitura de infraestrutura escolar escopada", () => {
  it("remove a leitura aberta a qualquer autenticado", () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS "leitura autenticada"/);
    expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)/i);
  });
  it("nega visitante sem sessão", () => {
    expect(sql).toMatch(/REVOKE ALL ON public\.school_infrastructure_observations FROM anon/);
  });
  it("escola só lê a própria linha por capability escolar", () => {
    expect(sql).toMatch(/has_school_capability\('manter-cadastro-unidade-escolar', school_id\)/);
  });
  it("rede só por capability de rede explícita", () => {
    expect(sql).toMatch(/has_network_capability\('consultar-censo-escolar'\)/);
  });
});
