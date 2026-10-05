/**
 * Simulação isolada (memória): escola sintética com volume para revelar N+1 e concorrência.
 * Nada toca a Cloud — o cliente é substituído por um falso que conta chamadas e simula latência.
 */
import { describe, expect, it, vi } from "vitest";

const calls = { rpc: 0, from: 0, inFlight: 0, maxInFlight: 0 };
const CLASSES = Number(process.env["SIGEM_SIM_CLASSES"] ?? 300);
const delay = <T,>(v: T) => { calls.inFlight++; calls.maxInFlight = Math.max(calls.maxInFlight, calls.inFlight); return new Promise<T>((r) => setTimeout(() => { calls.inFlight--; r(v); }, 1)); };

vi.mock("@/integrations/supabase/client", () => {
  const chain = (data: unknown) => { const q: Record<string, unknown> = {}; for (const m of ["select", "eq", "in", "lte", "or", "not", "limit"]) q[m] = () => q;
    q["then"] = (res: (x: unknown) => unknown) => delay({ data, error: null, count: Array.isArray(data) ? data.length : 0 }).then(res); return q; };
  return { supabase: {
    from: (t: string) => { calls.from++; return chain(t === "institutional_classes" ? Array.from({ length: CLASSES }, (_, i) => ({ id: `sim-t${i}` })) : [{ id: "x" }]); },
    rpc: (fn: string, a: Record<string, unknown>) => { calls.rpc++;
      const id = String(a["_class_id"] ?? "");
      const rows: Record<string, unknown[]> = {
        class_at: [{ name: id }], class_period_organization_at: [{}], class_curricular_matrices_at: [{ matrix_id: "m1" }],
        class_journey_at: [{ journey_id: "j" }], class_schedule_at: Number(id.slice(5)) % 7 ? [{ schedule_id: "s" }] : [],
        teaching_assignments_at: [{ assignment_id: "a" }], class_allocations_at: Array.from({ length: 30 }, () => ({})),
        class_offering_at: [], class_shift_at: [], cycle_enrollments_at: Array.from({ length: CLASSES * 30 }, () => ({})),
        calendar_applicability_candidates: [{ calendar_id: "c" }],
      };
      return delay({ data: rows[fn] ?? [], error: null }); } } };
});

describe(`simulação: escola com ${CLASSES} turmas e ${CLASSES * 30} matrículas`, () => {
  it("leitura de prontidão: custo por turma é constante e as leituras rodam em paralelo", async () => {
    const { loadSchoolFacts } = await import("@/features/onboarding/onboarding-source");
    const { pilotChecklist } = await import("./pilot-readiness");
    const t0 = performance.now();
    const f = await loadSchoolFacts("sim-escola", "Escola sintética", "2027-03-01");
    const ms = performance.now() - t0;
    expect(f.classes).toHaveLength(CLASSES);
    expect(calls.rpc).toBe(2 + CLASSES * 9); // 9 readers por turma: N+1 por desenho (readers por turma), documentado
    expect(calls.maxInFlight).toBeGreaterThan(100); // não serializa
    const item = pilotChecklist({ homologatedPolicies: 1, schools: 1, schoolEngagements: 1, importBatches: 0, documentTemplates: 0, guardianAuthorizations: 0, familyEnabled: false }, f).find((i) => i.id === "escola-diario")!;
    const pending = Array.from({ length: CLASSES }, (_, i) => i).filter((i) => i % 7 === 0).length;
    expect(item.why).toBe(`${pending} de ${CLASSES} turmas com pendência.`);
    console.info(`[simulacao] turmas=${CLASSES} rpc=${calls.rpc} pico_paralelo=${calls.maxInFlight} tempo_ms=${ms.toFixed(0)}`);
  });
  it("concorrência: 50 abas salvando progresso da mesma base ⇒ uma vence", async () => {
    const { saveProgress, EMPTY_PROGRESS } = await import("@/features/onboarding/onboarding-model");
    const m = new Map<string, string>(); const kv = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    const r = await Promise.all(Array.from({ length: 50 }, (_, i) => Promise.resolve().then(() => saveProgress(kv, "u", EMPTY_PROGRESS, { schoolId: `e${i}`, step: "turmas", reviewed: [] }, new Date(i + 1)))));
    expect(r.filter((x) => x.ok)).toHaveLength(1);
  });
});
