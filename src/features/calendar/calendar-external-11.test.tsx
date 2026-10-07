import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { buildPrintModel } from "./institutional-calendar-presentation";
import { buildExternalViewModel, councilsOf, defaultProfile, inheritedLogos, sanitizeProfile } from "./calendar-external-model";
import { MosaicSheet, PanoramicSheet } from "./calendar-external-sheets";
import { qrModules } from "./calendar-external-qr";
import type { CalendarDayRead, DayDeclarationRow } from "./institutional-calendar-readers";
import type { CouncilConfiguration } from "./institutional-calendar-councils";

const row = (o: Partial<DayDeclarationRow>): DayDeclarationRow => ({
  dayState: "declarado", versionId: "ver-1", referenceIssue: null, homologationState: "homologada", declarationKind: "intervalo",
  declarationId: "d", startsOn: null, endsOn: null, eventLabel: null, dayTypeId: "tipo-letivo", dayTypeVersionId: "tv-letivo",
  dayTypeVersion: 1, dayTypeLabel: "Letivo", schoolDayEffect: true, ...o,
});
const days: CalendarDayRead[] = [
  { on: "2027-04-01", state: "homologada", rows: [row({})] },
  { on: "2027-04-02", state: "homologada", rows: [row({}), row({ declarationId: "e1", declarationKind: "evento", dayTypeId: "tipo-cc", dayTypeLabel: "Conselho", eventLabel: "1º Conselho de Classe" })] },
  { on: "2027-04-03", state: "homologada", rows: [row({ versionId: "outra", declarationId: "e2", dayTypeId: "tipo-cc" })] },
];
const cfg = (c: CouncilConfiguration) => ({ versionId: "ver-1", config: c, days });
const logo = (id: string, label: string, source: unknown, position = "esquerda") => ({ id, label, source, visible: true, position, unit: "px", keepRatio: true, fit: "contain" });
const presentation: Record<string, unknown> = {
  year: 2027, title: "Calendário Regular",
  // catálogo com councilRole: proposta da fonte, NUNCA decisão
  dayTypeCatalog: { CC: { code: "CC", label: "Conselho", kind: "evento", councilRole: "conselho-de-classe" } }, typeMap: { "tv-letivo": "CC" },
  document: { headerLines: ["PREFEITURA MUNICIPAL", "SECRETARIA MUNICIPAL DE EDUCAÇÃO"],
    layout: { logos: [logo("logo-brasao", "Brasão", { kind: "identity", identityKind: "municipal-coat-of-arms" }), logo("logo-x", "Sem imagem", { kind: "none" }, "direita")] } },
};
const model = buildPrintModel(presentation, days, []);

describe("CAL.EXT.1.1 — conselhos pela configuração explícita da versão", () => {
  it("a) dayTypeId configurado encontra a data correta (só da própria versão)", () => {
    const c = councilsOf(cfg({ kind: "configurada", declaresNone: false, actRef: "a", roles: [{ dayTypeId: "tipo-cc", role: "conselho-de-classe", sourceProposal: null }] }));
    expect(c).toEqual({ state: "configurada", items: [{ on: "2027-04-02", name: "1º Conselho de Classe", role: "conselho-de-classe" }] });
  });
  it("b) não configurada ≠ nenhum", () => {
    expect(councilsOf(cfg({ kind: "nao-configurada" })).state).toBe("nao-configurada");
    const html = render(<PanoramicSheet vm={buildExternalViewModel(model, presentation, cfg({ kind: "nao-configurada" }))} p={{ ...defaultProfile("externo-panoramico", presentation), show: { ...defaultProfile("externo-panoramico", presentation).show, conselhos: true } }} presentation={presentation} />).container.innerHTML;
    // N2: no Panorâmico o bloco de conselhos é opcional (guia: 3 caixas); quando ligado, o estado continua explícito.
    expect(html).toMatch(/Conselhos de Classe não configurados para esta versão/);
  });
  it("c) declaresNone = nenhum declarado; negado/malformado explícitos", () => {
    expect(councilsOf(cfg({ kind: "configurada", declaresNone: true, actRef: "a", roles: [] })).state).toBe("nenhum-declarado");
    expect(councilsOf(cfg({ kind: "acesso-negado" })).state).toBe("acesso-negado");
    expect(councilsOf(cfg({ kind: "malformada", reason: "x" })).state).toBe("malformada");
    expect(councilsOf(null).state).toBe("nao-lida");
  });
  it("d) councilRole da apresentação sozinho não cria conselho", () => {
    expect(buildExternalViewModel(model, presentation).councils.state).toBe("nao-lida");
    const c = councilsOf(cfg({ kind: "configurada", declaresNone: false, actRef: "a", roles: [{ dayTypeId: "tipo-inexistente", role: "r", sourceProposal: "conselho-de-classe" }] }));
    expect(c).toEqual({ state: "configurada", items: [] });
  });
});

describe("CAL.EXT.1.1 — QR real", () => {
  it("com URL existe SVG QR; sem URL não existe", () => {
    const vm = buildExternalViewModel(model, presentation);
    const p = sanitizeProfile("externo-mosaico", { qrUrl: "https://sigem.example/cal" }, presentation);
    const a = render(<MosaicSheet vm={vm} p={p} presentation={presentation} />).container;
    expect(a.querySelector("[data-testid=cx-qr-svg] path")?.getAttribute("d")?.length).toBeGreaterThan(100);
    expect(a.textContent).toContain("https://sigem.example/cal");
    const b = render(<MosaicSheet vm={vm} p={defaultProfile("externo-mosaico", presentation)} presentation={presentation} />).container;
    expect(b.querySelector("[data-testid=cx-qr-svg]")).toBeNull();
  });
  it("matriz QR determinística com padrões de posição", () => {
    const m = qrModules("https://sigem.example/cal");
    expect(m).toEqual(qrModules("https://sigem.example/cal"));
    expect(m.length).toBeGreaterThanOrEqual(21);
    expect(m[0]!.slice(0, 7).every(Boolean)).toBe(true); // finder superior esquerdo
  });
});

describe("CAL.EXT.1.1 — identidade institucional herdada", () => {
  it("padrão herda cabeçalho e logos do snapshot; restaurar volta à herança", () => {
    const d = defaultProfile("externo-panoramico", presentation);
    expect(d.logos.map((l) => l.ref)).toEqual(["logo-brasao", "logo-x"]);
    expect(sanitizeProfile("externo-panoramico", { primary: "#123456" }, presentation).logos).toEqual(inheritedLogos(presentation));
    const box = render(<PanoramicSheet vm={buildExternalViewModel(model, presentation)} p={d} presentation={presentation} />).container;
    const html = box.innerHTML;
    expect(box.querySelector(".cx-ident-txt")!.textContent).toContain("SECRETARIA MUNICIPAL DE EDUCAÇÃO");
    expect(html).toMatch(/data-logo-ref="logo-brasao"/);
    expect(html).not.toMatch(/data-logo-ref="logo-x"/); // sem imagem resolvível: não inventada (editor sinaliza)
  });
  it("mudar perfil externo não muda presentation.document.layout.logos", () => {
    const before = JSON.stringify(presentation);
    const p = defaultProfile("externo-mosaico", presentation);
    p.logos[0]!.hidden = true; p.logos.reverse(); p.logos[0]!.position = "direita";
    sanitizeProfile("externo-mosaico", p, presentation);
    render(<MosaicSheet vm={buildExternalViewModel(model, presentation)} p={p} presentation={presentation} />);
    expect(JSON.stringify(presentation)).toBe(before);
  });
});
