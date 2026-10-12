import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { catalog, lgpdAttention } from "./digital-catalog";

const v = (id: string, version: number, personId = "a", over = {}) => ({ id, serviceKey: "diario", version, name: "Diário", kind: "sistema", audience: ["professores"], operator: "terceiro" as const, status: "em-uso" as const, dataClasses: ["criancas"], personId, ...over });

describe("L15 catálogo digital", () => {
  it("vale só a última versão aprovada por outra pessoa", () => {
    expect(catalog([v("1", 1)], [{ versionId: "1", personId: "a" }])[0]!.situation).toBe("pendente-de-aprovacao");
    expect(catalog([v("1", 1)], [{ versionId: "1", personId: "b" }])[0]!.situation).toBe("em-uso");
  });
  it("versão nova pendente não cai para a anterior aprovada", () => {
    const c = catalog([v("1", 1), v("2", 2, "a", { status: "descontinuado" })], [{ versionId: "1", personId: "b" }]);
    expect(c).toHaveLength(1);
    expect(c[0]!.situation).toBe("pendente-de-aprovacao");
  });
  it("terceiro com dado de criança sinaliza atenção LGPD", () => {
    expect(lgpdAttention(catalog([v("1", 1)], [{ versionId: "1", personId: "b" }])[0]!)).toBe(true);
  });
  it("banco: terceiro exige contrato juntado, autoaprovação recusada, anon sem execução", () => {
    const f = readdirSync("drizzle/migrations").find((x) => x.startsWith("0488"))!;
    const sql = readFileSync(`drizzle/migrations/${f}`, "utf8");
    expect(sql).toMatch(/operator = 'rede' OR contract_ref IS NOT NULL/);
    expect(sql).toMatch(/'autoaprovacao'/);
    expect(sql).toMatch(/'versao-superada'/);
    expect(sql.match(/FROM PUBLIC, anon/g)).toHaveLength(2);
  });
});
