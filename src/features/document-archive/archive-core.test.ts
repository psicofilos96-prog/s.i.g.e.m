import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { breadcrumbs, can, checkFile, listChildren, nameOk, previewKind, roleRank, type ArchiveNode } from "./archive-core";

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
const n = (id: string, parentId: string | null, kind: "pasta" | "arquivo", name: string, updatedAt = "2026-01-01"): ArchiveNode => ({ id, parentId, kind, name, updatedAt, trashedAt: null });

describe("ACV.1 acervo — regras", () => {
  it("papéis em ordem crescente", () => {
    expect(roleRank("visualizar")).toBe(1);
    expect(roleRank("administrar")).toBe(7);
    expect(can(4, "organizar") && !can(4, "excluir")).toBe(true);
  });
  it("nomes inválidos recusados", () => {
    for (const bad of ["", "..", "a/b", " x", "x.", "a<b"]) expect(nameOk(bad), bad).toBe(false);
    expect(nameOk("Ata 2026.pdf")).toBe(true);
  });
  it("MIME real precisa conferir com a extensão", () => {
    expect(checkFile("a.pdf", 10, pdf)).toMatchObject({ ok: true, mime: "application/pdf" });
    expect(checkFile("a.png", 10, pdf)).toMatchObject({ ok: false, reason: "conteudo-nao-confere-com-extensao" });
    expect(checkFile("a.html", 10, pdf)).toMatchObject({ ok: false, reason: "tipo-nao-permitido" });
    expect(checkFile("a.txt", 10, new TextEncoder().encode("<script>x"))).toMatchObject({ ok: false });
    expect(checkFile("a.pdf", 60_000_000, pdf)).toMatchObject({ ok: false, reason: "tamanho-excedido" });
  });
  it("prévia nunca para conteúdo ativo", () => {
    expect(previewKind("text/html")).toBe("nenhuma");
    expect(previewKind("image/svg+xml")).toBe("nenhuma");
    expect(previewKind("application/pdf")).toBe("pdf");
  });
  it("breadcrumbs de pasta aninhada e listagem com pastas primeiro", () => {
    const nodes = [n("a", null, "pasta", "Atas"), n("b", "a", "pasta", "2026"), n("c", "b", "arquivo", "z.pdf"), n("d", "b", "pasta", "Conselho")];
    expect(breadcrumbs(nodes, "c").map((x) => x.name)).toEqual(["Atas", "2026", "z.pdf"]);
    expect(listChildren(nodes, "b", {}, "nome", true).map((x) => x.id)).toEqual(["d", "c"]);
    expect(listChildren(nodes, null, { query: "pdf" }, "nome", true).map((x) => x.id)).toEqual(["c"]);
  });
});

describe("ACV.1 acervo — banco", () => {
  const sql = readFileSync("drizzle/migrations/0497_acv01_acervo_documental.sql", "utf8");
  it("sem DML direta para authenticated nem acesso anon", () => {
    expect(sql).not.toMatch(/GRANT\s+[^;]*(INSERT|UPDATE|ALL)[^;]*ON public\.acv_(spaces|nodes|file_versions|acl|events|uploads|space_members|links)\b[^;]*TO authenticated/i);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon/);
  });
  it("bucket privado sem update/delete e sem eliminação de nó", () => {
    expect(sql).not.toMatch(/ON storage\.objects FOR (UPDATE|DELETE)/);
    expect(sql).toMatch(/acv_nodes_nodel BEFORE DELETE/);
  });
});
