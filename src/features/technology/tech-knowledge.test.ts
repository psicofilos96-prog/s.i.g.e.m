import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { activeLinks, resolutionRate, suggestFor } from "./tech-knowledge";

const l = (id: string, action: "vincular" | "desvincular", at: string, personId = "a") => ({ id, docId: "kb-wifi", targetKind: "categoria-de-chamado" as const, targetKey: "rede", action, personId, createdAt: at });

describe("L19 biblioteca técnica e autosserviço", () => {
  it("vínculo só vale validado por outra pessoa; desvincular validado encerra", () => {
    expect(activeLinks([l("1", "vincular", "1")], [{ linkId: "1", personId: "a" }])).toHaveLength(0);
    expect(activeLinks([l("1", "vincular", "1")], [{ linkId: "1", personId: "b" }])).toHaveLength(1);
    expect(activeLinks([l("1", "vincular", "1"), l("2", "desvincular", "2")], [{ linkId: "1", personId: "b" }, { linkId: "2", personId: "b" }])).toHaveLength(0);
  });
  it("sugestão respeita o que o usuário pode ler na Base", () => {
    const links = activeLinks([l("1", "vincular", "1")], [{ linkId: "1", personId: "b" }]);
    expect(suggestFor({ kind: "categoria-de-chamado", key: "rede" }, links, new Set())).toEqual([]);
    expect(suggestFor({ kind: "categoria-de-chamado", key: "rede" }, links, new Set(["kb-wifi"]))).toEqual(["kb-wifi"]);
  });
  it("taxa de resolução só com mínimo declarado", () => {
    expect(resolutionRate({ resolved: 1, notResolved: 0 }, null)).toBeNull();
    expect(resolutionRate({ resolved: 3, notResolved: 1 }, 4)).toBe(0.75);
  });
  it("banco: sem tabela de artigos paralela, retorno individual ilegível, autovalidação recusada", () => {
    const f = readdirSync("drizzle/migrations").find((x) => x.startsWith("0492"))!;
    const sql = readFileSync(`drizzle/migrations/${f}`, "utf8");
    expect(sql).not.toMatch(/CREATE TABLE public\.tech_(articles|kb_documents|knowledge)/);
    expect(sql).not.toMatch(/GRANT SELECT[^;]*tech_selfservice_feedback/);
    expect(sql).toContain("'autovalidacao'");
    expect(sql).toContain("'chamado-alheio'");
  });
});
