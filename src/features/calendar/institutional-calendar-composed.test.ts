import { afterEach, describe, expect, it } from "vitest";
import {
  aggregateAllocationDays, allocationSchoolDays, composedCalendarFor, readAllocationCalendar, setComposedCalendarRpc,
} from "./institutional-calendar-composed";
import { institutionalCalendarDependency } from "./institutional-calendar-days";

const K = "2026-10-04T12:00:00.123456+00:00";
const day = (on: string, result: string, cal: string | null = null, ver: string | null = null) => ({
  on, result, ...(result === "letivo" ? { schoolDayEffect: true } : result === "nao-letivo" ? { schoolDayEffect: false } : {}),
  ...(cal ? { calendarId: cal, versionId: ver } : {}),
});
const payload = (allocation: string, from: string, to: string, days: unknown[]) => ({
  contract: "b4.6.6/1", state: "lido", authorizes: false, publishes: false, allocation, snapshot: { from, to, knownAt: K }, days,
});

// Turma multietapa: estudante REG (calendário Regular, 04-21 feriado) e EJA (calendário EJA, 04-21 letivo).
const server: Record<string, unknown[]> = {
  "a-reg": [day("2026-04-20", "letivo", "cal-reg", "v1"), day("2026-04-21", "nao-letivo", "cal-reg", "v1")],
  "a-eja": [day("2026-04-20", "letivo", "cal-eja", "v9"), day("2026-04-21", "letivo", "cal-eja", "v9")],
  "a-sem": [day("2026-04-20", "sem-calendario-aplicavel"), day("2026-04-21", "sem-calendario-aplicavel")],
};
const rpc = async (_fn: string, a: Record<string, unknown>) => ({
  data: a["_allocation"] === "a-denied" ? { contract: "b4.6.6/1", state: "access-denied" }
    : payload(a["_allocation"] as string, a["_from"] as string, a["_to"] as string, server[a["_allocation"] as string] ?? []),
  error: null,
});

afterEach(() => setComposedCalendarRpc(null));

describe("B4.6.7 Fatia 3 — decisão do servidor por alocação", () => {
  it("cada estudante recebe o resultado do SEU calendário; feriado de um não vira feriado do outro", async () => {
    const reg = await readAllocationCalendar({ allocation: "a-reg", start: "2026-04-20", end: "2026-04-21", knownAt: K }, rpc);
    const eja = await readAllocationCalendar({ allocation: "a-eja", start: "2026-04-20", end: "2026-04-21", knownAt: K }, rpc);
    expect(reg.days.map((d) => d.state)).toEqual(["letivo", "nao-letivo"]);
    expect(eja.days.map((d) => d.state)).toEqual(["letivo", "letivo"]);
    expect(allocationSchoolDays(reg).count).toBe(1);
    expect(allocationSchoolDays(eja).count).toBe(2);
  });

  it("agregado da turma: concordância determina; discordância preserva contagem; multicalendário sem versionId único", async () => {
    const per = await Promise.all(["a-reg", "a-eja"].map((a) => readAllocationCalendar({ allocation: a, start: "2026-04-20", end: "2026-04-21", knownAt: K }, rpc)));
    const agg = aggregateAllocationDays(["2026-04-20", "2026-04-21"], K, per);
    expect(agg[0]!.state).toBe("letivo");
    expect(agg[0]!.calendarId).toBeNull();
    expect(agg[0]!.versionId).toBeNull();
    expect(agg[0]!.diagnostic).toBe("multicalendario:2");
    expect(agg[1]!.state).toBe("alocacoes-divergentes");
    expect(agg[1]!.determined).toBe(false);
    expect(agg[1]!.diagnostic).toBe("letivo:1,nao-letivo:1");
  });

  it("nenhuma alocação nunca significa 0 dias letivos", () => {
    const agg = aggregateAllocationDays(["2026-04-20"], K, []);
    expect(agg[0]!.state).toBe("sem-alocacao");
    expect(allocationSchoolDays({ allocation: "x", days: agg, failure: null }).count).toBeNull();
  });

  it("ausência de calendário aplicável e acesso negado são estados próprios, nunca false/zero", async () => {
    const sem = await readAllocationCalendar({ allocation: "a-sem", start: "2026-04-20", end: "2026-04-21", knownAt: K }, rpc);
    expect(sem.days.every((d) => d.state === "sem-calendario-aplicavel" && !d.determined)).toBe(true);
    const den = await readAllocationCalendar({ allocation: "a-denied", start: "2026-04-20", end: "2026-04-21", knownAt: K }, rpc);
    expect(den.days.every((d) => d.state === "acesso-negado")).toBe(true);
  });

  it("knownAt diferente do pedido é recusado (fonte-malformada), nada é determinado", async () => {
    const bad = async () => ({ data: { ...payload("a-reg", "2026-04-20", "2026-04-21", server["a-reg"]!), snapshot: { from: "2026-04-20", to: "2026-04-21", knownAt: "2026-10-04T12:00:00.123457+00:00" } }, error: null });
    const r = await readAllocationCalendar({ allocation: "a-reg", start: "2026-04-20", end: "2026-04-21", knownAt: K }, bad);
    expect(r.days.every((d) => d.state === "fonte-malformada")).toBe(true);
  });

  it("dependência síncrona: carregando → resultado; troca de contexto descarta resposta antiga", async () => {
    setComposedCalendarRpc(rpc);
    const range = { start: "2026-04-20", end: "2026-04-21" };
    const first = institutionalCalendarDependency(range, K, { contextKey: "u#1", allocations: ["a-reg"] });
    expect(first.summary.kind).toBe("indeterminado");
    expect(first.reason).toMatch(/sendo lido/);
    await new Promise((r) => setTimeout(r, 0));
    const ready = institutionalCalendarDependency(range, K, { contextKey: "u#1", allocations: ["a-reg"] });
    expect(ready.summary.kind === "determinado" && ready.summary.schoolDays).toBe(1);
    expect(ready.perAllocation).toHaveLength(1);
    // Novo contexto: a entrada de u#1 não é reaproveitada.
    expect(composedCalendarFor({ contextKey: "u#2", allocations: ["a-reg"], ...range, knownAt: K }).status).toBe("carregando");
  });

  it("pendente nunca vira determinado nem zero", () => {
    const d = institutionalCalendarDependency({ start: "2026-04-20", end: "2026-04-20" }, K, "pendente");
    expect(d.summary.kind).toBe("indeterminado");
    expect(d.reason).toMatch(/Nada foi contado como zero/);
  });
});
