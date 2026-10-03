/**
 * Patch 4b — fonte normativa pelo snapshot de sessão: loading ⇒ pending (sem laboratório e sem
 * requisição); só signed-out escolhe laboratório; A→B no MESMO hook nunca mostra snapshot de A.
 */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assessmentConfigurations } from "./assessment-fixtures";
import type { SessionAuthority } from "@/features/authority/session-authority";

const m = vi.hoisted(() => ({ timeline: vi.fn(), norms: vi.fn(), lab: vi.fn(() => ({ kind: "inexistente", reason: "lab" })) }));
vi.mock("@/features/academic/institutional-period-source", () => ({ loadOfficialTimelineForClass: m.timeline }));
vi.mock("./assessment-rule-store", () => ({ useAssessmentRules: () => [] }));
vi.mock("./assessment-configuration", async (orig) => ({ ...(await orig<object>()), classConfigurationState: m.lab }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => m.norms() }) }) },
}));
import { normativeSessionArgs, SESSION_PENDING_STATE, useAssessmentNormativeSource } from "./assessment-normative-sources";

function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }
const timeline = (tag: string) => ({
  kind: "ready" as const,
  year: { id: "ay", label: "Ano", startsOn: "2026-01-01", endsOn: "2026-12-31" },
  organization: { id: `org-${tag}`, label: `Org ${tag}` },
  periods: [{ id: `per-${tag}`, label: `Período ${tag}`, starts_on: "2026-01-01", ends_on: "2026-12-31" }],
});
const row = { id: "v", norm_kind: "configuracao-avaliativa", logical_id: "cfg", version: 1, supersedes_id: null, academic_year_id: "ay", stage_ids: [], class_ids: ["class-1"], valid_from: null, valid_until: null, definition: assessmentConfigurations[0], homologation_act_ref: "ato", recorded_at: "2026-01-01" };
const signedIn = (id: string) => ({ status: "signed-in", user: { id }, person: null, capabilities: [] }) as unknown as SessionAuthority;

function useView(a: SessionAuthority) {
  const s = useAssessmentNormativeSource({ classId: "class-1", academicYearId: "ay", academicDate: "2026-05-01", ...normativeSessionArgs(a) });
  return { origin: s.origin, ready: s.ready, state: s.state, periods: "structure" in s.state ? s.state.structure.periods.map((p) => p.id) : [] };
}

beforeEach(() => { m.timeline.mockReset(); m.norms.mockReset(); m.lab.mockClear(); });

describe("Patch 4b — fonte normativa e sessão", () => {
  it("loading: pending, sem laboratório e sem requisição", () => {
    const { result } = renderHook(() => useView({ status: "loading" }));
    expect(result.current.origin).toBe("sessao-pendente");
    expect(result.current.state).toBe(SESSION_PENDING_STATE);
    expect(m.lab).not.toHaveBeenCalled();
    expect(m.norms).not.toHaveBeenCalled();
    expect(m.timeline).not.toHaveBeenCalled();
  });

  it("signed-out → loading → signed-in: laboratório só no signed-out; loading não bloqueia o carregamento", async () => {
    m.norms.mockResolvedValue({ data: [row], error: null });
    m.timeline.mockResolvedValue(timeline("A"));
    let a: SessionAuthority = { status: "signed-out" };
    const { result, rerender } = renderHook(() => useView(a));
    expect(result.current.origin).toBe("laboratorio");
    a = { status: "loading" }; rerender();
    expect(result.current.origin).toBe("sessao-pendente");
    a = signedIn("u-a"); rerender();
    await act(async () => {});
    expect(result.current.origin).toBe("banco");
    expect(result.current.ready).toBe(true);
    expect(result.current.periods).toEqual(["per-A"]); // B2.4, sem calendarId
    expect(m.lab).toHaveBeenCalledTimes(1);
  });

  it("A→B no mesmo hook/classe/ano/data: B nunca recebe ready/value de A; resposta atrasada de A descartada", async () => {
    const tA = deferred<ReturnType<typeof timeline>>(); const tB = deferred<ReturnType<typeof timeline>>();
    m.norms.mockResolvedValue({ data: [row], error: null });
    m.timeline.mockReturnValueOnce(tA.promise).mockReturnValueOnce(tB.promise);
    let a = signedIn("u-a");
    const { result, rerender } = renderHook(() => useView(a));
    expect(result.current.ready).toBe(false);
    a = signedIn("u-b"); rerender();
    expect(result.current.ready).toBe(false);
    await act(async () => { tA.resolve(timeline("A")); });
    expect(result.current.ready).toBe(false);
    expect(result.current.periods).toEqual([]);
    await act(async () => { tB.resolve(timeline("B")); });
    expect(result.current.ready).toBe(true);
    expect(result.current.periods).toEqual(["per-B"]);
  });

  it("A pronto → B: snapshot de A some imediatamente", async () => {
    m.norms.mockResolvedValue({ data: [row], error: null });
    const tB = deferred<ReturnType<typeof timeline>>();
    m.timeline.mockResolvedValueOnce(timeline("A")).mockReturnValueOnce(tB.promise);
    let a = signedIn("u-a");
    const { result, rerender } = renderHook(() => useView(a));
    await act(async () => {});
    expect(result.current.periods).toEqual(["per-A"]);
    a = signedIn("u-b"); rerender();
    expect(result.current.ready).toBe(false);
    expect(result.current.periods).toEqual([]);
  });
});
