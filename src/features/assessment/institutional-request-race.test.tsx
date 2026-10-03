import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assessmentConfigurations } from "./assessment-fixtures";
import type { OfficialTimelineResult } from "@/features/academic/institutional-period-source";
import { useAssessmentNormativeSource, type NormVersionRow } from "./assessment-normative-sources";
import { useCloudPeriodFacts } from "./assessment-period-sources";
import { useInstitutionalRequest } from "./institutional-request";

const mocks = vi.hoisted(() => ({ timeline: vi.fn(), norms: vi.fn() }));
vi.mock("@/features/academic/institutional-period-source", () => ({ loadOfficialTimelineForClass: mocks.timeline }));
vi.mock("./assessment-rule-store", () => ({ useAssessmentRules: () => [] }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () => table === "assessment_norm_versions" ? mocks.norms() : Promise.resolve({ data: [], error: null }),
      }),
    }),
  },
}));

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: Error) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const dates = { A: "2026-03-01", B: "2026-07-01", C: "2026-10-01" };
const configuration = assessmentConfigurations[0]!;
const configRow: NormVersionRow = {
  id: "config-version", norm_kind: "configuracao-avaliativa", logical_id: "config", version: 1,
  supersedes_id: null, academic_year_id: "ay", stage_ids: [], class_ids: ["class-1"],
  valid_from: null, valid_until: null, definition: configuration,
  homologation_act_ref: "ato", recorded_at: "2026-01-01",
};
function timeline(date: string) {
  return {
    kind: "ready" as const,
    year: { id: "ay", label: "Ano", startsOn: "2026-01-01", endsOn: "2026-12-31" },
    organization: { id: `org-${date}`, label: `Organização ${date}` },
    periods: [{ id: `period-${date}`, label: `Período ${date}`, starts_on: "2026-01-01", ends_on: "2026-12-31", version: 1 }],
    provenance: {
      kind: "institucional-b2.4" as const, validOn: date, knownAt: `${date}T00:00:00.000Z`,
      academicYear: { id: "ay", version: 1 }, organization: { id: `org-${date}`, version: 1 }, periods: [{ id: `period-${date}`, version: 1 }],
    },
  };
}

type Context = { classId: string; yearId: string; date: string };
const context = (date: string): Context => ({ classId: "class-1", yearId: "ay", date });
function useNormView({ classId, yearId, date }: Context) {
  const source = useAssessmentNormativeSource({ classId, academicYearId: yearId, academicDate: date, cloud: true });
  return {
    ready: source.ready,
    value: "configuration" in source.state ? source.state.configuration.periodStructureId : undefined,
    error: source.error ?? (source.ready && source.state.kind === "inexistente" ? source.state.reason : undefined),
  };
}
function usePeriodView({ classId, yearId, date }: Context) {
  const source = useCloudPeriodFacts(classId, yearId, true, date);
  return { ready: source.ready, value: source.periods[0]?.id, error: source.error };
}

