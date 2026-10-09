import { describe, expect, it } from "vitest";
import { demonstrationUnits } from "@/features/units/units-data";
import {
  assessmentStructureFromCalendar,
  periodRefsFromCalendar,
  resolvePeriodRef,
} from "./calendar-assessment-link";
import {
  buildGrid,
  councilDates,
  countSchoolDays,
  daysIn,
  holidaysForDisplay,
  isSchoolDay,
  nextSchoolDay,
  periodBlocks,
  periodForDate,
  periodSchoolDays,
  resolveCalendar,
  schoolDaysPerMonth,
  totalSchoolDays,
  validateCalendar,
  weekday,
  type GridMonthRow,
  type GridRow,
} from "./calendar-engine";
import { createCalendarFixtures, demoActors } from "./calendar-fixtures";
import {
  calendarCapabilities,
  deleteCalendar,
  duplicateCalendar,
  easter,
  mutateCalendar,
  transitionCalendar,
} from "./calendar-governance";
import {
  calendarIdForSchool,
  diaryDateStatus,
  officialCalendar,
  temporalQueries,
} from "./calendar-queries";
import { createInMemoryCalendarRepository } from "./calendar-store";
import type { NetworkCalendar } from "./calendar-types";

const { supervisao, escola, professor } = demoActors;
const fresh = () => createCalendarFixtures();
const regular = () => fresh()[0]!;
const eja = () => fresh()[1]!;

/** Serializa a grade no mesmo formato do "resultado esperado" da especificação. */
function describeRow(row: GridMonthRow) {
  const parts: string[] = [];
  for (const s of row.segments) {
    if (s.kind === "ferias")
      parts.push(`${s.startDay}-${s.startDay + s.colSpan - 1}:[FÉRIAS ×${s.colSpan}]`);
    else if (s.cell.active && s.cell.text) parts.push(`${s.cell.day}=${s.cell.text}`);
  }
  const total = row.splitTotal ? `${row.splitTotal[0]}+${row.splitTotal[1]}` : String(row.total);
  return `${row.monthName} total=${total} ${parts.join(" ")}`;
}
const lines = (rows: GridRow[]) =>
  rows.map((r) => (r.kind === "mes" ? describeRow(r) : `>>> ${r.label}: ${r.total}`));

function homologated(cal: NetworkCalendar) {
  const a = transitionCalendar(cal, supervisao, "enviar-revisao");
  if (!a.ok) throw new Error(a.reason);
  const b = transitionCalendar(a.calendar, supervisao, "homologar", {
    at: "2026-10-01T10:00:00.000Z",
  });
  if (!b.ok) throw new Error(b.reason);
  return b.calendar;
}

describe("datas", () => {
  it("anos comuns e bissextos", () => {
    expect(daysIn(2027, 2)).toBe(28);
    expect(daysIn(2028, 2)).toBe(29);
    expect(daysIn(2100, 2)).toBe(28);
  });
  it("primeiro dia de meses diferentes", () => {
    expect(weekday("2027-01-01")).toBe(5);
    expect(weekday("2027-02-01")).toBe(1);
    expect(weekday("2027-08-01")).toBe(0);
  });
  it("Páscoa e móveis", () => {
    expect(easter(2027)).toBe("2027-03-28");
    expect(easter(2028)).toBe("2028-04-16");
  });
});

