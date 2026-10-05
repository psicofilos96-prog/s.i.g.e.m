import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { deepLink, groupHits } from "./global-search";

const sql = ["0082_global_search", "0084_global_search_all_tokens", "0085_global_search_multi_token_index", "0086_persons_policy_initplan"]
  .map((f) => readFileSync(`drizzle/migrations/${f}.sql`, "utf8")).join("\n");
const latest = readFileSync("drizzle/migrations/0085_global_search_multi_token_index.sql", "utf8");

describe("pesquisa global", () => {
  it("é SECURITY INVOKER: a RLS de quem pesquisa filtra antes de devolver", () => {
    expect(latest).toMatch(/SECURITY INVOKER/);
    expect(latest).not.toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.global_search\(text, text\[\], int, int\) FROM PUBLIC, anon/);
  });
  it("não indexa conteúdo sensível", () => {
    for (const t of ["inclusion_", "dietary_", "assessment_entry", "address", "birth_date", "guardian_", "attendance_"]) expect(latest).not.toContain(t);
  });
  it("identificador oficial só por igualdade exata (sem enumeração parcial)", () => {
    expect(latest).toMatch(/i\.value = raw/);
    expect(latest).not.toMatch(/i\.value LIKE/);
  });
  it("acentos, caixa e curingas digitados são neutralizados; paginação limitada", () => {
    expect(sql).toMatch(/unaccent/); expect(sql).toMatch(/lower/);
    expect(latest).toMatch(/'\\%'/); expect(latest).toMatch(/LEAST\(GREATEST\(coalesce\(_limit,20\),1\),50\)/);
  });
  it("lê só a versão vigente: removido/renomeado deixa de aparecer pelo nome antigo", () => {
    expect(latest).toMatch(/ORDER BY v\.student_id, v\.version DESC\) x\s+WHERE x\.k LIKE/);
  });
  it("política RLS de pessoas avaliada uma vez por consulta", () => {
    expect(sql).toMatch(/\(SELECT public\.has_network_capability\('manter-pessoas-institucionais'\)\)/);
  });
  it("deep links e agrupamento", () => {
    expect(deepLink({ category: "aluno", entity_id: "s1" })).toEqual({ to: "/alunos/$id", params: { id: "s1" } });
    expect(deepLink({ category: "desconhecida", entity_id: "x" })).toBeNull();
    const g = groupHits([{ category: "turma", entity_id: "1", title: "A", subtitle: null, match_kind: "contem", score: 1 }, { category: "x", entity_id: "2", title: "B", subtitle: null, match_kind: "contem", score: 1 }]);
    expect(g.map(([c]) => c)).toEqual(["turma"]);
  });
  it("tela não guarda buscas recentes nem filtra no navegador", () => {
    const ui = readFileSync("src/components/app-shell/app-shell.tsx", "utf8") + readFileSync("src/features/global-search/global-search.ts", "utf8");
    expect(ui).not.toMatch(/localStorage|sessionStorage/);
    expect(ui).not.toMatch(/from\("institutional_students"\)/);
  });
});
