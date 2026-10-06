/**
 * CAL.EXT.1.2 — regressão do caminho real: lista → "Abrir" → "Apresentação e impressão" → seletor de modelos.
 * Os readers são simulados; o componente é o mesmo montado em CalendarWorkspacePage.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const version = { versionId: "ver-1", calendarId: "cal-inst", version: 2, validFrom: "2027-01-01", validTo: "2027-12-31",
  periodOrganizationId: null, lastHomologation: { decision: "homologada", effectiveFrom: "2027-01-01", recordId: "h" } };
vi.mock("./institutional-calendar-readers", async (orig) => ({
  ...(await orig<object>()),
  readCalendarList: vi.fn(async () => ({ kind: "lido", versions: [version, { ...version, versionId: "outro", calendarId: "cal-outro" }] })),
  readCalendarDays: vi.fn(async () => ({ kind: "lido", days: [] })),
}));
vi.mock("./institutional-calendar-presentation", async (orig) => ({
  ...(await orig<object>()),
  readPresentation: vi.fn(async () => ({ kind: "lido", snapshot: { presentation: { year: 2027, title: "Regular", document: { layout: {} } }, sourceKind: "edicao-institucional", sourceDigest: "x" } })),
}));
vi.mock("./institutional-calendar-councils", async (orig) => ({ ...(await orig<object>()), readCouncilConfiguration: vi.fn(async () => ({ kind: "nao-configurada" })) }));
vi.mock("./calendar-external-profile", async (orig) => ({ ...(await orig<object>()), readExternalProfile: vi.fn(async () => ({ kind: "negado" })) }));
vi.mock("@/features/curriculum/curricular-matrix-source", () => ({ loadAcademicYearOptions: vi.fn(async () => []), loadSchoolOptions: vi.fn(async () => []) }));
vi.mock("@/integrations/supabase/client", () => {
  const q = { select: () => q, lte: () => q, order: async () => ({ data: [], error: null }), then: (r: (v: unknown) => void) => r({ data: [], error: null }) };
  return { supabase: { from: () => q, rpc: vi.fn() } };
});

import { CalendarPresentationAccess } from "./institutional-calendar-management";

const mount = (canEdit: boolean) => render(
  <QueryClientProvider client={new QueryClient()}>
    <CalendarPresentationAccess contextKey="u#1" institutionalCalendarId="cal-inst" preferredVersionId="ver-1" canEdit={canEdit} />
  </QueryClientProvider>);

describe("CAL.EXT.1.2 — modelos visíveis no fluxo principal", () => {
  it("Supervisão: seletor visível, Interno padrão, Panorâmico em 1 clique, personalização disponível", async () => {
    mount(true);
    const group = await screen.findByRole("radiogroup", { name: "Modelo de apresentação" });
    const radios = Array.from(group.querySelectorAll("[role=radio]"));
    expect(radios.find((r) => r.getAttribute("aria-checked") === "true")?.textContent).toMatch(/Interno/);
    fireEvent.click(radios.find((r) => /Panor/.test(r.textContent ?? ""))!);
    await waitFor(() => expect(screen.getByText("Personalizar modelo externo")).toBeTruthy());
  });
  it("consulta/professor: vê os modelos, mas não ganha personalização (writer)", async () => {
    mount(false);
    const group = await screen.findByRole("radiogroup", { name: "Modelo de apresentação" });
    fireEvent.click(Array.from(group.querySelectorAll("[role=radio]")).find((r) => /Mosaico/.test(r.textContent ?? ""))!);
    await waitFor(() => expect(screen.getByText("Imprimir / PDF")).toBeTruthy());
    expect(screen.queryByText("Personalizar modelo externo")).toBeNull();
  });
  it("a tela aberta por “Abrir” monta a seção sem hash nem gestão institucional", () => {
    const src = readFileSync(resolve(__dirname, "calendar-pages.tsx"), "utf8");
    expect(src).toMatch(/Apresentação e impressão/);
    expect(src).toMatch(/<CalendarPresentationAccess[\s\S]*canEdit=\{!!supervision\}/);
  });
});