describe("Regular 2027 reproduz o modelo de referência", () => {
  const cal = regular();
  const rows = buildGrid(cal);
  const text = lines(rows);
  it("12 meses + total, 31 colunas por linha", () => {
    expect(rows).toHaveLength(13);
    for (const r of rows) if (r.kind === "mes") expect(r.cells).toHaveLength(31);
  });
  it("linhas idênticas ao resultado esperado", () => {
    expect(text).toEqual([
      "Janeiro total=0 1=F 2=S 3=D 4-31:[FÉRIAS ×28]",
      "Fevereiro total=12 1-2:[FÉRIAS ×2] 3=EBV 4=I 6=S 7=D 8=R 9=F 10=R 11=R 12=R 13=S 14=D 20=S 21=D 27=S 28=D",
      "Março total=21 6=S 7=D 13=S 14=D 19=F 20=S 21=D 26=F 27=S 28=D",
      "Abril total=19 3=S 4=D 10=S 11=D 17=S 18=D 21=F 22=R 23=F 24=S 25=D",
      "Maio total=15+4 1=F 2=D 8=S 9=D 10=FL 15=S 16=D 21=CC 22=S 23=D 26=C 27=F 28=R 29=S 30=D",
      "Junho total=22 5=S 6=D 12=S 13=D 19=S 20=D 26=S 27=D",
      "Julho total=12 3=S 4=D 10=S 11=D 12-23:[FÉRIAS ×12] 24=S 25=D 26=RA 31=S",
      "Agosto total=22 1=D 7=S 8=D 14=S 15=D 21=S 22=D 28=S 29=D",
      "Setembro total=7+14 4=S 5=D 6=R 7=FL 10=CC 11=S 12=D 18=S 19=D 25=S 26=D",
      "Outubro total=19 2=S 3=D 9=S 10=D 11=MESTRE 12=F 16=S 17=D 23=S 24=D 30=S 31=D",
      "Novembro total=20 2=F 6=S 7=D 13=S 14=D 15=F 20=F 21=D 27=S 28=D",
      "Dezembro total=13 4=S 5=D 10=CC 11=S 12=D 17=CF T 18=S 19=D 20=R 21=R 22=R 23=R 24=R 25=F 26=D 27=R 28=R 29=R 30=R 31=R",
      ">>> TOTAL DE DIAS LETIVOS: 200",
    ]);
  });
  it("períodos 67/67/66 e lista de feriados", () => {
    const r = resolveCalendar(cal);
    expect(cal.periods.map((p) => periodSchoolDays(r, p))).toEqual([67, 67, 66]);
    expect(schoolDaysPerMonth(r)).toEqual([0, 12, 21, 19, 19, 22, 12, 22, 21, 19, 20, 13]);
    expect(holidaysForDisplay(cal).map((h) => h.date.slice(5))).toEqual([
      "01-01",
      "02-09",
      "03-19",
      "03-26",
      "04-21",
      "04-23",
      "05-10",
      "05-27",
      "09-07",
      "10-12",
      "10-15",
      "11-02",
      "11-15",
    ]);
  });
  it("nenhum aviso de validação (como na especificação)", () => {
    expect(validateCalendar(cal)).toEqual([]);
  });
});

describe("EJA 2027 reproduz o modelo de referência", () => {
  const cal = eja();
  const text = lines(buildGrid(cal));
  it("julho dividido e subtotais semestrais", () => {
    expect(text).toEqual([
      "Janeiro total=0 1=F 2=S 3=D 4-31:[FÉRIAS ×28]",
      "Fevereiro total=12 1-2:[FÉRIAS ×2] 3=EBV 4=I 6=S 7=D 8=R 9=F 10=R 11=R 12=R 13=S 14=D 20=S 21=D 27=S 28=D",
      "Março total=21 6=S 7=D 13=S 14=D 19=F 20=S 21=D 26=F 27=S 28=D",
      "Abril total=19 3=S 4=D 10=S 11=D 17=S 18=D 21=F 22=R 23=F 24=S 25=D 30=CC",
      "Maio total=19 1=F 2=D 8=S 9=D 10=FL 15=S 16=D 22=S 23=D 26=C 27=F 28=R 29=S 30=D",
      "Junho total=22 5=S 6=D 12=S 13=D 19=S 20=D 26=S 27=D",
      "Julho total=7 2=CC 3=S 4=D 9=CF 10=S 11=D 12-23:[FÉRIAS ×12] 24=S 25=D",
      ">>> TOTAL DE DIAS LETIVOS DO 1° SEMESTRE: 100",
      "Julho total=5 26=RA 31=S",
      "Agosto total=22 1=D 7=S 8=D 14=S 15=D 21=S 22=D 28=S 29=D",
      "Setembro total=21 4=S 5=D 6=R 7=FL 11=S 12=D 18=S 19=D 25=S 26=D 30=CC",
      "Outubro total=19 2=S 3=D 9=S 10=D 11=MESTRE 12=F 16=S 17=D 23=S 24=D 30=S 31=D",
      "Novembro total=20 2=F 6=S 7=D 13=S 14=D 15=F 20=F 21=D 27=S 28=D",
      "Dezembro total=13 4=S 5=D 10=CC 11=S 12=D 17=CF T 18=S 19=D 20=R 21=R 22=R 23=R 24=R 25=F 26=D 27=R 28=R 29=R 30=R 31=R",
      ">>> TOTAL DE DIAS LETIVOS DO 2° SEMESTRE: 100",
    ]);
  });
  it("períodos 52/48 e 49/51 agrupados por semestre, 4 conselhos", () => {
    const r = resolveCalendar(cal);
    expect(
      periodBlocks(cal, r).map((b) => [
        b.block,
        b.total,
        b.periods.map((p) => periodSchoolDays(r, p)),
      ]),
    ).toEqual([
      ["EJA - 1º SEMESTRE", 100, [52, 48]],
      ["EJA - 2º SEMESTRE", 100, [49, 51]],
    ]);
    expect(councilDates(cal).map((c) => c.date.slice(5))).toEqual([
      "04-30",
      "07-02",
      "07-09",
      "09-30",
      "12-10",
      "12-17",
    ]);
    // 30/09/2027 é quinta: a regra configurada "Conselho às sextas" apenas alerta.
    expect(validateCalendar(cal).map((i) => `${i.severity} ${i.code} ${i.date}`)).toEqual([
      "atencao CC_FORA_DO_DIA 2027-09-30",
    ]);
  });
});

