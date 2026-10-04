import { describe, expect, it } from "vitest";
import {
  createInMemoryCalendarRepository,
  parseStoredCalendars,
  type CalendarStorage,
  type StorageRead,
} from "./calendar-store";
import { createCalendarFixtures, demoActors } from "./calendar-fixtures";
import type { NetworkCalendar } from "./calendar-types";

/** Armazenamento que guarda o TEXTO bruto, como o navegador. */
function rawStorage(initial: string | null, opts: { failWrite?: boolean } = {}) {
  const st = {
    raw: initial,
    writes: 0,
    read: (): StorageRead => parseStoredCalendars(st.raw),
    load: () => { const r = parseStoredCalendars(st.raw); return r.state === "lido" ? r.calendars : null; },
    store: (c: NetworkCalendar[]) => { st.writes++; if (opts.failWrite) return false; st.raw = JSON.stringify(c); return true; },
  };
  return st satisfies CalendarStorage;
}

const actor = demoActors.supervisao;
/** Artefato personalizado (sem revisão de conselhos ⇒ o laboratório o migraria). */
function customArtifact(): NetworkCalendar {
  const ref = createCalendarFixtures().find((c) => c.id === "cal-rede-2027-eja")!;
  return {
    ...ref,
    id: "cal-do-usuario-2027",
    title: "MEU CALENDÁRIO PERSONALIZADO",
    councilRevision: undefined,
    signatures: ["Assinatura X"],
    events: [...ref.events.filter((e) => e.type !== "CC" && e.type !== "CF"), { id: "cc-u", type: "CC", date: "2027-07-09" }],
  };
}

describe("Supervisão: artefato exato do navegador", () => {
  it("carrega o registro EXATO (sem fixtures, sem migração, sem regravar)", () => {
    const raw = JSON.stringify([customArtifact()]);
    const st = rawStorage(raw);
    const repo = createInMemoryCalendarRepository([], st, { exact: true });
    repo.hydrate();
    expect(repo.list().map((c) => c.id)).toEqual(["cal-do-usuario-2027"]);
    expect(repo.get("cal-do-usuario-2027")).toEqual(customArtifact());
    expect(st.writes).toBe(0);
    expect(st.raw).toBe(raw);
  });

  it("edição de eventos/conselhos/documento → salvar → reabrir devolve exatamente o salvo", () => {
    const st = rawStorage(JSON.stringify([customArtifact()]));
    const a = createInMemoryCalendarRepository([], st, { exact: true });
    a.hydrate();
    expect(a.mutate("cal-do-usuario-2027", actor, { kind: "definir-dia", date: "2027-08-16", type: "CC" }).ok).toBe(true);
    expect(a.mutate("cal-do-usuario-2027", actor, { kind: "configurar-documento", patch: { observations: "Obs. da Supervisão" } }).ok).toBe(true);
    expect(a.hasUnsavedChanges("cal-do-usuario-2027")).toBe(true);
    expect(st.writes).toBe(0);
    expect(a.save("cal-do-usuario-2027").ok).toBe(true);
    const edited = a.get("cal-do-usuario-2027")!;
    const b = createInMemoryCalendarRepository([], st, { exact: true });
    b.hydrate();
    expect(b.get("cal-do-usuario-2027")).toEqual(JSON.parse(JSON.stringify(edited)));
    expect(b.get("cal-do-usuario-2027")!.observations).toBe("Obs. da Supervisão");
    expect(b.get("cal-do-usuario-2027")!.title).toBe("MEU CALENDÁRIO PERSONALIZADO");
  });

  it("registro ilegível: nada carregado, nenhuma gravação possível, original intacto", () => {
    const st = rawStorage("{corrompido");
    const repo = createInMemoryCalendarRepository([], st, { exact: true });
    repo.hydrate();
    expect(repo.storageState()?.state).toBe("ilegivel");
    expect(repo.list()).toEqual([]);
    expect(repo.save("x").ok).toBe(false);
    expect(st.writes).toBe(0);
    expect(st.raw).toBe("{corrompido");
  });

  it("registro ilegível bloqueia gravação também no laboratório (seed não sobrescreve)", () => {
    const st = rawStorage("[{\"a\":1}]");
    const repo = createInMemoryCalendarRepository(createCalendarFixtures(), st);
    repo.hydrate();
    const id = repo.list()[0]!.id;
    repo.mutate(id, actor, { kind: "configurar-documento", patch: { observations: "x" } });
    const out = repo.save(id);
    expect(out.ok).toBe(false);
    expect(st.writes).toBe(0);
    expect(st.raw).toBe("[{\"a\":1}]");
  });

  it("ausente: nenhum calendário inventado e nada gravado", () => {
    const st = rawStorage(null);
    const repo = createInMemoryCalendarRepository([], st, { exact: true });
    repo.hydrate();
    expect(repo.storageState()?.state).toBe("ausente");
    expect(repo.list()).toEqual([]);
    expect(st.writes).toBe(0);
  });

  it("falha de gravação não é anunciada como salva", () => {
    const st = rawStorage(JSON.stringify([customArtifact()]), { failWrite: true });
    const repo = createInMemoryCalendarRepository([], st, { exact: true });
    repo.hydrate();
    repo.mutate("cal-do-usuario-2027", actor, { kind: "configurar-documento", patch: { observations: "y" } });
    expect(repo.save("cal-do-usuario-2027").ok).toBe(false);
    expect(repo.hasUnsavedChanges("cal-do-usuario-2027")).toBe(true);
  });

  it("laboratório não regrava o registro ao migrar conselhos na leitura", () => {
    const raw = JSON.stringify([{ ...customArtifact(), id: "cal-rede-2027-eja" }]);
    const st = rawStorage(raw);
    createInMemoryCalendarRepository(createCalendarFixtures(), st).hydrate();
    expect(st.writes).toBe(0);
    expect(st.raw).toBe(raw);
  });
});

describe("cópia de segurança do original", () => {
  it("guarda o original uma vez; falta de espaço não altera o original", async () => {
    const { browserCalendarStorage, BACKUP_KEY } = await import("./calendar-store");
    localStorage.clear();
    localStorage.setItem("sigem.calendarios.v1", "{ilegivel");
    expect(browserCalendarStorage.read!().state).toBe("ilegivel");
    expect(localStorage.getItem(BACKUP_KEY)).toBe("{ilegivel");
    localStorage.setItem("sigem.calendarios.v1", "[]");
    browserCalendarStorage.read!();
    expect(localStorage.getItem(BACKUP_KEY)).toBe("{ilegivel");
    localStorage.clear();
    const orig = Storage.prototype.setItem;
    localStorage.setItem("sigem.calendarios.v1", "[]");
    Storage.prototype.setItem = () => { throw new Error("QuotaExceededError"); };
    try {
      expect(browserCalendarStorage.read!().state).toBe("lido");
      expect(localStorage.getItem("sigem.calendarios.v1")).toBe("[]");
    } finally { Storage.prototype.setItem = orig; }
  });
});
