/**
 * B4.6.2b.1.2 — aceitação de respostas do hook real `useCloudCycleClosing`
 * sobre o store global real `cycleClosingStore`. Fixtures de teste; nenhuma escrita no Cloud.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Res = { data: unknown; error: { message: string } | null };
type Pending = { table: string; classId?: string; resolve: (r: Res) => void };
const h = vi.hoisted(() => ({ pending: [] as Pending[] }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        const make = (classId?: string) =>
          new Promise<Res>((resolve) => h.pending.push({ table, classId, resolve }));
        if (table === "cycle_closing_versions") return { eq: (_c: string, v: string) => make(v) };
        return make();
      },
    }),
    rpc: vi.fn(async () => ({ error: null })),
  },
}));

import { useCloudCycleClosing } from "./cycle-closing-cloud";
import { cycleClosingStore } from "./cycle-closing-store";

const row = (id: string, classId: string) => ({
  id, version_number: 1, preceding_closing_id: null, operation: "lavratura",
  snapshot: { id, classId, cycleId: "c1", version: 1 },
});
const pol = (id: string) => ({ id, version: 1, definition: { id, label: id } });

/** Resolve o i-ésimo par (versions, policies) pendente. */
async function answer(idx: number, versions: Res, policies: Res) {
  const pair = h.pending.slice(idx * 2, idx * 2 + 2);
  await act(async () => {
    pair.find((p) => p.table === "cycle_closing_versions")!.resolve(versions);
    pair.find((p) => p.table === "cycle_closing_policies")!.resolve(policies);
    await Promise.resolve();
  });
}
const ok = (data: unknown): Res => ({ data, error: null });
const storeIds = () => cycleClosingStore.snapshots().map((s) => s.id);

beforeEach(() => {
  h.pending.length = 0;
  cycleClosingStore.hydrateSnapshots([]);
});
afterEach(() => cycleClosingStore.hydrateSnapshots([]));

describe("useCloudCycleClosing — aceitação por contexto e geração", () => {
  it("A→B: resposta tardia de A não altera o store global de B", async () => {
    const { result, rerender } = renderHook(
      ({ u }: { u: string }) => useCloudCycleClosing("t1", true, { userId: u }),
      { initialProps: { u: "A" } },
    );
    rerender({ u: "B" });
    expect(result.current.ready).toBe(false);
    await answer(1, ok([row("enc-B", "t1")]), ok([pol("pol-B")]));
    expect(storeIds()).toEqual(["enc-B"]);
    await answer(0, ok([row("enc-A1", "t1"), row("enc-A2", "t1")]), ok([pol("pol-A")]));
    expect(storeIds()).toEqual(["enc-B"]);
    expect(result.current.policies.map((p) => p.id)).toEqual(["pol-B"]);
    expect(result.current.ready).toBe(true);
  });

  it("unmount antes da resposta: nenhuma hidratação", async () => {
    cycleClosingStore.hydrateSnapshots([row("pre", "t1").snapshot as never]);
    const spy = vi.spyOn(cycleClosingStore, "hydrateSnapshots");
    const { result, unmount } = renderHook(() => useCloudCycleClosing("t1", true, { userId: "A" }));
    const stale = result.current.refresh;
    unmount();
    await answer(0, ok([row("enc-A", "t1")]), ok([]));
    await act(async () => { await stale(); });
    expect(h.pending.length).toBe(2); // refresh após unmount não consulta
    expect(spy).not.toHaveBeenCalled();
    expect(storeIds()).toEqual(["pre"]);
    spy.mockRestore();
  });

  it("mesmo usuário turma1→turma2: resposta tardia da turma1 não sobrescreve", async () => {
    const { result, rerender } = renderHook(
      ({ c }: { c: string }) => useCloudCycleClosing(c, true, { userId: "A" }),
      { initialProps: { c: "t1" } },
    );
    const staleRefresh = result.current.refresh;
    rerender({ c: "t2" });
    await act(async () => { await Promise.race([staleRefresh(), Promise.resolve()]); });
    expect(h.pending.length).toBe(4); // refresh velho não consultou nem invalidou o novo
    await answer(1, ok([row("enc-t2", "t2")]), ok([]));
    await answer(0, ok([row("enc-t1", "t1")]), ok([]));
    expect(storeIds()).toEqual(["enc-t2"]);
    expect(result.current.ready).toBe(true);
  });

  it("duas refreshes na mesma turma: só a mais nova é aceita", async () => {
    const { result } = renderHook(() => useCloudCycleClosing("t1", true, { userId: "A" }));
    await answer(0, ok([row("enc-0", "t1")]), ok([]));
    let r1!: Promise<void>, r2!: Promise<void>;
    act(() => { r1 = result.current.refresh(); r2 = result.current.refresh(); });
    await answer(2, ok([row("enc-nova", "t1")]), ok([pol("pol-nova")]));
    await answer(1, ok([row("enc-velha", "t1")]), ok([pol("pol-velha")]));
    await act(async () => { await r1; await r2; });
    expect(storeIds()).toEqual(["enc-nova"]);
    expect(result.current.policies.map((p) => p.id)).toEqual(["pol-nova"]);
  });

  it("erro de consulta: sem hidratação parcial/vazia, erro visível, nada declarado ausente", async () => {
    cycleClosingStore.hydrateSnapshots([row("pre", "t1").snapshot as never]);
    const spy = vi.spyOn(cycleClosingStore, "hydrateSnapshots");
    const { result } = renderHook(() => useCloudCycleClosing("t1", true, { userId: "A" }));
    await answer(0, ok([row("enc-parcial", "t1")]), { data: null, error: { message: "negado" } });
    expect(spy).not.toHaveBeenCalled();
    expect(storeIds()).toEqual(["pre"]);
    expect(result.current.ready).toBe(true);
    expect(result.current.error).toBe("negado");
    expect(result.current.policies).toEqual([]);
    spy.mockRestore();
  });
});
