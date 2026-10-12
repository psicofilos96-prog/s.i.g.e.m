import { describe, expect, it } from "vitest";
import { estimatePages, insertField, insertTable, insertToken, recoverDraft, serializeDraft, setFooter, setHeaderLines, setStyle, type LocalDraft } from "./editor-model";
import { DEFAULT_PAGE, renderStudio, validateTemplate, type StudioBlock } from "./studio-engine";

const base: StudioBlock[] = [{ type: "title", text: "Declaração" }, { type: "rich", runs: [{ text: "Texto" }] }];

describe("Documentos L03 — editor institucional", () => {
  it("tipografia só por lista fechada", () => {
    const b = setStyle(base, 0, { font: "Arial", size: 14, weight: "bold", align: "center", color: "primaria" });
    expect(b[0]).toMatchObject({ style: { font: "Arial", size: 14 } });
    expect(() => setStyle(base, 0, { font: "Comic Sans" as never })).toThrow("fonte");
    expect(() => setStyle(base, 0, { size: 80 })).toThrow("6–40");
    expect(() => setStyle(base, 0, { color: "#f00" as never })).toThrow("tokens");
  });
  it("campos dinâmicos e tabelas só do catálogo; resultado válido para o motor", () => {
    let b = insertField(base, 1, "Aluno", "aluno.nome");
    b = insertToken(b, 2, "escola.nome");
    b = insertTable(b, 3, "historico.anos", [{ label: "Ano", fact: "ano" }, { label: "Escola", fact: "escola" }]);
    expect(validateTemplate(b, DEFAULT_PAGE)).toEqual([]);
    expect(() => insertField(base, 0, "X", "inventado")).toThrow("catálogo");
    expect(() => insertTable(base, 0, "inventado", [{ label: "A", fact: "a" }])).toThrow("catálogo");
    expect(() => insertToken(base, 0, "x.y")).toThrow("catálogo");
  });
  it("cabeçalho e rodapé sem marcação, renderizados e escapados", () => {
    const b = setHeaderLines(base, ["Prefeitura", "Secretaria de Educação"]);
    expect(b[0]).toMatchObject({ type: "header" });
    const p = setFooter(DEFAULT_PAGE, "Rua X, 1 — {{escola.nome}}", true);
    const out = renderStudio({ title: "t", blocks: b, page: p, facts: {}, draftLabel: "RASCUNHO" });
    expect(out.html).toContain("Secretaria de Educação");
    expect(out.html).toContain("@bottom-center");
    expect(out.html).toContain("counter(pages)");
    expect(() => setHeaderLines(base, ["<script>"])).toThrow();
    expect(() => setFooter(DEFAULT_PAGE, "<b>x</b>", false)).toThrow();
  });
  it("paginação estimada A4: quebra explícita e texto longo abrem páginas", () => {
    expect(estimatePages(base, DEFAULT_PAGE).pages).toBe(1);
    expect(estimatePages([...base, { type: "page-break" }, ...base], DEFAULT_PAGE).pages).toBe(2);
    const long: StudioBlock[] = Array.from({ length: 60 }, () => ({ type: "rich", runs: [{ text: "x".repeat(400) }] }));
    expect(estimatePages(long, DEFAULT_PAGE).pages).toBeGreaterThan(3);
  });
  it("exportação fiel: prévia e impressão saem do mesmo render determinístico", () => {
    const a = renderStudio({ title: "t", blocks: base, page: DEFAULT_PAGE, facts: {}, draftLabel: null });
    const b = renderStudio({ title: "t", blocks: structuredClone(base), page: structuredClone(DEFAULT_PAGE), facts: {}, draftLabel: null });
    expect(a.html).toBe(b.html);
    expect(a.html).toMatch(/@page\{size:A4 portrait/);
  });
  it("rascunho local: só mesma conta/modelo, base mudada ⇒ desatualizado, sem dados de pessoa", () => {
    const d: LocalDraft = { schema: "sigem.studio-draft.v1", accountId: "u1", templateId: "m1", baseVersion: 2, savedAt: "", title: "t", blocks: base, page: DEFAULT_PAGE };
    const raw = serializeDraft(d);
    expect(recoverDraft(raw, "u1", "m1", 2).status).toBe("recuperavel");
    expect(recoverDraft(raw, "u1", "m1", 3).status).toBe("desatualizado");
    expect(recoverDraft(raw, "u2", "m1", 2).status).toBe("outra-conta");
    expect(recoverDraft("{x", "u1", "m1", 2).status).toBe("invalido");
    expect(recoverDraft(null, "u1", "m1", 2).status).toBe("nenhum");
  });
});
