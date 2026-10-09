import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE, canTransition, freezeEmission, projectStates, renderStudio, unresolvableTokens, validateTemplate, verifyFrozen, type StudioBlock } from "./studio-engine";
import { BASE_TEMPLATES, DRAFT_LABEL } from "./base-templates";
import { ACERVO, SECRETARIAT_WITHOUT_OFFICIAL_MODEL } from "./acervo";

describe("studio — segurança", () => {
  it("recusa marcação HTML no texto", () => {
    const b: StudioBlock[] = [{ type: "title", text: "<script>x</script>" }];
    expect(validateTemplate(b, DEFAULT_PAGE).map((i) => i.code)).toContain("markup-forbidden");
  });
  it("recusa token fora do catálogo (nada de SQL)", () => {
    const b: StudioBlock[] = [{ type: "rich", runs: [{ text: "{{select.from}}" }] }];
    expect(validateTemplate(b, DEFAULT_PAGE).map((i) => i.code)).toContain("token-unknown:select.from");
  });
  it("escapa valores de fatos", () => {
    const r = renderStudio({ title: "t", page: DEFAULT_PAGE, draftLabel: null, blocks: [{ type: "field", label: "Nome", fact: "aluno.nome" }], facts: { "aluno.nome": "<b>x</b>" } });
    expect(r.html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(r.html).not.toContain("<b>x</b>");
  });
  it("imagem só de ativo ou https", () => {
    const b: StudioBlock[] = [{ type: "image", asset: "javascript:alert(1)", width: 50, alt: "a" }];
    expect(validateTemplate(b, DEFAULT_PAGE).map((i) => i.code)).toContain("image-source-not-allowed");
  });
});

describe("studio — ausência", () => {
  it("fato ausente nunca vira zero", () => {
    const r = renderStudio({ title: "t", page: DEFAULT_PAGE, draftLabel: null, blocks: [{ type: "field", label: "Turma", fact: "turma.rotulo" }], facts: {} });
    expect(r.missing).toEqual(["turma.rotulo"]);
    expect(r.html).toContain("sem registro");
  });
});

describe("ciclo de vida", () => {
  const vs = [{ id: "v1", supersedes: null }, { id: "v2", supersedes: "v1" }];
  it("homologar a sucessora substitui a anterior", () => {
    const s = projectStates(vs, [
      { versionId: "v1", kind: "enviar-revisao", at: "1", actor: "a" }, { versionId: "v1", kind: "homologar", at: "2", actor: "b" },
      { versionId: "v2", kind: "enviar-revisao", at: "3", actor: "a" }, { versionId: "v2", kind: "homologar", at: "4", actor: "b" }]);
    expect(s).toEqual({ v1: "substituido", v2: "homologado" });
  });
  it("rascunho não é homologado direto", () => {
    expect(projectStates(vs, [{ versionId: "v1", kind: "homologar", at: "1", actor: "b" }]).v1).toBe("rascunho");
  });
  it("autor não homologa a própria versão", () => {
    expect(canTransition("em-revisao", "homologar", true)).toBe(false);
    expect(canTransition("em-revisao", "homologar", false)).toBe(true);
  });
});

describe("emissão congelada", () => {
  const blocks: StudioBlock[] = [{ type: "field", label: "Nome", fact: "aluno.nome" }];
  const base = { templateId: "t", versionId: "v1", versionNo: 1, blocks, page: DEFAULT_PAGE, facts: { "aluno.nome": "A" }, issuedAt: "2026-10-09T00:00:00Z", actor: "p1" };
  it("só modelo homologado emite", async () => {
    await expect(freezeEmission({ ...base, state: "rascunho" })).rejects.toThrow("template-not-homologated");
  });
  it("token sem reader autorizado recusa", async () => {
    await expect(freezeEmission({ ...base, state: "homologado", blocks: [{ type: "field", label: "R", fact: "responsavel.nome" }] })).rejects.toThrow("token-without-reader:responsavel.nome");
  });
  it("hash confere e alterar o modelo depois não altera o emitido", async () => {
    const e = await freezeEmission({ ...base, state: "homologado" });
    blocks.push({ type: "line" });
    expect(e.blocks).toHaveLength(1);
    expect(await verifyFrozen(e)).toBe(true);
    expect(await verifyFrozen({ ...e, facts: { "aluno.nome": "B" } })).toBe(false);
  });
});

describe("modelos-base", () => {
  it("todos validam e documentos da Secretaria sem modelo oficial existem como base", () => {
    for (const t of BASE_TEMPLATES) expect(validateTemplate(t.blocks, t.page), t.id).toEqual([]);
    for (const id of SECRETARIAT_WITHOUT_OFFICIAL_MODEL) expect(BASE_TEMPLATES.some((t) => t.id === id && t.source === null)).toBe(true);
    expect(DRAFT_LABEL).toBe("Rascunho institucional — não homologado");
  });
  it("transferência depende de reader ainda inexistente", () => {
    expect(unresolvableTokens(BASE_TEMPLATES.find((t) => t.id === "transferencia")!.blocks)).toEqual(["transferencia.destino"]);
  });
  it("acervo referencia só modelos existentes", () => {
    for (const a of ACERVO) if (a.studioTemplate) expect(BASE_TEMPLATES.some((t) => t.id === a.studioTemplate), a.file).toBe(true);
  });
});
