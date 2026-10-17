import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HomeHospitalCarePanel } from "./home-hospital-care-panel";
import { OfficialLettersPage } from "./official-letters-page";
import { InfrequencyPage } from "./infrequency-page";
vi.mock("@/features/authority/own-school", () => ({ useOwnSchoolId: () => "inep-99999901" }));
vi.mock("@/features/units/current-school-names", () => ({ readCurrentSchoolNames: async () => new Map([["inep-99999901", "Escola de teste"]]) }));
vi.mock("@/integrations/supabase/client", () => {
 const builder = (): any => { const b: any = { then: (resolve: any) => Promise.resolve({ data: null, error: { message: "denied" } }).then(resolve) }; for (const name of ["select", "eq", "order", "range", "abortSignal"]) b[name] = () => b; return b; };
 return { supabase: { from: builder, rpc: builder } };
});
function mount(ui: React.ReactNode) { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>); return client; }
describe("falhas não são ausência de registros oficiais", () => {
 it("atendimento indisponível não afirma histórico vazio", async () => {
  const client = mount(<HomeHospitalCarePanel school="inep-99999901" student="teste" />);
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(screen.queryByText("Nenhum atendimento registrado.")).toBeNull(); cleanup(); client.clear();
 });
 it("ofícios indisponíveis não afirmam lista vazia", async () => {
  const client = mount(<OfficialLettersPage />);
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(screen.queryByText("Nenhum ofício emitido.")).toBeNull(); cleanup(); client.clear();
 });
 it("frequência indisponível não afirma ausência de alunos infrequentes", async () => {
  const client = mount(<InfrequencyPage />);
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(screen.queryByText("Nenhum aluno abaixo da frequência mínima neste período.")).toBeNull(); cleanup(); client.clear();
 });
});