for (const [name, useView, expected] of [
  ["normas/configuração", useNormView, (date: string) => `org-${date}`],
  ["períodos", usePeriodView, (date: string) => `period-${date}`],
] as const) {
  describe(`B2.5.3 — resposta institucional atual: ${name}`, () => {
    let pending: Map<string, Deferred<OfficialTimelineResult>>;
    beforeEach(() => {
      pending = new Map(Object.values(dates).map((date) => [date, deferred<OfficialTimelineResult>()]));
      mocks.timeline.mockReset();
      mocks.norms.mockReset();
      mocks.timeline.mockImplementation((_classId: string, _yearId: string, date: string) => pending.get(date)!.promise);
      mocks.norms.mockResolvedValue({ data: [configRow], error: null });
    });

    const finish = async (date: string) => {
      await act(async () => { pending.get(date)!.resolve(timeline(date)); });
    };
    const fail = async (date: string) => {
      await act(async () => { pending.get(date)!.reject(new Error(`erro-${date}`)); });
    };

    it("A → B: B termina primeiro e A atrasada não substitui B", async () => {
      const hook = renderHook(useView, { initialProps: context(dates.A) });
      hook.rerender(context(dates.B));
      await finish(dates.B);
      expect(hook.result.current).toMatchObject({ ready: true, value: expected(dates.B) });
      await finish(dates.A);
      expect(hook.result.current).toMatchObject({ ready: true, value: expected(dates.B) });
      expect(mocks.timeline).toHaveBeenCalledWith("class-1", "ay", dates.B);
    });

    it("a troca A → B invalida imediatamente o resultado A enquanto B carrega", async () => {
      const hook = renderHook(useView, { initialProps: context(dates.A) });
      await finish(dates.A);
      expect(hook.result.current.value).toBe(expected(dates.A));
      hook.rerender(context(dates.B));
      expect(hook.result.current).toMatchObject({ ready: false, value: undefined });
    });

    it("A que termina durante a espera por B é ignorada", async () => {
      const hook = renderHook(useView, { initialProps: context(dates.A) });
      hook.rerender(context(dates.B));
      await finish(dates.A);
      expect(hook.result.current).toMatchObject({ ready: false, value: undefined });
      await finish(dates.B);
      expect(hook.result.current.value).toBe(expected(dates.B));
    });

    it("erro antigo depois do sucesso novo não contamina B", async () => {
      const hook = renderHook(useView, { initialProps: context(dates.A) });
      hook.rerender(context(dates.B));
      await finish(dates.B);
      await fail(dates.A);
      expect(hook.result.current).toMatchObject({ ready: true, value: expected(dates.B), error: undefined });
    });

    it("sucesso antigo depois da indisponibilidade nova não reaparece", async () => {
      const hook = renderHook(useView, { initialProps: context(dates.A) });
      hook.rerender(context(dates.B));
      await act(async () => { pending.get(dates.B)!.resolve({ kind: "unavailable", reason: "Sem vínculo" }); });
      expect(hook.result.current).toMatchObject({ ready: true, value: undefined, error: "Sem vínculo" });
      await finish(dates.A);
      expect(hook.result.current).toMatchObject({ ready: true, value: undefined, error: "Sem vínculo" });
    });

    it("troca rápida A → B → C só permite a resposta C", async () => {
      const hook = renderHook(useView, { initialProps: context(dates.A) });
      hook.rerender(context(dates.B));
      hook.rerender(context(dates.C));
      await finish(dates.C);
      await finish(dates.A);
      await finish(dates.B);
      expect(hook.result.current).toMatchObject({ ready: true, value: expected(dates.C), error: undefined });
    });

    it("turma e ano também invalidam o resultado anterior", async () => {
      const hook = renderHook(useView, { initialProps: context(dates.A) });
      await finish(dates.A);
      hook.rerender({ classId: "class-2", yearId: "ay", date: dates.B });
      expect(hook.result.current).toMatchObject({ ready: false, value: undefined });
      expect(mocks.timeline).toHaveBeenCalledWith("class-2", "ay", dates.B);
      hook.rerender({ classId: "class-2", yearId: "ay-2", date: dates.C });
      expect(hook.result.current).toMatchObject({ ready: false, value: undefined });
      expect(mocks.timeline).toHaveBeenCalledWith("class-2", "ay-2", dates.C);
    });

    it("desmontagem invalida a solicitação pendente", async () => {
      const hook = renderHook(useView, { initialProps: context(dates.A) });
      hook.unmount();
      await finish(dates.A);
      expect(mocks.timeline).toHaveBeenCalledTimes(1);
    });
  });
}

describe("B2.5.3 — identidade da requisição institucional", () => {
  it("invalida o valor anterior no render e descarta erro tardio após sucesso novo", async () => {
    const a = deferred<string>();
    const b = deferred<string>();
    const loaders = new Map([["A", () => a.promise], ["B", () => b.promise]]);
    const hook = renderHook(({ id }) => useInstitutionalRequest(id, true, loaders.get(id)!), { initialProps: { id: "A" } });
    hook.rerender({ id: "B" });
    expect(hook.result.current).toMatchObject({ ready: false, value: undefined });
    await act(async () => { b.resolve("B correto"); });
    await act(async () => { a.reject(new Error("A antigo")); });
    expect(hook.result.current).toMatchObject({ ready: true, value: "B correto", error: undefined });
  });

  it("uma atualização do mesmo contexto invalida a requisição anterior", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    let calls = 0;
    const load = () => ++calls === 1 ? first.promise : second.promise;
    const hook = renderHook(() => useInstitutionalRequest("contexto", true, load));
    await act(async () => { void hook.result.current.refresh(); });
    await act(async () => { second.resolve("novo"); });
    await act(async () => { first.resolve("antigo"); });
    expect(hook.result.current).toMatchObject({ ready: true, value: "novo" });
    hook.unmount();
  });
});
