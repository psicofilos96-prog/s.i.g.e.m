import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  getSession: vi.fn(),
  from: vi.fn(),
  signals: [] as AbortSignal[],
  schools: [] as { id: string }[],
  identifiers: [] as unknown[],
  versions: [] as unknown[],
  hang: false,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getSession: () => state.getSession() },
  from: (table: string) => {
    state.from(table);
    let start = 0;
    let end = 999;
    const query = {
      select: () => query,
      order: () => query,
      range: (from: number, to: number) => { start = from; end = to; return query; },
      abortSignal: (signal: AbortSignal) => {
        state.signals.push(signal);
        if (state.hang) return new Promise<never>(() => {});
        const rows = table === "institutional_schools" ? state.schools : table === "institutional_school_identifiers" ? state.identifiers : state.versions;
        return Promise.resolve({ data: rows.slice(start, end + 1), error: null });
      },
    };
    return query;
  },
} }));
import { loadSchoolRegistryRows, unitListRows, useSchoolRegistry } from "./school-registry-source";
import { unitsFromRows } from "@/features/schools/school-registry";
import { LIST_TIMEOUT_MS } from "@/lib/server-page";

const session = { data: { session: { user: { id: "u" } } }, error: null };
const version = (n: number, name = "Atual", validFrom = "2026-01-01") => ({
  id: `v-${n}`, school_id: "escola", version_number: n, supersedes_version_id: null,
  official_name: name, address: null, district: null, location_kind: null, active: true,
  valid_from: validFrom, registered_at: "2026-01-01T12:00:00Z", originating_act_ref: null,
  justification: null, author_person_id: null, author_user_id: null, authorizing_engagement_id: null,
  capability_policy_id: null, capability_policy_version: null, phone: null, institutional_email: null,
  own_building: null, hard_access: null, classroom_count: null, administrative_dependency: null,
  private_school_category: null, partnership_public_authority: null,
});

beforeEach(() => {
  state.getSession.mockReset().mockResolvedValue(session);
  state.from.mockClear(); state.signals = []; state.hang = false;
  state.schools = [{ id: "escola" }];
  state.identifiers = [{ school_id: "escola", identifier_kind: "inep", value: "12345678" }];
  state.versions = [version(1)];
});
afterEach(() => vi.useRealTimers());

describe("cadastro de escolas completo, cancelável e temporal", () => {
  it("lê todas as páginas das três fontes", async () => {
    state.schools = Array.from({ length: 1001 }, (_, i) => ({ id: `escola-${i}` }));
    state.identifiers = Array.from({ length: 1001 }, (_, i) => ({ school_id: `escola-${i}`, identifier_kind: "inep", value: String(i) }));
    state.versions = Array.from({ length: 1501 }, (_, i) => version(i + 1));
    const rows = await loadSchoolRegistryRows();
    expect(rows?.schools).toHaveLength(1001);
    expect(rows?.identifiers).toHaveLength(1001);
    expect(rows?.versions).toHaveLength(1501);
    expect(state.from).toHaveBeenCalledTimes(6);
  });

  it("dado inválido não vira cadastro parcial", async () => {
    state.versions = [{ ...version(1), active: "sim" }];
    expect(await loadSchoolRegistryRows()).toBeNull();
  });

  it("sessão travada sai do carregamento no prazo técnico", async () => {
    vi.useFakeTimers();
    state.getSession.mockReturnValue(new Promise<never>(() => {}));
    const view = renderHook(() => useSchoolRegistry());
    await act(async () => { await vi.advanceTimersByTimeAsync(LIST_TIMEOUT_MS + 1); });
    expect(view.result.current.status).toBe("error");
    expect(state.from).not.toHaveBeenCalled();
    view.unmount();
  });

  it("falha na leitura da sessão não é confundida com uma sessão confirmada", async () => {
    state.getSession.mockResolvedValue({ ...session, error: new Error("auth indisponível") });
    const view = renderHook(() => useSchoolRegistry());
    await waitFor(() => expect(view.result.current.status).toBe("error"));
    expect(state.from).not.toHaveBeenCalled();
  });

  it("recarga nova não pode ser sobrescrita pela resposta antiga", async () => {
    let resolve!: (value: typeof session) => void;
    state.getSession.mockReturnValueOnce(new Promise<typeof session>((r) => { resolve = r; }));
    const view = renderHook(() => useSchoolRegistry());
    await waitFor(() => expect(state.getSession).toHaveBeenCalledTimes(1));
    act(() => view.result.current.reload());
    await waitFor(() => expect(view.result.current.status).toBe("ready"));
    state.versions = [version(1, "Antigo")];
    await act(async () => { resolve(session); });
    expect(view.result.current.status).toBe("ready");
    const current = view.result.current;
    if (current.status !== "ready") throw new Error("Cadastro não carregado");
    expect(current.units[0]?.versions[0]?.officialName).toBe("Atual");
    expect(state.from).toHaveBeenCalledTimes(3);
  });

  it("sair da tela cancela as consultas em andamento", async () => {
    state.hang = true;
    const view = renderHook(() => useSchoolRegistry());
    await waitFor(() => expect(state.signals).toHaveLength(3));
    view.unmount();
    expect(state.signals.every((signal) => signal.aborted)).toBe(true);
  });

  it("lista operacional só muda o nome quando começa a vigência", () => {
    const units = unitsFromRows([{ id: "escola" }], [], [version(1), version(2, "Futura", "2027-01-01")]);
    expect(unitListRows(units, "2026-10-24")[0]?.name).toBe("Atual");
    expect(unitListRows(units, "2027-01-01")[0]?.name).toBe("Futura");
  });
});
