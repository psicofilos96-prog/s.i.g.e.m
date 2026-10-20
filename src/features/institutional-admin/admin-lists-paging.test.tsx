import { cleanup, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

type Builder = {
  select: () => Builder;
  order: () => Builder;
  eq: () => Builder;
  limit: () => Builder;
  range: (from: number, to: number) => Promise<{ data: unknown[]; error: null }>;
  maybeSingle: () => Promise<{ data: unknown; error: null }>;
  then: Promise<{ data: unknown[]; error: null }>["then"];
};
const state = vi.hoisted(() => ({
  ranges: {} as Record<string, Array<[number, number]>>,
  rows: {} as Record<string, unknown[]>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    rpc: (name: string) =>
      Promise.resolve({
        data: name === "effective_scope_capabilities" ? [{ capability_id: "manter-atuacoes-institucionais" }] : null,
        error: null,
      }),
    from: (table: string): Builder => {
      const chain: Builder = {
        select: () => chain,
        order: () => chain,
        eq: () => chain,
        limit: () => chain,
        range: (from, to) => {
          (state.ranges[table] ??= []).push([from, to]);
          return Promise.resolve({ data: (state.rows[table] ?? []).slice(from, to + 1), error: null });
        },
        maybeSingle: () => Promise.resolve({ data: { state: "instalado" }, error: null }),
        then: (onOk, onErr) => Promise.resolve({ data: [], error: null }).then(onOk, onErr),
      };
      return chain;
    },
  },
}));
vi.mock("@/features/authority/session-authority", () => ({
  useSessionAuthority: () => ({ status: "signed-in", user: { id: "u1" }, sessionRevision: 1, capabilities: [{ capabilityId: "manter-atuacoes-institucionais" }] }),
  sessionContextKey: () => "k",
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => () => Promise.resolve([]) }));
vi.mock("@/features/institutional-admin/accounts.functions", () => ({
  createInstitutionalAccount: vi.fn(), listInstitutionalAccounts: vi.fn(),
  resetInstitutionalCredential: vi.fn(), createDesignatedActivatorAccount: vi.fn(),
}));
import { InstitutionalAdminPage } from "./institutional-admin-page";

const persons = Array.from({ length: 3 }, (_, i) => ({ id: `p${i}`, display_name: `P${i}`, institutional_identifier: null }));
const engagements = Array.from({ length: 1593 }, (_, i) => ({ id: `e${String(i).padStart(4, "0")}`, person_id: "p0", engagement_kind_id: "k", scope_level: "rede", school_id: null, valid_from: "2026-01-01", valid_until: null, originating_act_ref: null }));

afterEach(() => { cleanup(); state.ranges = {}; state.rows = {}; });

describe("PERF.LOADING.1 — listas da Administração leem além do corte de 1000 linhas", () => {
  it("atuações são lidas em páginas ordenadas até o fim (1593 linhas)", async () => {
    state.rows = { institutional_persons: persons, institutional_engagements: engagements };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><InstitutionalAdminPage /></QueryClientProvider>);
    await waitFor(() => expect(state.ranges["institutional_engagements"]).toEqual([[0, 999], [1000, 1999]]));
    expect(state.ranges["institutional_persons"]).toBeUndefined();
  });
});
