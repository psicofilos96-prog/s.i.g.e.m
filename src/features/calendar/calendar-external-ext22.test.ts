import { describe, expect, it } from "vitest";
import { defaultProfile, sanitizeProfile } from "./calendar-external-model";

describe("CAL.EXT.2.2 — persistência de posição/zoom e tipografia", () => {
  const saved = { coverFocusX: 12, coverFocusY: 88, coverZoom: 180, coverOpacity: 40, pageImage: "data:image/png;base64,AAAA", pageFocusX: 20, pageFocusY: 75, pageZoom: 150, pageOpacity: 60,
    titleFont: defaultProfile("externo-mosaico").bodyFont, titlePt: 34, subtitlePt: 11, textScale: 1.1, typeScale: { legend: 1.3, holidays: 0.8 } };
  it("o que foi salvo volta igual depois de gravar e reler (ida e volta em JSON)", () => {
    const p = sanitizeProfile("externo-mosaico", JSON.parse(JSON.stringify(sanitizeProfile("externo-mosaico", saved))));
    expect([p.coverFocusX, p.coverFocusY, p.coverZoom, p.coverOpacity]).toEqual([12, 88, 180, 40]);
    expect([p.pageFocusX, p.pageFocusY, p.pageZoom, p.pageOpacity]).toEqual([20, 75, 150, 60]);
    expect([p.titlePt, p.subtitlePt, p.textScale, p.typeScale.legend, p.typeScale.holidays]).toEqual([34, 11, 1.1, 1.3, 0.8]);
    expect(p.titleFont).toBe(saved.titleFont);
  });
  it("perfil antigo sem os campos de fundo recebe o padrão; fora da faixa é limitado", () => {
    const old = sanitizeProfile("externo-mosaico", { coverZoom: 120 });
    expect([old.pageFocusX, old.pageFocusY, old.pageZoom, old.pageOpacity]).toEqual([50, 50, 100, 100]);
    const bad = sanitizeProfile("externo-mosaico", { pageZoom: 900, pageFocusX: -5, titleFont: "Comic Sans" });
    expect([bad.pageZoom, bad.pageFocusX]).toEqual([250, 0]);
    expect(bad.titleFont).toBe(defaultProfile("externo-mosaico").titleFont);
  });
});
