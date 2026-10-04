import { describe, expect, it } from "vitest";
import {
  createInMemoryCalendarRepository,
  parseStoredCalendars,
  projectCalendars2027,
  type CalendarStorage,
  type StorageRead,
} from "./calendar-store";
import { createCalendarFixtures, demoActors } from "./calendar-fixtures";
import type { NetworkCalendar } from "./calendar-types";

function rawStorage(initial: string | null) {
  const st = {
    raw: initial,
    writes: 0,
    read: (): StorageRead => parseStoredCalendars(st.raw),
    load: () => { const r = parseStoredCalendars(st.raw); return r.state === "lido" ? r.calendars : null; },
    store: (c: NetworkCalendar[]) => { st.writes++; st.raw = JSON.stringify(c); return true; },
  };
  return st satisfies CalendarStorage;
}
const opts = { exact: true, projectSource: projectCalendars2027 };
const actor = demoActors.supervisao;

describe("Supervisão: calendário 2027 registrado no projeto (decisão do usuário: é o real)", () => {
  it("registro ausente ⇒ abre o 2027 do projeto, integral, sem gravar nada", () => {
    const st = rawStorage(null);
    const repo = createInMemoryCalendarRepository([], st, opts);
    repo.hydrate();
    const src = createCalendarFixtures().filter((c) => c.year === 2027);
    expect(repo.list()).toEqual(src);
    expect(repo.list().map((c) => c.id)).toEqual(["cal-rede-2027-regular", "cal-rede-2027-eja", "cal-rede-2027-eja-fase-1"]);
    for (const c of repo.list()) expect(repo.provenance!(c.id)).toBe("fonte-projeto");
    expect(st.writes).toBe(0);
    expect(st.raw).toBeNull();
  });

  it("personalizações da fonte preservadas (conselhos, assinaturas, documento, períodos)", () => {
    const repo = createInMemoryCalendarRepository([], rawStorage(null), opts);
    repo.hydrate();
    const reg = repo.get("cal-rede-2027-regular")!;
    const ref = createCalendarFixtures().find((c) => c.id === "cal-rede-2027-regular")!;
    expect(reg.events).toEqual(ref.events);
    expect(reg.overrides).toEqual(ref.overrides);
    expect(reg.periods).toEqual(ref.periods);
    expect(reg.document).toEqual(ref.document);
    expect(reg.councilRevision).toBe(ref.councilRevision);
  });

  it("Salvar explícito grava só o calendário salvo; reabrir traz o salvo como 'navegador'", () => {
    const st = rawStorage(null);
    const a = createInMemoryCalendarRepository([], st, opts);
    a.hydrate();
    a.mutate("cal-rede-2027-eja", actor, { kind: "configurar-documento", patch: { observations: "Ajuste da Supervisão" } });
    expect(st.writes).toBe(0);
    expect(a.save("cal-rede-2027-eja").ok).toBe(true);
    expect(a.provenance!("cal-rede-2027-eja")).toBe("navegador");
    expect(a.provenance!("cal-rede-2027-regular")).toBe("fonte-projeto");
    const stored = JSON.parse(st.raw!) as NetworkCalendar[];
    expect(stored.map((c) => c.id)).toEqual(["cal-rede-2027-eja"]);
    const b = createInMemoryCalendarRepository([], st, opts);
    b.hydrate();
    expect(b.list().map((c) => c.id)).toEqual(["cal-rede-2027-eja", "cal-rede-2027-regular", "cal-rede-2027-eja-fase-1"]);
    expect(b.provenance!("cal-rede-2027-regular")).toBe("fonte-projeto");
    expect(b.provenance!("cal-rede-2027-eja")).toBe("navegador");
    expect(b.get("cal-rede-2027-eja")!.observations).toBe("Ajuste da Supervisão");
  });

  it("Salvar sem alteração persiste a base da fonte", () => {
    const st = rawStorage(null);
    const a = createInMemoryCalendarRepository([], st, opts);
    a.hydrate();
    expect(a.save("cal-rede-2027-regular").ok).toBe(true);
    expect(JSON.parse(st.raw!)[0]).toEqual(JSON.parse(JSON.stringify(a.get("cal-rede-2027-regular"))));
  });

  it("registro local legível tem prioridade: a fonte não é mesclada", () => {
    const mine = { ...createCalendarFixtures()[1]!, id: "cal-meu", title: "MEU" };
    const raw = JSON.stringify([mine]);
    const st = rawStorage(raw);
    const repo = createInMemoryCalendarRepository([], st, opts);
    repo.hydrate();
    expect(repo.list().map((c) => c.id)).toEqual(["cal-meu"]);
    expect(repo.provenance!("cal-meu")).toBe("navegador");
    expect(st.raw).toBe(raw);
    expect(st.writes).toBe(0);
  });

  it("registro ilegível não é substituído; a fonte abre separada e sem gravação", () => {
    const st = rawStorage("{corrompido");
    const repo = createInMemoryCalendarRepository([], st, opts);
    repo.hydrate();
    expect(repo.list()).toEqual([]);
    repo.openProjectSource!();
    expect(repo.list()).toHaveLength(3);
    repo.mutate("cal-rede-2027-regular", actor, { kind: "configurar-documento", patch: { observations: "x" } });
    expect(repo.save("cal-rede-2027-regular").ok).toBe(false);
    expect(st.writes).toBe(0);
    expect(st.raw).toBe("{corrompido");
  });

  it("laboratório sem sessão não muda", () => {
    const st = rawStorage(null);
    const repo = createInMemoryCalendarRepository(createCalendarFixtures(), st);
    repo.hydrate();
    expect(repo.list().length).toBe(createCalendarFixtures().length);
    expect(st.writes).toBe(0);
  });
});
