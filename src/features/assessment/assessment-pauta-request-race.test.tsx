import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCloudPautaFacts } from "./assessment-results-cloud";
import type { AssessmentInstrument } from "./assessment-types";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => mocks.from(table) },
}));

type InstrumentRow = { id: string; class_id: string; definition: AssessmentInstrument };
type Response = { data: InstrumentRow | null; error: { message: string } | null };
type Deferred = {
  promise: Promise<Response>;
  resolve: (value: Response) => void;
  reject: (error: Error) => void;
};
function deferred(): Deferred {
  let resolve!: Deferred["resolve"];
  let reject!: Deferred["reject"];
  const promise = new Promise<Response>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const dates = { A: "2026-03-01", B: "2026-07-01", C: "2026-10-01" };
const pending = new Map<string, Deferred>();
function instrument(id: string, classId = "class-1"): InstrumentRow {
  return {
    id,
    class_id: classId,
    definition: {
      id,
      classId,
      appliedOn: dates[id as keyof typeof dates],
      configurationId: `config-${id}`,
      periodId: `period-${id}`,
      pedagogicalAssignmentId: "assignment-1",
      instrumentTypeId: "it-prova",
      title: `Instrumento ${id}`,
      snapshot: { classLabel: "Turma", fieldLabel: "Componente" },
    },
  };
}
function query(table: string) {
  const filters: Record<string, string> = {};
  const builder = {
    select: () => builder,
    eq: (column: string, value: string) => {
      filters[column] = value;
      return builder;
    },
    order: () => builder,
    limit: () => Promise.resolve({ data: [], error: null }),
    maybeSingle: () => pending.get(filters["id"]!)!.promise,
    then: (yes: (value: { data: unknown[]; error: null }) => unknown) => {
      const id = filters["instrument_id"];
      const data =
        table === "assessment_entry_versions" && id
          ? [
              {
                id: `version-${id}`,
                instrument_id: id,
                version_number: 1,
                logical_entry_id: `entry-${id}`,
              },
            ]
          : [];
      return Promise.resolve({ data, error: null }).then(yes);
    },
  };
  return builder;
}
const context = (instrumentId: string, classId = "class-1") => ({ instrumentId, classId });
function useView({ instrumentId, classId }: ReturnType<typeof context>) {
  const result = useCloudPautaFacts(instrumentId, classId, true);
  return {
    ready: result.ready,
    id: result.instrument?.id,
    appliedOn: result.instrument?.appliedOn,
    versions: result.versions.map((version) => version.id),
    error: result.error,
  };
}
async function succeed(id: string, classId = "class-1") {
  await act(async () => {
    pending.get(id)!.resolve({ data: instrument(id, classId), error: null });
  });
}
async function fail(id: string) {
  await act(async () => {
    pending.get(id)!.reject(new Error(`erro-${id}`));
  });
}

beforeEach(() => {
  pending.clear();
  for (const id of Object.keys(dates)) pending.set(id, deferred());
  mocks.from.mockReset();
  mocks.from.mockImplementation(query);
});

describe("B2.5.3 — fatos da Pauta vinculados a classId + instrumentId", () => {
  it("A carregado → B na mesma montagem invalida instrumento e versões de A no render", async () => {
    const hook = renderHook(useView, { initialProps: context("A") });
    await succeed("A");
    expect(hook.result.current).toMatchObject({
      ready: true,
      id: "A",
      appliedOn: dates.A,
      versions: ["version-A"],
    });
    hook.rerender(context("B"));
    expect(hook.result.current).toMatchObject({
      ready: false,
      id: undefined,
      appliedOn: undefined,
      versions: [],
    });
    await succeed("B");
    expect(hook.result.current).toMatchObject({
      ready: true,
      id: "B",
      appliedOn: dates.B,
      versions: ["version-B"],
    });
  });

  it("B carregando não reapresenta A mesmo após novo render", async () => {
    const hook = renderHook(useView, { initialProps: context("A") });
    await succeed("A");
    hook.rerender(context("B"));
    hook.rerender(context("B"));
    expect(hook.result.current).toMatchObject({ ready: false, id: undefined, versions: [] });
  });

  it("resposta tardia de A não substitui B nem sua data acadêmica", async () => {
    const hook = renderHook(useView, { initialProps: context("A") });
    hook.rerender(context("B"));
    await succeed("B");
    await succeed("A");
    expect(hook.result.current).toMatchObject({
      ready: true,
      id: "B",
      appliedOn: dates.B,
      versions: ["version-B"],
    });
  });

  it("erro tardio de A não contamina B", async () => {
    const hook = renderHook(useView, { initialProps: context("A") });
    hook.rerender(context("B"));
    await succeed("B");
    await fail("A");
    expect(hook.result.current).toMatchObject({ ready: true, id: "B", error: undefined });
  });

  it("mesma turma com organizações em datas distintas consome a appliedOn de B", async () => {
    const hook = renderHook(useView, { initialProps: context("A") });
    await succeed("A");
    hook.rerender(context("B"));
    await succeed("B");
    expect(hook.result.current).toMatchObject({ id: "B", appliedOn: dates.B });
    expect(hook.result.current.appliedOn).not.toBe(dates.A);
  });

  it("A → B → C fora de ordem termina exclusivamente em C", async () => {
    const hook = renderHook(useView, { initialProps: context("A") });
    hook.rerender(context("B"));
    hook.rerender(context("C"));
    await succeed("C");
    await succeed("A");
    await succeed("B");
    expect(hook.result.current).toMatchObject({
      ready: true,
      id: "C",
      appliedOn: dates.C,
      versions: ["version-C"],
    });
  });

  it("mudança de turma também invalida o instrumento anterior", async () => {
    const hook = renderHook(useView, { initialProps: context("A") });
    await succeed("A");
    pending.set("A", deferred());
    hook.rerender(context("A", "class-2"));
    expect(hook.result.current).toMatchObject({ ready: false, id: undefined, versions: [] });
    await act(async () => {
      pending.get("A")!.resolve({ data: instrument("A"), error: null });
    });
    expect(hook.result.current).toMatchObject({ ready: true, id: undefined, versions: [] });
    expect(hook.result.current.error).toMatch(/não pertence ao contexto solicitado/);
  });

  it("recusa resposta cuja identidade não coincide com o instrumento solicitado", async () => {
    const hook = renderHook(useView, { initialProps: context("B") });
    await act(async () => {
      pending.get("B")!.resolve({ data: instrument("A"), error: null });
    });
    expect(hook.result.current).toMatchObject({ ready: true, id: undefined, versions: [] });
    expect(hook.result.current.error).toMatch(/não pertence ao contexto solicitado/);
  });

  it("desmontagem invalida resposta pendente sem publicar fatos", async () => {
    const hook = renderHook(useView, { initialProps: context("A") });
    const before = hook.result.current;
    hook.unmount();
    await succeed("A");
    expect(before).toMatchObject({ ready: false, id: undefined, versions: [] });
    expect(hook.result.current).toBe(before);
  });
});