describe("motor temporal", () => {
  const cal = regular();
  const r = resolveCalendar(cal);
  it("dia letivo vem do calendário, não só do dia da semana", () => {
    expect(isSchoolDay(r, "2027-02-04")).toBe(true); // INÍCIO conta
    expect(isSchoolDay(r, "2027-02-03")).toBe(false); // quarta, ENCONTRO não conta
    expect(isSchoolDay(r, "2027-05-10")).toBe(true); // feriado letivo
    expect(isSchoolDay(r, "2027-02-09")).toBe(false); // dia útil não letivo
  });
  it("sábado letivo por configuração explícita", () => {
    const m = mutateCalendar(cal, supervisao, {
      kind: "definir-dia",
      date: "2027-03-13",
      type: "VAZIO",
    });
    expect(m.ok && isSchoolDay(resolveCalendar(m.calendar), "2027-03-13")).toBe(true);
  });
  it("período por data, data sem período, próximo dia letivo, contagem", () => {
    expect(periodForDate(cal, "2027-06-01")?.id).toBe("per-2027-reg-2");
    expect(periodForDate(cal, "2027-01-15")).toBeNull();
    expect(nextSchoolDay(r, "2027-02-05")).toBe("2027-02-15");
    expect(countSchoolDays(r, "2027-02-01", "2027-02-28")).toBe(12);
    expect(totalSchoolDays(r)).toBe(200);
  });
  it("evento fora do ano e intervalo invertido são erros", () => {
    const bad = {
      ...cal,
      ranges: [
        ...cal.ranges,
        { id: "x", type: "RECESSO" as const, start: "2027-05-10", end: "2027-05-01" },
      ],
      events: [...cal.events, { id: "y", type: "CC" as const, date: "2028-01-07" }],
    };
    const codes = validateCalendar(bad).map((i) => i.code);
    expect(codes).toContain("INTERVALO_INVERTIDO");
    expect(codes).toContain("FORA_DO_ANO");
  });
  it("regra de 2027 é política do calendário, não do sistema", () => {
    const moved = {
      ...cal,
      events: cal.events.map((e) => (e.date === "2027-05-21" ? { ...e, date: "2027-05-20" } : e)),
    };
    expect(validateCalendar(moved).some((i) => i.code === "CC_FORA_DO_DIA")).toBe(true);
    expect(
      validateCalendar({
        ...moved,
        rules: moved.rules.filter((r) => r.kind !== "conselho-dia-semana"),
      }).some((i) => i.code === "CC_FORA_DO_DIA"),
    ).toBe(false);
  });
  it("nenhuma regra depende do texto exibido", () => {
    const renamed = {
      ...cal,
      title: "X",
      periods: cal.periods.map((p) => ({ ...p, name: "renomeado" })),
    };
    expect(totalSchoolDays(resolveCalendar(renamed))).toBe(200);
    expect(periodForDate(renamed, "2027-06-01")?.id).toBe("per-2027-reg-2");
  });
});

