import { describe, expect, it } from "vitest";
import { councilDates } from "./calendar-engine";
import { COUNCIL_REVISION, createCalendarFixtures } from "./calendar-fixtures";
import {
  createInMemoryCalendarRepository,
  migrateCouncils,
  type CalendarStorage,
} from "./calendar-store";
import { demoActors } from "./calendar-fixtures";

const byId = (id: string) => createCalendarFixtures().find((c) => c.id === id)!;
const list = (id: string) => councilDates(byId(id)).map((c) => `${c.date.slice(5)} ${c.label}`);

const REGULAR = [
  "05-21 Conselho de Classe do 1º Período Letivo",
  "09-10 Conselho de Classe do 2º Período Letivo",
  "12-10 Conselho de Classe do 3º Período Letivo",
  "12-17 Conselho de Classe Final",
];

describe("Conselhos de Classe de referência", () => {
  it("C. EJA Fases 2–9: exatamente os seis conselhos", () => {
    expect(list("cal-rede-2027-eja")).toEqual([
      "04-30 Conselho de Classe do 1º período / 1",
      "07-02 Conselho de Classe do 2º período / 1",
      "07-09 Conselho de Classe Final / 1",
      "09-30 Conselho de Classe do 1º período / 2",
      "12-10 Conselho de Classe do 2º período / 2",
      "12-17 Conselho de Classe Final / 2",
    ]);
  });
  it("D. Regular: exatamente os quatro conselhos", () => {
    expect(list("cal-rede-2027-regular")).toEqual(REGULAR);
  });
  it("E. EJA Fase 1: os mesmos quatro do Regular", () => {
    expect(list("cal-rede-2027-eja-fase-1")).toEqual(REGULAR);
  });
  it("F. nenhuma data exclusiva do Regular vaza para a EJA Fases 2–9", () => {
    const eja = councilDates(byId("cal-rede-2027-eja")).map((c) => c.date);
    expect(eja).not.toContain("2027-05-21");
    expect(eja).not.toContain("2027-09-10");
  });
});

function memStorage(fail = false): CalendarStorage & { data: string | null } {
  const s = {
    data: null as string | null,
    load: () => (s.data ? JSON.parse(s.data) : null),
    store: (c: unknown) => {
      if (fail) return false;
      s.data = JSON.stringify(c);
      return true;
    },
  };
  return s;
}

describe("persistência do Salvar", () => {
  const actor = demoActors.supervisao;
  it("A/B. editar → salvar → nova leitura (reload) mantém a alteração", () => {
    const st = memStorage();
    const a = createInMemoryCalendarRepository(createCalendarFixtures(), st);
    a.hydrate();
    a.mutate("cal-rede-2027-eja", actor, {
      kind: "configurar-documento",
      patch: { observations: "Linha 1\nLinha 2" },
    });
    expect(a.save("cal-rede-2027-eja").ok).toBe(true);
    const b = createInMemoryCalendarRepository(createCalendarFixtures(), st);
    b.hydrate();
    expect(b.get("cal-rede-2027-eja")!.observations).toBe("Linha 1\nLinha 2");
  });
  it("H. falha de gravação não é informada como salva", () => {
    const st = memStorage(true);
    const a = createInMemoryCalendarRepository(createCalendarFixtures(), st);
    a.hydrate();
    a.mutate("cal-rede-2027-eja", actor, {
      kind: "configurar-documento",
      patch: { observations: "x" },
    });
    const out = a.save("cal-rede-2027-eja");
    expect(out.ok).toBe(false);
    expect(a.hasUnsavedChanges("cal-rede-2027-eja")).toBe(true);
  });
  it("G. rascunho salvo com datas antigas é migrado e não restaura as antigas", () => {
    const st = memStorage();
    const old = createCalendarFixtures().map((c) =>
      c.id === "cal-rede-2027-eja"
        ? {
            ...c,
            councilRevision: undefined,
            observations: "Nota da escola",
            events: [
              ...c.events.filter((e) => e.type !== "CC" && e.type !== "CF"),
              { id: "o1", type: "CC" as const, date: "2027-07-09" },
              { id: "o2", type: "CC" as const, date: "2027-10-01" },
            ],
          }
        : c,
    );
    st.data = JSON.stringify(old);
    const repo = createInMemoryCalendarRepository(createCalendarFixtures(), st);
    repo.hydrate();
    const cal = repo.get("cal-rede-2027-eja")!;
    expect(cal.councilRevision).toBe(COUNCIL_REVISION);
    expect(cal.observations).toBe("Nota da escola");
    expect(councilDates(cal).map((c) => c.date.slice(5))).toEqual([
      "04-30",
      "07-02",
      "07-09",
      "09-30",
      "12-10",
      "12-17",
    ]);
    // O registro do navegador nunca é regravado automaticamente pela migração.
    expect(st.data).toBe(JSON.stringify(old));
  });
  it("calendário homologado é história e não é migrado", () => {
    const ref = byId("cal-rede-2027-eja");
    const hom = { ...ref, status: "homologado" as const, councilRevision: undefined };
    expect(migrateCouncils(hom, ref)).toBe(hom);
  });
});

describe("Conselho em vários dias", () => {
  it("cada dia de Conselho Final vira uma linha própria", () => {
    const cal = byId("cal-rede-2027-regular");
    const fin0 = councilDates(cal).find((c) => c.final)!;
    const type = [...cal.overrides, ...cal.events].find((o) => o.date === fin0.date)!.type;
    const prev = `2027-12-${String(Number(fin0.date.slice(8)) - 1).padStart(2, "0")}`;
    const withTwo = { ...cal, overrides: [...cal.overrides.filter((o) => o.date !== prev), { date: prev, type }] };
    expect(councilDates(withTwo).filter((c) => c.final).map((c) => c.date)).toEqual([prev, fin0.date]);
  });
});

describe("Espelho Regular → EJA Fase I", () => {
  it("ao abrir, o EJA Fase I salvo diferente recebe o conteúdo do Regular; edição nova também", () => {
    const st = memStorage();
    const base = createCalendarFixtures();
    const reg = base.find((c) => c.id === "cal-rede-2027-regular")!;
    const regEdited = { ...reg, overrides: [...reg.overrides, { date: "2027-09-21", type: "CC" as const }] };
    st.data = JSON.stringify(base.map((c) => (c.id === reg.id ? regEdited : c)));
    const repo = createInMemoryCalendarRepository(createCalendarFixtures(), st);
    repo.hydrate();
    expect(councilDates(repo.get("cal-rede-2027-eja-fase-1")!).map((c) => c.date)).toContain("2027-09-21");
    repo.mutate("cal-rede-2027-regular", demoActors.supervisao, { kind: "definir-dia", date: "2027-12-16", type: "CF" });
    expect(councilDates(repo.get("cal-rede-2027-eja-fase-1")!).filter((c) => c.final).map((c) => c.date)).toEqual(["2027-12-16", "2027-12-17"]);
    expect(repo.get("cal-rede-2027-eja-fase-1")!.title).not.toBe(repo.get("cal-rede-2027-regular")!.title);
  });
});
