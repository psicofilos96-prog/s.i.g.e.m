/** B4.6.2b.3 — `useAttendancePolicySource` real: contexto de autoridade/data, A→B, erro, unmount. Fixtures de teste. */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Res = { data: unknown; error: { message: string } | null };
const h = vi.hoisted(() => ({ pending: [] as ((r: Res) => void)[] }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => new Promise<Res>((resolve) => h.pending.push(resolve)) }) },
}));

import { useAttendancePolicySource } from "./assessment-normative-sources";

const row = (id: string) => ({ id, version: 1, status: "homologada", homologation_act_ref: "ato", valid_from: null, valid_until: null, definition: { label: id } });
const answer = async (i: number, r: Res) => { await act(async () => { h.pending[i]!(r); await Promise.resolve(); }); };
type P = { id: string };

beforeEach(() => { h.pending.length = 0; });

describe("política de frequência — aceitação por contexto", () => {
  it("sessão pendente ou sem data: nenhuma requisição, não pronto", () => {
    const a = renderHook(() => useAttendancePolicySource<P>({ cloud: true, pending: true, userId: "A", date: "2026-05-10" }));
    const b = renderHook(() => useAttendancePolicySource<P>({ cloud: true, userId: "A", date: undefined }));
    expect(h.pending.length).toBe(0);
    expect(a.result.current.ready).toBe(false);
    expect(b.result.current.ready).toBe(false);
  });

  it("A→B: visibilidade de A some antes de B; resposta tardia de A é ignorada", async () => {
    const { result, rerender } = renderHook(({ u }: { u: string }) => useAttendancePolicySource<P>({ cloud: true, userId: u, date: "2026-05-10" }), { initialProps: { u: "A" } });
    await answer(0, { data: [row("pol-A")], error: null });
    expect(result.current.policies.map((p) => p.id)).toEqual(["pol-A"]);
    rerender({ u: "B" });
    expect(result.current.ready).toBe(false);
    expect(result.current.policies).toEqual([]);
    rerender({ u: "C" });
    await answer(2, { data: [row("pol-C")], error: null });
    await answer(1, { data: [row("pol-B-tardia")], error: null });
    expect(result.current.policies.map((p) => p.id)).toEqual(["pol-C"]);
  });

  it("troca de data com resposta antiga adiada: só a data atual vale", async () => {
    const { result, rerender } = renderHook(({ d }: { d: string }) => useAttendancePolicySource<P>({ cloud: true, userId: "A", date: d }), { initialProps: { d: "2026-03-01" } });
    rerender({ d: "2026-08-01" });
    await answer(1, { data: [row("pol-agosto")], error: null });
    await answer(0, { data: [row("pol-marco")], error: null });
    expect(result.current.policies.map((p) => p.id)).toEqual(["pol-agosto"]);
  });

  it("erro de leitura é erro, nunca ausência de política", async () => {
    const { result } = renderHook(() => useAttendancePolicySource<P>({ cloud: true, userId: "A", date: "2026-05-10" }));
    await answer(0, { data: null, error: { message: "permission denied" } });
    expect(result.current).toEqual({ ready: true, error: "permission denied", policies: [] });
  });

  it("unmount antes da resposta: nada é aplicado", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useAttendancePolicySource<P>({ cloud: true, userId: "A", date: "2026-05-10" }));
    unmount();
    await answer(0, { data: [row("pol-A")], error: null });
    expect(result.current.ready).toBe(false);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