describe("governança", () => {
  it("escola e professor não editam; só consultam o publicado", () => {
    const cal = regular();
    for (const actor of [escola, professor]) {
      expect(calendarCapabilities(actor, cal).edit).toBe(false);
      expect(calendarCapabilities(actor, cal).view).toBe(false); // rascunho não é visível
      expect(
        mutateCalendar(cal, actor, { kind: "definir-dia", date: "2027-03-01", type: "RECESSO" }).ok,
      ).toBe(false);
      expect(transitionCalendar(cal, actor, "enviar-revisao").ok).toBe(false);
    }
    const pub = homologated(cal);
    for (const actor of [escola, professor]) {
      expect(calendarCapabilities(actor, pub).view).toBe(true);
      expect(calendarCapabilities(actor, pub).edit).toBe(false);
    }
  });
  it("rascunho é alterado pela Supervisão e registra auditoria", () => {
    const m = mutateCalendar(regular(), supervisao, {
      kind: "aplicar-faixa",
      type: "RECESSO",
      start: "2027-03-01",
      end: "2027-03-02",
    });
    expect(m.ok).toBe(true);
    if (m.ok) {
      expect(m.calendar.audit.at(-1)).toMatchObject({ actorId: supervisao.id, action: "alterado" });
      expect(countSchoolDays(resolveCalendar(m.calendar), "2027-03-01", "2027-03-02")).toBe(0);
    }
  });
  it("em revisão bloqueia edição e pode voltar a rascunho", () => {
    const rev = transitionCalendar(regular(), supervisao, "enviar-revisao");
    expect(rev.ok).toBe(true);
    if (!rev.ok) return;
    expect(
      mutateCalendar(rev.calendar, supervisao, {
        kind: "definir-dia",
        date: "2027-03-01",
        type: "RECESSO",
      }).ok,
    ).toBe(false);
    expect(transitionCalendar(rev.calendar, supervisao, "devolver-rascunho").ok).toBe(true);
  });
  it("homologação registra data e responsável", () => {
    const h = homologated(regular());
    expect(h.status).toBe("homologado");
    expect(h.homologatedBy).toBe(supervisao.name);
    expect(h.homologatedAt).toBe("2026-10-01T10:00:00.000Z");
    expect(h.audit.at(-1)?.action).toBe("homologado");
  });
  it("homologado rejeita qualquer mutação e não volta a rascunho", () => {
    const h = homologated(regular());
    const snapshot = JSON.stringify(h);
    const muts = [
      { kind: "definir-dia", date: "2027-03-01", type: "RECESSO" },
      { kind: "aplicar-faixa", type: "FERIAS", start: "2027-03-01", end: "2027-03-05" },
      { kind: "remover-evento", id: h.events[0]!.id },
      { kind: "salvar-periodo", period: { ...h.periods[0]!, end: "2027-05-28" } },
      { kind: "remover-periodo", id: h.periods[0]!.id },
    ] as const;
    for (const m of muts) expect(mutateCalendar(h, supervisao, m).ok).toBe(false);
    expect(transitionCalendar(h, supervisao, "devolver-rascunho").ok).toBe(false);
    expect(() => {
      (h.periods[0] as { end: string }).end = "2027-06-01";
    }).toThrow();
    expect(JSON.stringify(h)).toBe(snapshot);
    expect(lines(buildGrid(h))).toEqual(lines(buildGrid(regular())));
  });
  it("arquivado rejeita qualquer mutação", () => {
    const a = transitionCalendar(homologated(regular()), supervisao, "arquivar");
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.calendar.status).toBe("arquivado");
    expect(
      mutateCalendar(a.calendar, supervisao, {
        kind: "definir-dia",
        date: "2027-03-01",
        type: "RECESSO",
      }).ok,
    ).toBe(false);
    expect(transitionCalendar(a.calendar, supervisao, "devolver-rascunho").ok).toBe(false);
  });
  it("homologar com aviso crítico exige confirmação", () => {
    const m = mutateCalendar(regular(), supervisao, {
      kind: "aplicar-faixa",
      type: "RECESSO",
      start: "2027-03-01",
      end: "2027-03-05",
    });
    if (!m.ok) throw new Error();
    const rev = transitionCalendar(m.calendar, supervisao, "enviar-revisao");
    if (!rev.ok) throw new Error();
    expect(transitionCalendar(rev.calendar, supervisao, "homologar").ok).toBe(false);
    expect(
      transitionCalendar(rev.calendar, supervisao, "homologar", { confirmCritical: true }).ok,
    ).toBe(true);
  });
});

