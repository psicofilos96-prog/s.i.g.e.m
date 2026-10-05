/**
 * Propriedades (fast-check). Suíte rápida usa poucas execuções; `bun run test:deep` (SIGEM_DEEP=1)
 * multiplica as execuções para busca profunda de contraexemplos.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { inForceOn, validitiesOverlap } from "@/features/student-life/class-allocation-ledger";
import { page } from "@/features/audit/audit-model";
import { neutralize } from "@/features/reports/report-engine";
import { classChecklist, isReady, saveProgress, EMPTY_PROGRESS, type ClassFacts, type KV } from "@/features/onboarding/onboarding-model";

const RUNS = process.env["SIGEM_DEEP"] ? 2000 : 60;
const day = fc.integer({ min: 0, max: 60 }).map((n) => new Date(Date.UTC(2027, 0, 1 + n)).toISOString().slice(0, 10));
const validity = fc.tuple(day, fc.option(day, { nil: null })).filter(([a, b]) => b === null || a <= b).map(([validFrom, validUntil]) => ({ validFrom, validUntil }));
const days = Array.from({ length: 70 }, (_, n) => new Date(Date.UTC(2027, 0, 1 + n)).toISOString().slice(0, 10));

describe("intervalos temporais", () => {
  it("sobreposição é simétrica e equivale a existir dia comum", () => {
    fc.assert(fc.property(validity, validity, (a, b) => {
      expect(validitiesOverlap(a, b)).toBe(validitiesOverlap(b, a));
      const common = days.some((d) => inForceOn(a, d) && inForceOn(b, d));
      expect(validitiesOverlap(a, b)).toBe(common);
    }), { numRuns: RUNS });
  });
  it("sucessão: encerrar na véspera do início seguinte nunca sobrepõe", () => {
    fc.assert(fc.property(day, day, (s, e) => {
      if (e <= s) return;
      const prevEnd = new Date(Date.parse(e) - 86400000).toISOString().slice(0, 10);
      expect(validitiesOverlap({ validFrom: s, validUntil: prevEnd }, { validFrom: e, validUntil: null })).toBe(false);
    }), { numRuns: RUNS });
  });
});

describe("paginação", () => {
  it("percorrer páginas devolve cada item exatamente uma vez, em ordem", () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 120 }), fc.integer({ min: 1, max: 25 }), (n, size) => {
      const evs = Array.from({ length: n }, (_, i) => ({ id: `e${i}`, at: `2027-01-01T00:00:${String(i).padStart(4, "0")}` })) as never[];
      const seen: string[] = []; let cursor: string | null = null; let guard = 0;
      do { const p = page(evs, size, cursor); seen.push(...p.items.map((x: { id: string }) => x.id)); cursor = p.next; } while (cursor && ++guard < 1000);
      expect(seen).toEqual((evs as { id: string }[]).map((e) => e.id));
    }), { numRuns: RUNS });
  });
});

describe("ausência não vira zero / pronto", () => {
  it("qualquer fato obrigatório desconhecido impede prontidão", () => {
    const tri = fc.option(fc.boolean(), { nil: null });
    fc.assert(fc.property(tri, tri, tri, tri, fc.option(fc.nat(3), { nil: null }), fc.option(fc.nat(3), { nil: null }), (rec, per, jou, sch, asg, cal) => {
      const c: ClassFacts = { classId: "t", name: null, record: rec, periodOrganization: per, matrix: "resolvida", journey: jou, schedule: sch, assignments: asg, allocations: null, offering: null, shift: null };
      const ready = isReady(classChecklist(c, cal));
      expect(ready).toBe(rec === true && per === true && jou === true && sch === true && (asg ?? 0) > 0 && cal === 1);
    }), { numRuns: RUNS });
  });
});

describe("concorrência otimista e idempotência", () => {
  it("de uma mesma base, só uma gravação vence", () => {
    fc.assert(fc.property(fc.integer({ min: 2, max: 6 }), (writers) => {
      const m = new Map<string, string>(); const kv: KV = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
      const ok = Array.from({ length: writers }, (_, i) => saveProgress(kv, "u", EMPTY_PROGRESS, { schoolId: `e${i}`, step: "turmas", reviewed: [] }, new Date(i + 1)).ok);
      expect(ok.filter(Boolean).length).toBe(1);
    }), { numRuns: RUNS });
  });
  it("neutralização de fórmulas em exportação é idempotente", () => {
    fc.assert(fc.property(fc.string(), (s) => {
      const once = neutralize(s);
      expect(neutralize(once)).toBe(once);
      expect(/^[=+\-@\t\r]/.test(once) && !/^-?\d+(\.\d+)?$/.test(once)).toBe(false);
    }), { numRuns: RUNS });
  });
});
