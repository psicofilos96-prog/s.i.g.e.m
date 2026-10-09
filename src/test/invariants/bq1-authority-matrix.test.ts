/**
 * BQ.1 — matriz real de autoridades (decisão do gestor 2026-10-09).
 * Prova estática sobre a migration aplicada + navegação; a prova de execução real é
 * supabase/tests/bq1_authority_matrix.sql (termina em RAISE, nada persiste).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stationAllowsPath, STATION_HOME } from "@/features/authority/station-navigation";

const sql = readFileSync("drizzle/migrations/0253_bq1_institutional_authority_matrix.sql", "utf8");
const rules = new Map<string, Set<string>>();
for (const m of sql.matchAll(/\('([a-z_]+)','([a-z0-9-]+)'\)/g)) {
  const [, st = "", cap = ""] = m;
  if (!rules.has(st)) rules.set(st, new Set());
  rules.get(st)!.add(cap);
}
const has = (s: string, c: string) => rules.get(s)?.has(c) ?? false;

describe("BQ.1 matriz de autoridades", () => {
  it("Supervisão constrói e homologa o calendário da rede", () => {
    expect(has("supervisao", "construir-calendario-da-rede")).toBe(true);
    expect(has("supervisao", "homologar-calendario-da-rede")).toBe(true);
  });
  it("nenhum outro setor recebe writer ou homologação do calendário", () => {
    for (const s of ["avaliacao", "ciece", "alimentacao", "direcao_escolar", "inclusao_nei"]) {
      expect(has(s, "homologar-calendario-da-rede")).toBe(false);
      expect(has(s, "construir-calendario-da-rede")).toBe(false);
    }
  });
  it("restrição individual é da Direção; a central de Alimentação só consulta", () => {
    expect(has("direcao_escolar", "registrar-restricao-alimentar")).toBe(true);
    expect(has("alimentacao", "registrar-restricao-alimentar")).toBe(false);
    expect(has("alimentacao", "consultar-restricao-alimentar")).toBe(true);
  });
  it("a Direção não recebe autoridade central de Alimentação", () => {
    for (const c of ["manter-cardapio-escolar", "homologar-conteudo-tecnico-alimentar", "fechar-estoque-alimentar"]) {
      expect(has("direcao_escolar", c)).toBe(false);
    }
  });
  it("Alimentação fecha o próprio ciclo sem outro setor", () => {
    for (const c of ["fechar-estoque-alimentar", "aprovar-inventario-alimentar", "conferir-recebimento-alimentar"]) {
      expect(has("alimentacao", c)).toBe(true);
    }
  });
  it("Inclusão/NEI central é estação própria de rede", () => {
    expect(has("inclusao_nei", "acompanhar-educacao-inclusiva-rede")).toBe(true);
    expect(has("inclusao_nei", "revisar-termos-inclusao")).toBe(true);
    expect(STATION_HOME.inclusao_nei).toBe("/inclusao");
  });
  it("Admin = catálogo inteiro, sem curinga", () => {
    expect(sql).toContain("SELECT 3, 'administracao_geral', k.capability_id");
    expect(sql).not.toMatch(/capability_id\s*(=|LIKE)\s*'[*%]'/);
  });
  it("Direção abre Alimentação da escola; Supervisão não abre Alimentação", () => {
    expect(stationAllowsPath("direcao_escolar", "/alimentacao-escolar")).toBe(true);
    expect(stationAllowsPath("supervisao", "/alimentacao-escolar")).toBe(false);
  });
  it("nenhuma tela autoriza por e-mail", () => {
    const nav = readFileSync("src/features/authority/station-navigation.ts", "utf8");
    expect(nav).not.toMatch(/@sigem\.itap\.gov\.br/);
  });
});
