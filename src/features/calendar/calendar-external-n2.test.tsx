import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { richFixture } from "./calendar-external-rich-fixture";
import { buildPrintModel } from "./institutional-calendar-presentation";
import { externalPresentation } from "./calendar-visual-resolver";
import { buildExternalViewModel, columnTotals, defaultProfile, sanitizeBands, sanitizeProfile } from "./calendar-external-model";
import { MosaicSheet, PanoramicSheet } from "./calendar-external-sheets";

const f = richFixture();
const pres = externalPresentation(f.presentation);
const vm = buildExternalViewModel(buildPrintModel(pres, f.days, f.periods), pres, { versionId: "ver-rica", config: f.council, days: f.days });

describe("N2 — fidelidade aos prompts-guia (só apresentação)", () => {
  it("faixas verticais do perfil somam 100% e respeitam os padrões dos guias", () => {
    expect(defaultProfile("externo-livre", pres).bands).toEqual({ banner: 17, body: 59, info: 15, footer: 9 });
    const b = sanitizeBands({ banner: 40, info: 2, footer: 30 }, defaultProfile("externo-livre", pres).bands);
    expect(b.banner + b.body + b.info + b.footer).toBe(100);
    expect(b.banner).toBe(25);
  });
  it("Mosaico: total por coluna soma o total anual do motor (200) e 12 linhas idênticas", () => {
    const cols = columnTotals(vm.months);
    expect(cols.every((c) => c !== null)).toBe(true);
    expect(cols.reduce<number>((a, c) => a + (c ?? 0), 0)).toBe(vm.total.schoolDays);
    const r = render(<MosaicSheet vm={vm} p={defaultProfile("externo-livre", pres)} presentation={pres} />);
    expect(r.container.querySelectorAll("tbody tr[data-month]").length).toBe(12);
    expect(r.container.querySelectorAll("tbody tr[data-month] td.cx-dia, tbody tr[data-month] td.cx-inexistente").length).toBe(12 * 31);
    expect(r.container.querySelectorAll(".cx-faixa-txt").length).toBeGreaterThan(0);
  });
  it("legenda vem da mesma tabela das células: todo código pintado tem item", () => {
    const r = render(<MosaicSheet vm={vm} p={defaultProfile("externo-livre", pres)} presentation={pres} />);
    const legend = r.container.querySelector('[data-cx-bloco="legenda"]')!.textContent!;
    expect(legend).toContain("Férias");
    expect(legend).toContain("Sábado / Domingo");
  });
  it.skip("[removido em 0258: só existe o modelo externo livre] Panorâmico: 12 cartões com 6 semanas fixas, número do mês e 3 caixas de informação", () => {
    const r = render(<PanoramicSheet vm={vm} p={defaultProfile("externo-livre", pres)} presentation={pres} />);
    const cards = r.container.querySelectorAll(".cx-cartao");
    expect(cards.length).toBe(12);
    cards.forEach((c) => expect(c.querySelectorAll("tbody tr").length).toBe(6));
    expect(r.container.querySelector(".cx-mes-num")!.textContent).toBe("01");
    expect([...r.container.querySelectorAll(".cx-info > [data-cx-bloco]")].map((e) => e.getAttribute("data-cx-bloco"))).toEqual(["legenda", "periodos", "feriados"]);
  });
  it("perfil inválido nunca quebra a folha", () => {
    const p = sanitizeProfile("externo-livre", { titlePt: 999, scriptFont: "x", pillars: [{ title: 3 }], accent: "red" }, pres);
    expect(p.titlePt).toBe(40); expect(p.scriptFont).toContain("Caveat"); expect(p.accent).toBe("#1565C0");
  });
});
