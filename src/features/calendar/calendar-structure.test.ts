/**
 * 12B.2 — Estrutura de períodos configurável (sem número fixo por modalidade).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assessmentStructureFromCalendar,
  periodRefsFromCalendar,
  resolvePeriodRef,
} from "./calendar-assessment-link";
import {
  councilDates,
  councilForPeriod,
  periodBlocks,
  periodSchoolDays,
  resolveCalendar,
  totalSchoolDays,
  validateCalendar,
} from "./calendar-engine";
import {
  createCalendarFixtures,
  createStructuralScenario2026,
  demoActors,
} from "./calendar-fixtures";
import {
  duplicateCalendar,
  mutateCalendar,
  transitionCalendar,
  type CalendarMutation,
} from "./calendar-governance";
import { createInMemoryCalendarRepository } from "./calendar-store";
import type { NetworkCalendar } from "./calendar-types";

const { supervisao, escola, professor } = demoActors;
const regular = () => createCalendarFixtures()[0]!;
const eja = () => createCalendarFixtures()[1]!;

function apply(cal: NetworkCalendar, m: CalendarMutation) {
  const r = mutateCalendar(cal, supervisao, m);
  if (!r.ok) throw new Error(r.reason);
  return r.calendar;
}
function homologated(cal: NetworkCalendar) {
  const a = transitionCalendar(cal, supervisao, "enviar-revisao");
  if (!a.ok) throw new Error(a.reason);
  const b = transitionCalendar(a.calendar, supervisao, "homologar");
  if (!b.ok) throw new Error(b.reason);
  return b.calendar;
}
const days = (cal: NetworkCalendar) => {
  const r = resolveCalendar(cal);
  return [...cal.periods].sort((a, b) => a.order - b.order).map((p) => periodSchoolDays(r, p));
};
const codes = (cal: NetworkCalendar) => validateCalendar(cal).map((i) => i.code);

describe("quantidade de períodos configurável", () => {
  it("Regular 2026 (cenário estrutural) com 4 períodos", () => {
    const c = createStructuralScenario2026();
    expect(c.periods).toHaveLength(4);
    expect(days(c).every((n) => n > 0)).toBe(true);
    expect(periodBlocks(c, resolveCalendar(c))).toHaveLength(1);
    expect(periodRefsFromCalendar(c)).toHaveLength(4);
  });
  it("Regular 2027 com 3 períodos — 67/67/66, total 200", () => {
    const c = regular();
    expect(days(c)).toEqual([67, 67, 66]);
    expect(totalSchoolDays(resolveCalendar(c))).toBe(200);
  });
  it("mesma modalidade, quantidades diferentes, sem mudança de código", () => {
    expect(createStructuralScenario2026().modality).toBe(regular().modality);
    expect(createStructuralScenario2026().periods.length).not.toBe(regular().periods.length);
  });
  it("calendário com 1 período", () => {
    let c = regular();
    c = apply(c, { kind: "remover-periodo", id: "per-2027-reg-2" });
    c = apply(c, { kind: "remover-periodo", id: "per-2027-reg-3" });
    c = apply(c, {
      kind: "salvar-periodo",
      period: { ...c.periods[0]!, name: "Período único", end: "2027-12-17" },
    });
    expect(days(c)).toEqual([200]);
    expect(codes(c)).not.toContain("SOMA_PERIODOS");
  });
  it("nenhuma quantidade por modalidade está no código", () => {
    for (const f of [
      "calendar-engine.ts",
      "calendar-governance.ts",
      "calendar-pages.tsx",
      "calendar-document.tsx",
    ]) {
      const src = readFileSync(`${process.cwd()}/src/features/calendar/${f}`, "utf8");
      expect(src).not.toMatch(/periods\.length\s*(===|!==|<|>)\s*[1-9]/);
      expect(src).not.toMatch(/modality\s*===\s*"(eja|regular)"/);
    }
  });
});

describe("edição da estrutura em rascunho", () => {
  it("adicionar período gera ID estável e ordem seguinte; dias derivados", () => {
    const c = apply(regular(), {
      kind: "adicionar-periodo",
      period: { name: "4º Período", start: "2027-12-13", end: "2027-12-17" },
    });
    const added = c.periods.find((p) => p.name === "4º Período")!;
    expect(added.order).toBe(4);
    expect(added.id).not.toMatch(/^per-2027-reg-[123]$/);
    expect(periodSchoolDays(resolveCalendar(c), added)).toBe(5);
    expect(codes(c)).toContain("PERIODOS_SOBREPOSTOS");
  });
  it("remover período renumera a ordem sem mudar IDs", () => {
    const c = apply(regular(), { kind: "remover-periodo", id: "per-2027-reg-2" });
    expect(c.periods.map((p) => [p.id, p.order])).toEqual([
      ["per-2027-reg-1", 1],
      ["per-2027-reg-3", 2],
    ]);
  });
  it("renomear mantém o ID e a avaliação continua resolvendo", () => {
    const c = apply(regular(), {
      kind: "salvar-periodo",
      period: { ...regular().periods[0]!, name: "Etapa Inicial" },
    });
    const ref = periodRefsFromCalendar(regular())[0]!;
    const p = resolvePeriodRef(ref, c, "est")!;
    expect(p.calendarPeriodId).toBe("per-2027-reg-1");
    expect(p.label).toBe("Etapa Inicial");
  });
  it("reordenar troca apenas a ordem e sinaliza inconsistência temporal", () => {
    const c = apply(regular(), { kind: "mover-periodo", id: "per-2027-reg-2", direction: -1 });
    expect([...c.periods].sort((a, b) => a.order - b.order).map((p) => p.id)).toEqual([
      "per-2027-reg-2",
      "per-2027-reg-1",
      "per-2027-reg-3",
    ]);
    expect(codes(c)).toContain("ORDEM_INCONSISTENTE");
    expect(
      mutateCalendar(c, supervisao, { kind: "mover-periodo", id: "per-2027-reg-2", direction: -1 })
        .ok,
    ).toBe(false);
  });
  it("alterar datas recalcula os dias imediatamente", () => {
    const c = apply(regular(), {
      kind: "salvar-periodo",
      period: { ...regular().periods[0]!, end: "2027-05-14" },
    });
    expect(days(c)[0]).toBe(62);
    expect(codes(c)).toContain("PERIODOS_COM_LACUNA");
  });
  it("mudança de evento (feriado) altera período e total", () => {
    const c = apply(regular(), { kind: "definir-dia", date: "2027-03-10", type: "FERIADO" });
    expect(days(c)).toEqual([66, 67, 66]);
    expect(totalSchoolDays(resolveCalendar(c))).toBe(199);
  });
  it("validações: nome vazio, invertido, fora do ano, ordem duplicada", () => {
    const base = regular();
    const c: NetworkCalendar = {
      ...base,
      periods: [
        { ...base.periods[0]!, name: " " },
        { ...base.periods[1]!, order: 1, start: "2027-10-01", end: "2027-06-01" },
        { ...base.periods[2]!, end: "2028-01-10" },
      ],
    };
    expect(codes(c)).toEqual(
      expect.arrayContaining([
        "PERIODO_SEM_NOME",
        "ORDEM_DUPLICADA",
        "PERIODO_INVERTIDO",
        "PERIODO_FORA_DO_ANO",
      ]),
    );
  });
  it("não corrige decisões: a mutação preserva o que foi informado", () => {
    const c = apply(regular(), {
      kind: "adicionar-periodo",
      period: { name: "Extra", start: "2027-03-01", end: "2027-03-31" },
    });
    expect(c.periods.find((p) => p.name === "Extra")).toMatchObject({
      start: "2027-03-01",
      end: "2027-03-31",
    });
  });
});

describe("agrupamentos", () => {
  it("calendário sem agrupamento: um bloco sem nome", () => {
    const b = periodBlocks(regular(), resolveCalendar(regular()));
    expect(b.map((x) => [x.group, x.total])).toEqual([[null, 200]]);
  });
  it("agrupamento semestral EJA 2027 com intervalo derivado", () => {
    const b = periodBlocks(eja(), resolveCalendar(eja()));
    expect(b.map((x) => [x.group?.id, x.total, x.start, x.end])).toEqual([
      ["grp-2027-eja-s1", 100, "2027-02-04", "2027-07-09"],
      ["grp-2027-eja-s2", 100, "2027-07-26", "2027-12-17"],
    ]);
  });
  it("agrupamento inexistente é erro", () => {
    const base = regular();
    const c = {
      ...base,
      periods: [{ ...base.periods[0]!, groupId: "grp-x" }, ...base.periods.slice(1)],
    };
    expect(codes(c)).toContain("GRUPO_INEXISTENTE");
  });
  it("renomear agrupamento preserva IDs", () => {
    const c = apply(eja(), {
      kind: "salvar-grupo",
      group: { id: "grp-2027-eja-s1", name: "Módulo A" },
    });
    expect(c.periodGroups[0]).toEqual({ id: "grp-2027-eja-s1", name: "Módulo A", order: 1 });
    expect(c.periods.filter((p) => p.groupId === "grp-2027-eja-s1")).toHaveLength(2);
  });
  it("criar agrupamento num Regular e remover sem perder períodos", () => {
    let c = apply(regular(), { kind: "salvar-grupo", group: { name: "Único" } });
    const g = c.periodGroups[0]!;
    expect(codes(c)).toContain("GRUPO_VAZIO");
    c = apply(c, { kind: "salvar-periodo", period: { ...c.periods[0]!, groupId: g.id } });
    c = apply(c, { kind: "remover-grupo", id: g.id });
    expect(c.periods).toHaveLength(3);
    expect(c.periods.every((p) => !p.groupId)).toBe(true);
  });
});

describe("Conselho de Classe: fonte única", () => {
  it("data vem do dia CC dentro do período, não de campo do período", () => {
    expect(councilDates(regular()).map((c) => c.date)).toEqual([
      "2027-05-21",
      "2027-09-10",
      "2027-12-10",
    ]);
    expect(regular().periods.some((p) => "councilDate" in p)).toBe(false);
  });
  it("mover o CC no calendário muda o Conselho exibido", () => {
    let c = apply(regular(), { kind: "definir-dia", date: "2027-12-10", type: null });
    c = apply(c, { kind: "remover-evento", id: "reg-ev-2027-12-10" });
    c = apply(c, { kind: "definir-dia", date: "2027-12-03", type: "CC" });
    expect(councilForPeriod(resolveCalendar(c), c.periods[2]!)).toBe("2027-12-03");
  });
});

describe("governança da estrutura", () => {
  const all: CalendarMutation[] = [
    { kind: "adicionar-periodo", period: { name: "X", start: "2027-03-01", end: "2027-03-02" } },
    { kind: "remover-periodo", id: "per-2027-reg-1" },
    { kind: "mover-periodo", id: "per-2027-reg-2", direction: -1 },
    { kind: "salvar-periodo", period: { ...regular().periods[0]!, name: "Y" } },
    { kind: "salvar-grupo", group: { name: "G" } },
    { kind: "remover-grupo", id: "grp-2027-eja-s1" },
  ];
  it("homologado rejeita todas as alterações de estrutura", () => {
    const h = homologated(regular());
    for (const m of all) expect(mutateCalendar(h, supervisao, m).ok).toBe(false);
  });
  it("em revisão também rejeita", () => {
    const r = transitionCalendar(regular(), supervisao, "enviar-revisao");
    if (!r.ok) throw new Error();
    for (const m of all) expect(mutateCalendar(r.calendar, supervisao, m).ok).toBe(false);
  });
  it("escola e professor nunca editam a estrutura, mesmo em rascunho", () => {
    for (const a of [escola, professor])
      for (const m of all) expect(mutateCalendar(regular(), a, m).ok).toBe(false);
  });
  it("repositório aplica as mutações via único ponto de escrita", () => {
    const repo = createInMemoryCalendarRepository();
    const out = repo.mutate("cal-rede-2027-regular", escola, all[0]!);
    expect(out.ok).toBe(false);
  });
});

describe("duplicação como atalho de edição", () => {
  it("copia estrutura e grupos com novos IDs e permite alterar no rascunho", () => {
    const src = homologated(eja());
    const d = duplicateCalendar(src, 2028, supervisao);
    if (!d.ok) throw new Error(d.reason);
    const c = d.calendar;
    expect(c.status).toBe("rascunho");
    expect(c.periodGroups.map((g) => g.id)).toEqual(["grp-2028-eja-1", "grp-2028-eja-2"]);
    expect(c.periods.every((p) => c.periodGroups.some((g) => g.id === p.groupId))).toBe(true);
    let n = apply(c, { kind: "remover-grupo", id: "grp-2028-eja-2" });
    n = apply(n, { kind: "remover-periodo", id: c.periods[3]!.id });
    n = apply(n, { kind: "salvar-periodo", period: { ...n.periods[0]!, name: "Etapa 1" } });
    expect(n.periods).toHaveLength(3);
    expect(n.periodGroups).toHaveLength(1);
    expect(src.periods).toHaveLength(4);
  });
});

describe("regressão 2027 e estrutura avaliativa", () => {
  it("EJA 2027 preservado: 52/48/49/51 e 100+100", () => {
    expect(days(eja())).toEqual([52, 48, 49, 51]);
    expect(periodBlocks(eja(), resolveCalendar(eja())).map((b) => b.total)).toEqual([100, 100]);
  });
  it("estrutura avaliativa resolve por calendarPeriodId após renomear e reordenar", () => {
    let c = apply(regular(), {
      kind: "salvar-periodo",
      period: { ...regular().periods[2]!, name: "Final" },
    });
    c = apply(c, { kind: "mover-periodo", id: "per-2027-reg-3", direction: -1 });
    const refs = periodRefsFromCalendar(regular());
    const s = assessmentStructureFromCalendar(c, refs);
    expect(s.periods.map((p) => [p.calendarPeriodId, p.label])).toEqual([
      ["per-2027-reg-1", "1º Período"],
      ["per-2027-reg-2", "2º Período"],
      ["per-2027-reg-3", "Final"],
    ]);
  });
  it("referência a calendário errado não resolve", () => {
    const ref = periodRefsFromCalendar(regular())[0]!;
    expect(resolvePeriodRef(ref, eja(), "est")).toBeNull();
  });
});
