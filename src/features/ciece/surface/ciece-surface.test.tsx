/** 14.4L — Superfícies do CIECE. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { CieceWorkspace } from "./ciece-workspace";
import { LAB_CATALOG, LAB_CLASS_A, LAB_CLASS_B, createLaboratorySource, laboratoryAvailable } from "./ciece-laboratory";
import { STATE_PRESENTATION, formatValue, groupStateId } from "./ciece-presentation";
import type { CieceCatalog } from "./ciece-surface-types";

const dir = __dirname;
const UI = ["ciece-workspace.tsx", "ciece-presentation.ts", "ciece-surface-types.ts"].map((f) => readFileSync(join(dir, f), "utf8"));
const LAB = readFileSync(join(dir, "ciece-laboratory.ts"), "utf8");
const ROUTES = ["ciece.tsx", "laboratorio.ciece.tsx"].map((f) => readFileSync(join(dir, "../../../routes", f), "utf8"));
const ALL = [...UI, LAB, ...ROUTES];
const REF = { at: "2026-09-01", cycleId: "c", periodId: "p" };

function mount(catalog: CieceCatalog = LAB_CATALOG) {
  const source = createLaboratorySource();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(<QueryClientProvider client={qc}><CieceWorkspace source={source} catalog={catalog} initialReference={REF} /></QueryClientProvider>);
  return { source, ...utils };
}
const card = (name: string) => screen.getByRole("article", { name });

describe("14.4 — fronteira e ausência de cálculo", () => {
  it("1–3. nenhuma tela usa fatos, motor ou carregador; consulta institucional passa por queryCieceIndicator", () => {
    for (const s of ALL) {
      expect(s).not.toMatch(new RegExp(["canonical-fact-types", "CanonicalFact\\b", "indicator" + "-engine", "compute" + "Indicator", "fact" + "-loader", "fact-adapters"].join("|")));
    }
    expect(ROUTES[0]).toMatch(/queryCieceIndicator/);
  });
  it("4. nenhum componente calcula taxa, percentual ou contagem", () => {
    for (const s of UI) expect(s).not.toMatch(/\*\s*100|\/\s*100|\.reduce\(|numerator\s*\/|\/\s*denominator/);
  });
  it("19–20. nenhuma comparação temporal inventada; nenhuma regra de divulgação reproduzida", () => {
    for (const s of UI) {
      expect(s).not.toMatch(/melhorou|piorou|varia[çc][ãa]o|TrendingUp|TrendingDown|ArrowUp|ArrowDown/i);
      expect(s).not.toMatch(/minimumGroupSize|smallGroupTreatment|complementarySuppression|provenanceLevel/);
    }
  });
  it("17. laboratório nunca toca o banco", () => {
    expect(LAB).not.toMatch(/supabase|createServerFn|fetch\(/);
  });
  it("16. laboratório indisponível com login", () => {
    expect(laboratoryAvailable({ loading: false, user: { id: "u" } })).toBe(false);
    expect(laboratoryAvailable({ loading: true, user: null })).toBe(false);
    expect(laboratoryAvailable({ loading: false, user: null })).toBe(true);
  });
});

describe("14.4 — estados", () => {
  it("5–7. zero, ausência, população vazia e indeterminado são distintos", () => {
    const labels = new Set(Object.values(STATE_PRESENTATION).map((p) => p.label));
    expect(labels.size).toBe(Object.keys(STATE_PRESENTATION).length);
    const markers = new Set(Object.values(STATE_PRESENTATION).map((p) => p.marker));
    expect(markers.size).toBe(Object.keys(STATE_PRESENTATION).length);
    expect(formatValue(0, "%")).toBe("0%");
    expect(formatValue(null, "%")).toBeNull();
    const base = { groupKey: null, numerator: null, denominator: null, coverage: null, absentSubjects: 0, notApplicableSubjects: 0, indeterminateSubjects: 0 };
    expect(groupStateId({ ...base, state: "calculado", value: 0 })).toBe("zero-observado");
    expect(groupStateId({ ...base, state: "calculado", value: null })).toBe("calculado");
  });

  it("5–9. a tela exibe cada estado de forma diferente e cobertura incompleta é informada", async () => {
    mount();
    await waitFor(() => expect(within(card("Percentual de estudantes numa situação declarada")).getByText("0%")).toBeTruthy());
    expect(within(card("Percentual de estudantes numa situação declarada")).getByText("Zero observado")).toBeTruthy();
    expect(within(card("Turmas com encerramento oficial no ciclo")).getAllByText("Sem população no recorte").length).toBeGreaterThan(0);
    expect(within(card("Turmas com encerramento oficial no ciclo")).queryByTestId("ciece-value")).toBeNull();
    const taxa = card("Taxa de presença sobre aulas aplicáveis no período");
    expect(within(taxa).getByText("Cobertura incompleta")).toBeTruthy();
    expect(within(taxa).getByText(/com registro: 24 · cobertura incompleta/)).toBeTruthy();
  });

  it("7. turma B mostra indeterminado, sem registro, recusa e divulgação sem regra", async () => {
    mount({ ...LAB_CATALOG, scopes: LAB_CATALOG.scopes.filter((s) => s.classId === LAB_CLASS_B) });
    await waitFor(() => expect(within(card("Estudantes enturmados na data")).getAllByText("Indeterminado").length).toBeGreaterThan(0));
    expect(within(card("Estudantes por situação acadêmica oficial")).getAllByText("Nenhum registro disponível").length).toBeGreaterThan(0);
    expect(within(card("Taxa de presença sobre aulas aplicáveis no período")).getByText("Cálculo recusado")).toBeTruthy();
    expect(within(card("Turmas com encerramento oficial no ciclo")).getByText("Divulgação sem regra homologada")).toBeTruthy();
    expect(within(card("Percentual de estudantes numa situação declarada")).getByText("Não divulgável")).toBeTruthy();
  });
});

describe("14.4 — drill-down", () => {
  it("11, 9–10, 12. decomposição é nova consulta; suprimidos não vazam; recusa não apaga o agregado", async () => {
    const { source } = mount({ ...LAB_CATALOG, scopes: LAB_CATALOG.scopes.filter((s) => s.classId === LAB_CLASS_A) });
    await waitFor(() => expect(within(card("Estudantes por situação acadêmica oficial")).getByText("30")).toBeTruthy());
    const aggCard = card("Estudantes por situação acadêmica oficial");
    const before = source.calls.length;
    fireEvent.click(within(card("Estudantes por situação acadêmica oficial")).getByRole("button", { name: /Como este número/ }));
    await waitFor(() => expect(source.calls.length).toBeGreaterThan(before));
    fireEvent.click(await screen.findByRole("button", { name: /Decompor por situação/ }));
    await waitFor(() => expect(source.calls.some((c) => c.groupBy === "situacaoAcademicaId")).toBe(true));
    const row = await screen.findByTestId("group-reprovado");
    expect(row.textContent).not.toMatch(/\d/);
    expect(within(row).getAllByText("Suprimido").length).toBeGreaterThan(0);
    // 13. proveniência restrita
    fireEvent.click(screen.getByRole("button", { name: "Consultar proveniência" }));
    await waitFor(() => expect(source.calls.some((c) => c.wantProvenance)).toBe(true));
    const prov = await screen.findByTestId("ciece-provenance");
    await waitFor(() => expect(within(prov).getByText("Sem autorização")).toBeTruthy());
    expect(within(aggCard).getByText("30")).toBeTruthy();
  });

  it("13. proveniência autorizada mostra só referências institucionais", async () => {
    mount({ ...LAB_CATALOG, scopes: LAB_CATALOG.scopes.filter((s) => s.classId === LAB_CLASS_A) });
    await waitFor(() => expect(within(card("Estudantes enturmados na data")).getByText("30")).toBeTruthy());
    fireEvent.click(within(card("Estudantes enturmados na data")).getByRole("button", { name: /Como este número/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Consultar proveniência" }));
    const prov = await screen.findByTestId("ciece-provenance");
    await waitFor(() => expect(within(prov).getByText(/lab-registro-001/)).toBeTruthy());
    expect(prov.textContent).not.toMatch(/studentId/);
  });
});

describe("14.4 — filtros", () => {
  it("14. sem dimensão declarada, nenhuma decomposição é oferecida", async () => {
    mount({ ...LAB_CATALOG, decomposableDimensions: [], scopes: LAB_CATALOG.scopes.slice(0, 1) });
    await waitFor(() => expect(within(card("Estudantes enturmados na data")).getByText("30")).toBeTruthy());
    fireEvent.click(within(card("Estudantes enturmados na data")).getByRole("button", { name: /Como este número/ }));
    expect(await screen.findByText("Nenhuma decomposição está disponível neste escopo.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Decompor/ })).toBeNull();
  });
  it("15. consultas só usam turmas do escopo publicado; sem escopo não há consulta", async () => {
    const { source } = mount();
    await waitFor(() => expect(source.calls.length).toBeGreaterThan(0));
    const allowed = new Set(LAB_CATALOG.scopes.map((s) => s.classId));
    expect(source.calls.every((c) => allowed.has(c.filters.classId))).toBe(true);
    const empty = mount({ ...LAB_CATALOG, scopes: [] });
    expect(empty.source.calls.length).toBe(0);
  });
  it("18. a explicação apresenta apenas o recibo recebido", () => {
    expect(UI[0]).toMatch(/total\.numerator \?\?/);
    expect(UI[0]).not.toMatch(/eligibleSubjects|factRefs/);
  });
});
