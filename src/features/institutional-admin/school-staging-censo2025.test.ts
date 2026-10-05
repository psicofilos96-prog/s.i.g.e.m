import { describe, expect, it } from "vitest";
import staging from "../../../docs/data/staging/escolas-municipais-itaperuna-censo2025.json";

type Row = (typeof staging.unidades)[number];
const norm = (s: string) => s.normalize("NFKD").replace(/[^\p{L}\p{N} ]/gu, "").toUpperCase().replace(/\s+/g, " ").trim();

describe("staging de unidades — Censo 2025 (não gravado)", () => {
  const rows = staging.unidades as Row[];
  it("é só prévia, com fonte e hash", () => {
    expect(staging.gravado_no_banco).toBe(false);
    expect(staging.fonte_primaria.zip_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(rows).toHaveLength(staging.resumo.municipais_ativas_2025);
  });
  it("INEP e nome únicos; id proposto derivado do INEP", () => {
    expect(new Set(rows.map((r) => r.inep)).size).toBe(rows.length);
    expect(new Set(rows.map((r) => norm(r.nome_oficial_censo_2025))).size).toBe(rows.length);
    expect(rows.every((r) => /^\d{8}$/.test(r.inep) && r.school_id_proposto === `inep-${r.inep}`)).toBe(true);
  });
  it("sem inferência: campos sem fonte permanecem nulos", () => {
    for (const r of rows) {
      expect([r.codigo_rede, r.own_building, r.hard_access, r.classroom_count, r.endereco, r.cep, r.telefone, r.email]).toEqual(Array(8).fill(null));
      expect(["urbana", "rural"]).toContain(r.localizacao);
    }
  });
  it("NEI Boa Ventura não vira escola independente", () => {
    expect(rows.some((r) => /BOA VENTURA|EDUCACAO INCLUSIVA/.test(norm(r.nome_oficial_censo_2025)))).toBe(false);
    const chica = rows.find((r) => r.inep === "33002169");
    expect(chica?.needs_review).toBe(true);
    expect(chica?.divergencias.join(" ")).toMatch(/NEI Boa Ventura.*ANEXO/);
  });
});
