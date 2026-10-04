import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  readInstitutionalCalendarRange, summarizeCalendarRange, calendarRangeExplanation, datesBetween, useInstitutionalCalendarRange,
} from "./institutional-calendar-days";
import { resolveCalendarDay, countSchoolDays, calendarImpact, projectPlannedLessons, type DeclarationRow } from "./institutional-calendar-effects";

const K = "2027-01-01T00:00:00.000001Z";
const denied = (calls: string[]) => async (fn: string, a: Record<string, unknown>) => {
  calls.push(`${fn}:${String(a["_date"])}`);
  return { data: [{ result_kind: "access-denied", valid_on: a["_date"], known_at: a["_known_at"] }], error: null };
};

describe("adaptador institucional do calendário (contrato real access-denied)", () => {
  it("access-denied ⇒ acesso-negado em cada dia, UM knownAt, nunca zero", async () => {
    const calls: string[] = [];
    const days = await readInstitutionalCalendarRange({ calendarId: "cal-x", start: "2027-03-01", end: "2027-03-03", knownAt: K }, denied(calls));
    expect(calls).toEqual(["calendar_day_at:2027-03-01", "calendar_day_at:2027-03-02", "calendar_day_at:2027-03-03"]);
    expect(new Set(days.map((d) => d.state))).toEqual(new Set(["acesso-negado"]));
    expect(new Set(days.map((d) => d.knownAt))).toEqual(new Set([K]));
    const s = summarizeCalendarRange(days);
    expect(s.kind).toBe("indeterminado");
    expect(calendarRangeExplanation(s)).toMatch(/negada.*3 dias/);
  });

  it("sem calendarId aplicável ⇒ aplicabilidade não declarada sem RPC", async () => {
    const calls: string[] = [];
    const days = await readInstitutionalCalendarRange({ calendarId: null, start: "2027-03-01", end: "2027-03-02", knownAt: K }, denied(calls));
    expect(calls).toEqual([]);
    expect(days.every((d) => d.state === "aplicabilidade-nao-declarada")).toBe(true);
  });

  it("erro e forma inesperada viram estados próprios; positivo inventado é recusado", async () => {
    const err = await readInstitutionalCalendarRange({ calendarId: "c", start: "2027-03-01", end: "2027-03-01", knownAt: K }, async () => ({ data: null, error: new Error("x") }));
    expect(err[0]!.state).toBe("fonte-indisponivel");
    const pos = await readInstitutionalCalendarRange({ calendarId: "c", start: "2027-03-01", end: "2027-03-01", knownAt: K },
      async (_f, a) => ({ data: [{ result_kind: "letivo", valid_on: a["_date"], known_at: K }], error: null }));
    expect(pos[0]!.state).toBe("fonte-malformada");
  });

  it("intervalo limitado e datas/knownAt inválidos recusados antes de RPC", async () => {
    expect(datesBetween("2027-01-01", "2028-02-04")).toHaveLength(400);
    expect(() => datesBetween("2027-01-01", "2028-02-05")).toThrow();
    expect(() => datesBetween("2027-02-30", "2027-03-01")).toThrow();
    expect(() => datesBetween("2027-01-01", "2029-01-01")).toThrow();
    await expect(readInstitutionalCalendarRange({ calendarId: "c", start: "2027-03-01", end: "2027-03-01", knownAt: "ontem" })).rejects.toThrow();
  });

  it("hook: contexto A→B usa chave própria; dado de A nunca aparece em B", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(["b46-calendar-range", "user-A#1", null, "2027-03-01", "2027-03-01", K], [{ state: "letivo" }]);
    function Probe({ k }: { k: string }) {
      const q = useInstitutionalCalendarRange(k, { calendarId: null, start: "2027-03-01", end: "2027-03-01", knownAt: K });
      return <p>{q.data ? q.data.map((d) => d.state).join(",") : "…"}</p>;
    }
    render(<QueryClientProvider client={qc}><Probe k="user-B#1" /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText("aplicabilidade-nao-declarada")).toBeTruthy());
    expect(screen.queryByText("letivo")).toBeNull();
  });
});

const row = (p: Partial<DeclarationRow>): DeclarationRow => ({
  day_state: "declarado", version_id: "v1", reference_issue: null, homologation_state: "homologada", declaration_kind: "faixa",
  declaration_id: "r1", starts_on: null, ends_on: null, event_label: null, day_type_id: "t", day_type_version_id: "tv", day_type_version: 1,
  day_type_label: null, school_day_effect: true, ...p,
});
const APP = { kind: "declarada" as const, schoolIds: ["e"] };
const res = (date: string, rows: DeclarationRow[], knownAt = K) => resolveCalendarDay({ source: "declaracoes", calendarId: "c", date, knownAt, rows }, APP, "e");

describe("endurecimento do motor", () => {
  it("data impossível e knownAt inválido ⇒ snapshot-invalido", () => {
    expect(res("2027-02-30", [row({})]).state).toBe("snapshot-invalido");
    expect(res("2027-03-01", [row({})], "2027-03-01").state).toBe("snapshot-invalido");
  });
  it("efeito fora de boolean|null e versão nula com homologada ⇒ malformada", () => {
    expect(res("2027-03-01", [row({ school_day_effect: "false" as never })]).state).toBe("fonte-malformada");
    expect(res("2027-03-01", [row({ version_id: null })]).state).toBe("fonte-malformada");
  });
  it("datas duplicadas não contam em dobro", () => {
    const d = res("2027-03-01", [row({})]);
    expect(countSchoolDays([d, d]).count).toBeNull();
    expect(calendarRangeExplanation(summarizeCalendarRange([d, d]))).toMatch(/formato inesperado/);
    expect(projectPlannedLessons([{ blockId: "b", weekday: 1, units: 1 }], [d, d]).plannedUnits).toBeNull();
  });
  it("impacto detecta mudança só de declaração (conselho) e data removida", () => {
    const a = res("2027-03-01", [row({})]);
    const b = res("2027-03-01", [row({}), row({ declaration_kind: "evento", declaration_id: "cc", school_day_effect: null })]);
    expect(calendarImpact([a], [b], {})).toHaveLength(1);
    expect(calendarImpact([a], [], { "2027-03-01": ["aula:1"] })).toEqual([{ date: "2027-03-01", before: "letivo", after: "ausente-na-leitura", preservedRecords: ["aula:1"] }]);
  });
});
