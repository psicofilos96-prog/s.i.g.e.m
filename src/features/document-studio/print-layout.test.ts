import { describe, expect, it } from "vitest";
import { renderStudio, DEFAULT_PAGE } from "./studio-engine";

describe("NPRINT.FINAL.1 — rodapé e assinaturas", () => {
  const r = renderStudio({ title: "t", blocks: [{ type: "signature", label: "A" }], page: { ...DEFAULT_PAGE, footerText: "Rodapé {{escola.nome}}" }, facts: { "escola.nome": "E'</style>" }, draftLabel: null });
  it("rodapé fica na margem da página, não sobre o conteúdo", () => {
    expect(r.html).toContain("@bottom-center");
    expect(r.html).not.toContain('<footer class="rod">');
  });
  it("valor no rodapé não fecha o estilo", () => {
    expect(r.html.match(/<\/style>/g)?.length).toBe(1);
  });
});
