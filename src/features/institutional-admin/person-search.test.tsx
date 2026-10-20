import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ status: "signed-in", ranges: [] as number[][], filters: [] as string[], error: false }));
vi.mock("@/features/authority/session-authority", () => ({ useSessionAuthority: () => ({ status: state.status }), sessionContextKey: () => "u1" }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => {
  let from = 0, to = 50;
  const chain = {
    select: () => chain, order: () => chain,
    or: (filter: string) => { state.filters.push(filter); return chain; },
    range: (a: number, b: number) => { from = a; to = b; state.ranges.push([a, b]); return chain; },
    abortSignal: () => Promise.resolve(state.error ? { data: null, error: { message: "internal-secret" } } : {
      data: Array.from({ length: to - from + 1 }, (_, i) => ({ id: `p${from + i}`, display_name: `Pessoa ${from + i}`, institutional_identifier: null })), error: null,
    }),
  };
  return chain;
} } }));
import { AdminPersonSearch, personSearchTerm } from "./person-search";
function mount(picker = false, excluded: string[] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AdminPersonSearch id="test" picker={picker} excluded={excluded} /></QueryClientProvider>);
}
afterEach(() => { cleanup(); state.ranges = []; state.filters = []; state.status = "signed-in"; state.error = false; });
describe("PERF.LOADING.1 — busca administrativa limitada", () => {
  it("primeira página pede 50 pessoas e uma linha de continuidade, não 11 mil", async () => {
    mount(); await waitFor(() => expect(state.ranges).toEqual([[0, 50]]));
    fireEvent.click(await screen.findByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(state.ranges).toEqual([[0, 50], [50, 100]]));
  });
  it("seletor espera busca, mantém escolha explícita e exclui contas vinculadas", async () => {
    mount(true, ["p1"]); expect(state.ranges).toEqual([]);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Pessoa" } });
    await screen.findByRole("option", { name: "Pessoa 0", exact: true });
    expect(screen.queryByRole("option", { name: "Pessoa 1", exact: true })).toBeNull();
    expect(state.filters[0]).toBe("display_name.ilike.%Pessoa%,institutional_identifier.ilike.%Pessoa%");
    expect(screen.getByRole("combobox")).toHaveValue("");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "p0" } });
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    await screen.findByRole("option", { name: "Pessoa 50", exact: true });
    expect(screen.getByRole("combobox")).toHaveValue("p0");
  });
  it("não lê durante confirmação de autoridade", () => {
    state.status = "loading"; mount(); expect(state.ranges).toEqual([]);
  });
  it("erro não vira vazio e nova tentativa recupera sem detalhe técnico", async () => {
    state.error = true; mount(); await screen.findByRole("alert");
    expect(screen.queryByText(/internal-secret/)).toBeNull();
    state.error = false; fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByText("Pessoa 0");
  });
  it("remove operadores e não consulta termos incompletos", () => {
    expect(personSearchTerm("a")).toBeNull();
    expect(personSearchTerm("ma%ria_,(x)")).toBe("%ma ria x%");
  });
});
