import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as unknown[],
  failFrom: -1,
  repeat: false,
  from: vi.fn(),
  pages: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => {
      state.from(...args);
      let ids: string[] | undefined;
      let offset = 0;
      let end = 999;
      const order: string[] = [];
      const query = {
        select: () => query,
        in: (_column: string, values: string[]) => { ids = values; return query; },
        order: (column: string) => { order.push(column); return query; },
        range: (from: number, to: number) => { offset = from; end = to; return query; },
        abortSignal: async (signal: AbortSignal) => {
          state.pages({ offset, end, ids, order, signal });
          if (offset === state.failFrom) return { data: null, error: { message: "falha na segunda página" } };
          const rows = ids ? state.rows.filter((row) => ids!.includes((row as { school_id: string }).school_id)) : state.rows;
          return { data: state.repeat ? rows : rows.slice(offset, end + 1), error: null };
        },
      };
      return query;
    },
  },
}));
import { readCurrentSchoolNames } from "./current-school-names";

const row = (version: number, school = "escola-a") => ({ school_id: school, official_name: `Escola versão ${version}`, version_number: version, valid_from: "2020-01-01" });
beforeEach(() => { state.rows = []; state.failFrom = -1; state.repeat = false; state.from.mockClear(); state.pages.mockClear(); });

describe("leitura completa dos nomes vigentes das escolas", () => {
  it("resolve a versão vigente além da milésima linha", async () => {
    state.rows = Array.from({ length: 1501 }, (_, i) => row(i + 1));
    expect((await readCurrentSchoolNames(undefined, "2026-10-24")).get("escola-a")).toBe("Escola versão 1501");
    expect(state.pages.mock.calls.map(([page]) => page.offset)).toEqual([0, 1000]);
    expect(state.pages.mock.calls[0]![0].order).toEqual(["school_id", "version_number"]);
  });

  it("lista vazia de escolas não consulta o banco", async () => {
    expect(await readCurrentSchoolNames([])).toEqual(new Map());
    expect(state.from).not.toHaveBeenCalled();
  });

  it("mantém o filtro da escola, sem repetir identificadores", async () => {
    state.rows = [row(1), row(2, "escola-b")];
    expect([...await readCurrentSchoolNames(["escola-a", "escola-a"])]).toEqual([["escola-a", "Escola versão 1"]]);
    expect(state.pages.mock.calls[0]![0].ids).toEqual(["escola-a"]);
  });

  it("falha de página posterior não retorna nome antigo como atual", async () => {
    state.rows = Array.from({ length: 1001 }, (_, i) => row(i + 1));
    state.failFrom = 1000;
    await expect(readCurrentSchoolNames()).rejects.toThrow("falha na segunda página");
  });

  it("resposta inválida é recusada sem mostrar seu conteúdo", async () => {
    state.rows = [{ ...row(1), version_number: "inválida" }];
    await expect(readCurrentSchoolNames()).rejects.toThrow("shape:invalid current-school-names");
  });

  it("atingir o teto recusa o conjunto parcial", async () => {
    state.rows = Array.from({ length: 1000 }, (_, i) => row(i + 1));
    state.repeat = true;
    await expect(readCurrentSchoolNames()).rejects.toThrow("excedeu o limite de leitura");
  });

  it("consulta cancelada não inicia uma nova leitura de escola", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(readCurrentSchoolNames(undefined, "2026-10-24", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(state.from).not.toHaveBeenCalled();
  });
});