describe("rede: escolas referenciam o mesmo calendário", () => {
  it("todas as escolas resolvem para o mesmo calendarId homologado; sem cópia por escola", () => {
    const repo = createInMemoryCalendarRepository();
    expect(calendarIdForSchool(demonstrationUnits[0]!.id, "ano-2027", "regular", repo)).toBeNull(); // rascunho não publica
    repo.transition("cal-rede-2027-regular", supervisao, "enviar-revisao");
    repo.transition("cal-rede-2027-regular", supervisao, "homologar");
    const before = repo.list().length;
    const ids = new Set(
      demonstrationUnits.map((u) => calendarIdForSchool(u.id, "ano-2027", "regular", repo)),
    );
    expect([...ids]).toEqual(["cal-rede-2027-regular"]);
    expect(repo.list().length).toBe(before);
    expect(repo.list().every((c) => !("unitId" in c))).toBe(true);
    expect(officialCalendar("ano-2027", "eja", repo)).toBeNull();
  });
  it("consultas temporais e seletor do Diário usam só o publicado", () => {
    const q = temporalQueries(homologated(regular()));
    expect(q.classesStart()).toBe("2027-02-04");
    expect(q.classesEnd()).toBe("2027-12-17");
    expect(q.isSchoolHoliday("2027-09-07")).toBe(true);
    expect(q.isRecess("2027-12-20")).toBe(true);
    expect(q.councils().map((c) => c.date)).toEqual([
      "2027-05-21",
      "2027-09-10",
      "2027-12-10",
      "2027-12-17",
    ]);
    expect(diaryDateStatus(null, "2027-03-01")).toBe("sem-calendario");
    expect(diaryDateStatus(regular(), "2028-01-10")).toBe("fora-do-ano");
  });
});

describe("avaliação referencia períodos oficiais por ID", () => {
  it("datas vêm do calendário, sem cópia", () => {
    const cal = regular();
    const refs = periodRefsFromCalendar(cal);
    expect(refs.map((r) => r.calendarPeriodId)).toEqual([
      "per-2027-reg-1",
      "per-2027-reg-2",
      "per-2027-reg-3",
    ]);
    expect(refs.every((r) => !("start" in r))).toBe(true);
    const edited = mutateCalendar(cal, supervisao, {
      kind: "salvar-periodo",
      period: { ...cal.periods[0]!, end: "2027-05-14" },
    });
    if (!edited.ok) throw new Error();
    expect(resolvePeriodRef(refs[0]!, edited.calendar, "e")?.end).toBe("2027-05-14");
  });
  it("renomear período não quebra a referência", () => {
    const cal = regular();
    const refs = periodRefsFromCalendar(cal);
    const renamed = {
      ...cal,
      periods: cal.periods.map((p) => ({ ...p, name: `Etapa ${p.order}` })),
    };
    const s = assessmentStructureFromCalendar(renamed, refs);
    expect(s.periods.map((p) => [p.calendarPeriodId, p.label])).toEqual([
      ["per-2027-reg-1", "Etapa 1"],
      ["per-2027-reg-2", "Etapa 2"],
      ["per-2027-reg-3", "Etapa 3"],
    ]);
    expect(s.normativeStatus).toBe("pendente");
    expect(assessmentStructureFromCalendar(homologated(cal)).normativeStatus).toBe("homologado");
  });
});

