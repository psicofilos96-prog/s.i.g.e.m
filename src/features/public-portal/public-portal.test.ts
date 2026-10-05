import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import fc from "fast-check";
import { isValidSlug, toPublicDetail } from "./portal-model";
import { isPublicPath } from "./public-paths";

const sql = readFileSync("drizzle/migrations/0087_public_portal_publications.sql", "utf8");

describe("portal público", () => {
  it("não publicado, revogado e inexistente são indistinguíveis", () => {
    for (const raw of [null, {}, { status: "rascunho", kind: "comunicado" }, { status: "revogado", kind: "comunicado" }, { status: "indisponivel" }])
      expect(toPublicDetail(raw)).toEqual({ status: "indisponivel" });
  });

  it("tipo fora da lista publicável nunca vira público", () => {
    expect(toPublicDetail({ status: "publicado", kind: "aluno", title: "x" })).toEqual({ status: "indisponivel" });
  });

  it("campos extras (PII) da resposta são descartados", () => {
    const d = toPublicDetail({ status: "publicado", kind: "comunicado", slug: "aviso", title: "T", body: "b", version: 1,
      published_at: "2026-10-05", summary: null, recorded_by: "uuid", email: "x@y", student_id: "s" });
    expect(Object.keys(d).sort()).toEqual(["body", "kind", "published_at", "slug", "status", "summary", "title", "version"]);
  });

  it("código/slug inválido é recusado sem consulta (fuzz)", () => {
    fc.assert(fc.property(fc.string(), (s) => { if (isValidSlug(s)) expect(s).toMatch(/^[a-z0-9-]+$/); }));
    expect(isValidSlug("../etc")).toBe(false);
    expect(isValidSlug("a")).toBe(false);
  });

  it("separação público/autenticado é allowlist", () => {
    expect(isPublicPath("/publico")).toBe(true);
    expect(isPublicPath("/publico/aviso")).toBe(true);
    expect(isPublicPath("/verificar/ABC")).toBe(true);
    for (const p of ["/", "/alunos", "/publicacoes", "/publicos", "/familia", "/verificar"]) expect(isPublicPath(p)).toBe(false);
  });

  it("rotas públicas não importam leitores internos", () => {
    for (const f of readdirSync("src/routes").filter((x) => x.startsWith("publico.") || x.startsWith("verificar.")))
      expect(readFileSync(`src/routes/${f}`, "utf8")).not.toMatch(/student-life|professionals|diary|from\("/);
  });

  it("banco: anon nunca lê tabelas; só funções devolvem última versão publicada", () => {
    expect(sql).not.toMatch(/GRANT[^;]*ON public\.public_publication[^;]* TO[^;]*anon/);
    expect(sql).toMatch(/WHERE v\.state = 'publicado'/);
    expect(sql).toMatch(/ORDER BY x\.version DESC LIMIT 1/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.record_public_publication[^;]*anon/);
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE ON public\.public_publication_versions/);
  });

  it("verificação de documento não expõe id técnico da escola", () => {
    const fn = sql.slice(sql.indexOf("verify_school_document"));
    expect(fn).not.toMatch(/'school_id'/);
  });

  it("sem cache de respostas públicas no cliente", () => {
    expect(readFileSync("src/routes/publico.index.tsx", "utf8")).toMatch(/staleTime: 0/);
    expect(readFileSync("src/routes/publico.$slug.tsx", "utf8")).toMatch(/staleTime: 0/);
  });
});
