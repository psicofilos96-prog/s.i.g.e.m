import { describe, expect, it } from "vitest";
import { guideSnap, moveLayer, resolveLayerText, sanitizeLayers } from "./calendar-external-layers";
import { premiumLayers, premiumLayout } from "./calendar-external-premium";
import { defaultFreeLayout, layoutIssues } from "./calendar-external-free";

describe("camadas do calendário externo", () => {
  it("texto só puxa o ano do calendário; sem ano não inventa número", () => {
    expect(resolveLayerText("CALENDÁRIO ESCOLAR {ano}", { year: 2027, title: null, subtitle: null })).toEqual([{ t: "CALENDÁRIO ESCOLAR ", accent: false }, { t: "2027", accent: true }]);
    expect(resolveLayerText("CALENDÁRIO {ano}", { year: null, title: null, subtitle: null }).map((p) => p.t).join("")).toBe("CALENDÁRIO ");
  });
  it("recusa imagem de endereço externo", () => {
    expect(sanitizeLayers([{ kind: "imagem", id: "a", src: "https://x.com/a.png", x: 0, y: 0, w: 10, h: 10 }], [], 1e6)).toEqual([]);
  });
  it("modelo premium sobrevive à leitura e não sobrepõe blocos de dados", () => {
    expect(sanitizeLayers(premiumLayers(), ["'Playfair Display', Georgia, serif", "'Montserrat', 'Segoe UI', sans-serif"], 1e6)).toHaveLength(premiumLayers().length);
    expect(layoutIssues(premiumLayout(defaultFreeLayout("fotografico"))).overlaps).toEqual([]);
  });
  it("guia encaixa a borda a 1 mm e camada travada não se move", () => {
    expect(guideSnap(99, 10, [100])).toBe(100);
    const l = premiumLayers().map((x) => (x.id === "titulo" ? { ...x, locked: true } : x));
    expect(moveLayer(l, "titulo", { x: 0 }, { snap: true, stepMm: 1 }).find((x) => x.id === "titulo")!.x).toBe(30);
  });
});