describe("duplicação para o próximo ano", () => {
  it("cria rascunho de outro ano sem alterar o original", () => {
    const src = homologated(regular());
    const snap = JSON.stringify(src);
    const d = duplicateCalendar(src, 2028, supervisao);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.calendar).toMatchObject({
      id: "cal-rede-2028-regular",
      year: 2028,
      academicYearId: "ano-2028",
      status: "rascunho",
      duplicatedFrom: src.id,
    });
    expect(d.calendar.homologatedAt).toBeUndefined();
    expect(JSON.stringify(src)).toBe(snap);
    expect(
      mutateCalendar(d.calendar, supervisao, {
        kind: "definir-dia",
        date: "2028-03-01",
        type: "RECESSO",
      }).ok,
    ).toBe(true);
  });
  it("recalcula dependências do ano (móveis, fins de semana, bissexto)", () => {
    const d = duplicateCalendar(regular(), 2028, supervisao);
    if (!d.ok) throw new Error();
    const byMovable = Object.fromEntries(
      d.calendar.events.filter((e) => e.movable).map((e) => [e.movable!, e.date]),
    );
    expect(byMovable).toEqual({
      carnaval: "2028-02-29",
      "sexta-santa": "2028-04-14",
      "corpus-christi": "2028-06-15",
    });
    const r = resolveCalendar(d.calendar);
    expect(r.byDate.size).toBe(366);
    expect(r.byDate.get("2028-01-01")).toBe("FERIADO");
    expect(r.byDate.get("2028-01-02")).toBe("FDS");
  });
  it("colisões são apresentadas para revisão, sem correção automática", () => {
    const src = regular();
    const d = duplicateCalendar(src, 2028, supervisao);
    if (!d.ok) throw new Error();
    const codes = d.calendar.duplicationReview!.map((i) => i.code);
    expect(codes).toContain("COLISAO_FIM_DE_SEMANA"); // ex.: CC 21/05 → domingo em 2028
    expect(codes).toContain("CC_FORA_DO_DIA");
    expect(d.calendar.events.find((e) => e.type === "CC")?.date).toBe("2028-05-21"); // não foi movido
  });
  it("não duplica sem Supervisão nem sobre ano existente", () => {
    expect(duplicateCalendar(regular(), 2028, escola).ok).toBe(false);
    const repo = createInMemoryCalendarRepository();
    expect(repo.duplicate("cal-rede-2027-regular", 2028, supervisao).ok).toBe(true);
    expect(repo.duplicate("cal-rede-2027-regular", 2028, supervisao).ok).toBe(false);
    expect(repo.get("cal-rede-2027-regular")?.status).toBe("rascunho");
  });
});

describe("exclusão de rascunho", () => {
  it("Supervisão exclui rascunho; o repositório o remove de vez", () => {
    const repo = createInMemoryCalendarRepository();
    const id = "cal-rede-2027-regular";
    expect(repo.get(id)?.status).toBe("rascunho");
    const res = repo.remove(id, supervisao);
    expect(res.ok).toBe(true);
    expect(repo.get(id)).toBeUndefined();
    expect(repo.list().some((c) => c.id === id)).toBe(false);
  });
  it("recusa exclusão fora de rascunho ou sem Supervisão", () => {
    expect(deleteCalendar(regular(), escola).ok).toBe(false);
    expect(deleteCalendar(homologated(regular()), supervisao).ok).toBe(false);
    const revisao = transitionCalendar(regular(), supervisao, "enviar-revisao");
    if (!revisao.ok) throw new Error();
    expect(deleteCalendar(revisao.calendar, supervisao).ok).toBe(false);
    const repo = createInMemoryCalendarRepository();
    expect(repo.remove("cal-rede-2027-regular", escola).ok).toBe(false);
    expect(repo.get("cal-rede-2027-regular")).toBeDefined();
  });
});

describe("fixture 2027", () => {
  it("nasce em rascunho e não usa 'demonstrativo' como estado", () => {
    for (const c of fresh()) {
      expect(c.status).toBe("rascunho");
      expect(["rascunho", "em-revisao", "homologado", "arquivado"]).toContain(c.status);
    }
  });
});
