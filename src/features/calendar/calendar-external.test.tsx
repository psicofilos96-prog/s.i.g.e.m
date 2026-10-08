import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { buildImportPlan, referenceCalendars2027 } from "./calendar-browser-import";
import { buildPrintModel } from "./institutional-calendar-presentation";
import { InstitutionalPrintSheet } from "./institutional-calendar-print";
import { buildExternalViewModel, DEFAULT_TEMPLATE, defaultProfile, PRESENTATION_TEMPLATES, sanitizeProfile } from "./calendar-external-model";
import { MosaicSheet, PanoramicSheet } from "./calendar-external-sheets";
import { TemplateSelector } from "./calendar-external-panel";
import { externalRefusalText, parseExternalProfile } from "./calendar-external-profile";
import type { CalendarDayRead, DayDeclarationRow } from "./institutional-calendar-readers";

const row = (o: Partial<DayDeclarationRow>): DayDeclarationRow => ({
  declarationId: "d", declarationKind: "intervalo", dayState: "declarado", startsOn: null, endsOn: null, eventLabel: null, dayTypeId: "t",
  dayTypeVersionId: "tv-letivo", dayTypeVersion: 1, dayTypeLabel: "Letivo", schoolDayEffect: true, ...o,
} as DayDeclarationRow);
const day = (on: string, rows: DayDeclarationRow[] | null, state = "homologada"): CalendarDayRead => ({ on, state, rows });
const dates = (from: string, to: string) => { const o: string[] = []; for (let c = from; c <= to;) { o.push(c); const d = new Date(`${c}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); c = d.toISOString().slice(0, 10); } return o; };

const ref = referenceCalendars2027()[0]!;
const plan = buildImportPlan(ref);
const letivo = plan.types.find((t) => t.countsAsSchoolDay === true)!.code;
const feriado = Object.values(plan.presentation["dayTypeCatalog"] as Record<string, { code: string; kind: string }>).find((t) => t.kind === "feriado")!.code;
const presentation = { ...plan.presentation, year: 2028, title: "Calendário Regular", typeMap: { "tv-letivo": letivo, "tv-fer": feriado, "tv-x": "SEM-MAPA-NAO" }, coexistingEvents: { "2028-02-10": ["RP"] } };
// 2028 é bissexto; 01/02/2028 é terça.
const wk = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const days = [
  ...dates("2028-01-01", "2028-01-31").map((d) => day(d, [row(wk(d) % 6 === 0 ? { schoolDayEffect: false, dayTypeVersionId: "tv-fer", dayTypeLabel: "Fim", declarationKind: "intervalo" } : {})])),
  ...dates("2028-02-01", "2028-02-29").map((d) =>
    d === "2028-02-15" ? day(d, [row({}), row({ declarationId: "e", declarationKind: "evento", dayTypeVersionId: "tv-fer", schoolDayEffect: false, eventLabel: "Feriado X" })]) // conflito
    : d === "2028-02-20" ? day(d, null, "nao-homologado-na-data")
    : d === "2028-02-22" ? day(d, [row({ dayTypeVersionId: "tv-sem", dayTypeLabel: "Tipo Novo" })])
    : day(d, [row({})])),
];
const model = buildPrintModel(presentation, days, [{ name: "1º", startsOn: "2028-01-01", endsOn: "2028-01-31" }, { name: "2º", startsOn: "2028-02-01", endsOn: "2028-02-29" }]);
const vm = buildExternalViewModel(model, presentation);

describe("CAL.EXT.1 — uma verdade, três apresentações", () => {
  it("registry: cinco modelos, default interno", () => {
    expect(PRESENTATION_TEMPLATES.map((t) => t.code)).toEqual(["interno", "externo-panoramico", "externo-mosaico"]);
    expect(DEFAULT_TEMPLATE).toBe("interno");
  });
  it("modelo interno continua o mesmo renderer, sem dependência dos externos", () => {
    const src = readFileSync("src/features/calendar/institutional-calendar-print.tsx", "utf8");
    expect(src).not.toMatch(/calendar-external/);
    const a = render(<InstitutionalPrintSheet model={model} presentation={presentation} versionId="v" />).container.innerHTML;
    const b = render(<InstitutionalPrintSheet model={model} presentation={presentation} versionId="v" />).container.innerHTML;
    expect(a).toBe(b);
    expect(a).not.toMatch(/cx-/);
  });
  it("externos não chamam motor do laboratório nem gravam conteúdo", () => {
    for (const f of ["calendar-external-model.ts", "calendar-external-sheets.tsx", "calendar-external-panel.tsx"]) {
      const s = readFileSync(`src/features/calendar/${f}`, "utf8");
      expect(s).not.toMatch(/deriveCalendarProjection|resolveCalendar|calendar-engine|recordCalendarVersion|localStorage/);
    }
  });
  it("mesmo conjunto canônico de dias e mesmos totais", () => {
    expect(vm.days).toEqual(model.months.flatMap((m) => m.days));
    expect(vm.months.map((m) => m.total)).toEqual(model.months.map((m) => m.total));
    expect(vm.total).toEqual(model.total);
    expect(vm.periods).toEqual(model.periods);
    expect(vm.holidays).toEqual(model.holidays);
    expect(vm.legendCodes).toEqual(model.legendCodes);
  });
  it("indeterminado nunca vira zero nas três folhas", () => {
    expect(model.months[1]!.total.schoolDays).toBeNull();
    for (const El of [PanoramicSheet, MosaicSheet]) {
      render(<El vm={vm} p={defaultProfile("externo-panoramico")} presentation={presentation} />);
      expect(screen.getAllByTestId("cx-total-anual").at(-1)!.textContent).toBe("indeterminado");
    }
    const pan = render(<MosaicSheet vm={vm} p={defaultProfile("externo-mosaico")} presentation={presentation} />);
    expect(pan.container.querySelector('[data-testid="cx-total-2028-02"]')!.textContent).toBe("indeterminado");
    expect(pan.container.querySelector('[data-testid="cx-total-2028-01"]')!.textContent).toBe(String(model.months[0]!.total.schoolDays));
    expect(pan.container.querySelector('[data-date="2028-02-15"]')!.getAttribute("data-effect")).toBe("conflito");
  });
  it("tipo sem mapeamento visual aparece explicitamente", () => {
    expect(model.unmappedTypes).toContain("Tipo Novo");
    const r = render(<MosaicSheet vm={vm} p={defaultProfile("externo-mosaico")} presentation={presentation} />);
    expect(r.getAllByTestId("cx-unmapped").some((e) => e.textContent!.includes("Tipo Novo"))).toBe(true);
  });
  it("coexistência preservada", () => {
    const d = vm.days.find((x) => x.on === "2028-02-10")!;
    expect(d.extraCodes).toContain("RP");
    const r = render(<PanoramicSheet vm={vm} p={defaultProfile("externo-panoramico")} presentation={presentation} />);
    expect(r.container.querySelector('[data-date="2028-02-10"]')!.getAttribute("title")).toMatch(/\+/);
  });
  it("panorâmico (4×3): primeiro dia da semana e ano bissexto", () => {
    const fev = vm.months[1]!;
    expect(fev.daysInMonth).toBe(29);
    expect(fev.firstWeekday).toBe(2);
    expect(fev.weeks[0]!.slice(0, 3)).toEqual([null, null, 1]);
    const r = render(<PanoramicSheet vm={vm} p={defaultProfile("externo-panoramico")} presentation={presentation} />);
    expect(r.container.querySelectorAll('[data-month="2028-02"] td[data-date]').length).toBe(29);
    expect(r.container.querySelector('[data-date="2028-02-20"]')!.getAttribute("data-effect")).toBe("indeterminado");
  });
  it("mosaico (matriz): meses com menos de 31 dias têm células inexistentes, não dias", () => {
    const r = render(<MosaicSheet vm={vm} p={defaultProfile("externo-panoramico")} presentation={presentation} />);
    expect(r.container.querySelectorAll('[data-month="2028-02"] td.cx-inexistente').length).toBe(2);
    expect(r.container.querySelectorAll('[data-month="2028-01"] td.cx-inexistente').length).toBe(0);
  });
  it("personalização não muda conteúdo", () => {
    const p = sanitizeProfile("externo-panoramico", { primary: "#123456", visualTitle: "X", show: { totaisMensais: false }, symbolOverrides: { [letivo]: { background: "#00ff00" } } });
    const a = render(<PanoramicSheet vm={vm} p={defaultProfile("externo-panoramico")} presentation={presentation} />).container;
    const b = render(<PanoramicSheet vm={vm} p={p} presentation={presentation} />).container;
    const sig = (c: HTMLElement) => [...c.querySelectorAll("td[data-date]")].map((e) => `${e.getAttribute("data-date")}:${e.getAttribute("data-effect")}`).join();
    expect(sig(b)).toBe(sig(a));
    expect(buildExternalViewModel(model, presentation)).toEqual(vm);
  });
  it("perfil inválido cai no padrão; imagem/URL inválida recusada", () => {
    const p = sanitizeProfile("externo-mosaico", { coverImage: "data:image/svg+xml;base64,AAAA", qrUrl: "javascript:alert(1)", primary: "red", cardRadius: 99 });
    expect(p.coverImage).toBeNull(); expect(p.qrUrl).toBeNull(); expect(p.primary).toBe(defaultProfile("externo-mosaico").primary); expect(p.cardRadius).toBe(8);
    expect(sanitizeProfile("externo-mosaico", { coverImage: "data:image/png;base64," + "A".repeat(1_600_000) }).coverImage).toBeNull();
  });
  it("contrato do leitor e recusas do writer", () => {
    expect(parseExternalProfile("externo-mosaico", { contract: "cal-ext-1/1", state: "access-denied" }).kind).toBe("negado");
    expect(parseExternalProfile("externo-mosaico", { contract: "outro", state: "lido" }).kind).toBe("erro");
    expect(parseExternalProfile("externo-mosaico", { contract: "cal-ext-1/1", state: "padrao" }).kind).toBe("padrao");
    expect(externalRefusalText("calendar-external:base-superseded")).toMatch(/Recarregue/);
    expect(externalRefusalText("capability:construir-calendario-da-rede")).toMatch(/não permite/);
  });
  it("seletor acessível por nome, papel e teclado", () => {
    let v: string = "interno";
    render(<TemplateSelector value="interno" onChange={(x) => { v = x; }} />);
    const g = screen.getByRole("radiogroup", { name: "Modelo de apresentação" });
    expect(g).toBeTruthy();
    const mosaic = screen.getByRole("radio", { name: "Externo — Mosaico" });
    mosaic.focus(); fireEvent.click(mosaic);
    expect(v).toBe("externo-mosaico");
    expect(screen.getByRole("radio", { name: "Interno — Modelo técnico/oficial" }).getAttribute("aria-checked")).toBe("true");
  });
  it("célula não depende só de cor: texto acessível com efeito", () => {
    const r = render(<MosaicSheet vm={vm} p={defaultProfile("externo-mosaico")} presentation={presentation} />);
    expect(r.container.querySelector('[data-date="2028-02-15"]')!.getAttribute("aria-label")).toMatch(/conflito/);
  });
});
