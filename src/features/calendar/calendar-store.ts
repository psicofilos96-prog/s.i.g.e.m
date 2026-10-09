/**
 * Repositório em memória do calendário da rede (estado temporário da aba).
 * Contrato pensado para ser trocado por persistência sem refazer a interface.
 * Não existe operação por escola: a unidade apenas resolve o calendário
 * central de (ano letivo, modalidade).
 */
import { useEffect, useSyncExternalStore } from "react";
import { createCalendarFixtures } from "./calendar-fixtures";
import { mirrorContent, mirrorDiffers, mirrorTargets } from "./calendar-mirror";
import {
  deleteCalendar,
  duplicateCalendar,
  mutateCalendar,
  transitionCalendar,
  type CalendarMutation,
  type MutationResult,
  type Transition,
} from "./calendar-governance";
import type { CalendarActor, CalendarModality, NetworkCalendar } from "./calendar-types";

export type CalendarRepository = {
  list(): NetworkCalendar[];
  get(id: string): NetworkCalendar | undefined;
  /**
   * 6D.3.5.7 — calendário de LABORATÓRIO só em memória: nunca gravado, nunca
   * listado; resolvido apenas por `get`. Some ao recarregar a página.
   */
  installTransientLaboratoryCalendar?(calendar: NetworkCalendar): void;
  forYear(academicYearId: string, modality: CalendarModality): NetworkCalendar | undefined;
  mutate(id: string, actor: CalendarActor, m: CalendarMutation): MutationResult;
  transition(
    id: string,
    actor: CalendarActor,
    t: Transition,
    opts?: { confirmCritical?: boolean },
  ): MutationResult;
  duplicate(id: string, targetYear: number, actor: CalendarActor): MutationResult;
  /** Exclui definitivamente um calendário em rascunho (ex.: cópia por engano). */
  remove(id: string, actor: CalendarActor): MutationResult;
  /** Há alterações do rascunho ainda não salvas? */
  hasUnsavedChanges(id: string): boolean;
  /** Confirma as alterações em edição como a versão salva do rascunho. */
  save(id: string): MutationResult;
  /** Descarta as alterações em edição, voltando à última versão salva. */
  discard(id: string): MutationResult;
  subscribe(fn: () => void): () => void;
  /** Carrega as versões salvas do armazenamento do navegador (uma vez). */
  hydrate(): void;
  /** Estado da leitura do armazenamento (null = ainda não lido). */
  storageState(): StorageRead | null;
  /**
   * Proveniência do calendário exibido: gravado neste navegador, ou o calendário 2027 registrado no
   * código-fonte do projeto (base real reconhecida pelo usuário), ainda não salvo aqui.
   */
  provenance?(id: string): CalendarProvenance | null;
  /** Registro ilegível: abre a fonte do projeto SEPARADA, sem nunca gravar sobre o registro. */
  openProjectSource?(): void;
  /** Calendários lidos do banco (prioridade sobre navegador e fonte do projeto, por id). Nunca grava no navegador. */
  adoptCentral?(calendars: NetworkCalendar[], replace?: boolean): void;
  /** Versão salva no banco: vira a versão salva da tela; cópia no navegador só se o registro for gravável. */
  commitCentral?(id: string, calendar: NetworkCalendar): { localCopy: boolean };
};

export type CalendarProvenance = "navegador" | "fonte-projeto" | "central";

/** Resultado explícito da leitura: ausente ≠ ilegível ≠ lido. */
export type StorageRead =
  | { state: "ausente" }
  | { state: "ilegivel"; reason: string }
  | { state: "lido"; calendars: NetworkCalendar[] };

/** Armazenamento das versões salvas (no navegador: localStorage). */
export type CalendarStorage = {
  load(): NetworkCalendar[] | null;
  /** Leitura com estado (preferida quando existe). Ilegível BLOQUEIA qualquer gravação posterior. */
  read?(): StorageRead;
  /** Devolve `false` quando a gravação não foi concluída. */
  store(calendars: NetworkCalendar[]): boolean | void;
};

const STORAGE_KEY = "sigem.calendarios.v1";
export const BACKUP_KEY = "sigem.calendarios.v1.backup-original";

const isCalendarShape = (c: unknown): c is NetworkCalendar =>
  !!c && typeof c === "object" && typeof (c as NetworkCalendar).id === "string"
  && typeof (c as NetworkCalendar).year === "number"
  && Array.isArray((c as NetworkCalendar).ranges) && Array.isArray((c as NetworkCalendar).events);

/** Interpreta o texto bruto sem nunca alterá-lo. */
export function parseStoredCalendars(raw: string | null): StorageRead {
  if (raw === null || raw === "") return { state: "ausente" };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { state: "ilegivel", reason: "conteúdo não é JSON válido" }; }
  if (!Array.isArray(parsed)) return { state: "ilegivel", reason: "formato inesperado (não é lista de calendários)" };
  if (!parsed.every(isCalendarShape)) return { state: "ilegivel", reason: "há registros em formato inesperado" };
  return { state: "lido", calendars: parsed };
}

export const browserCalendarStorage: CalendarStorage = {
  read() {
    if (typeof window === "undefined") return { state: "ausente" };
    let raw: string | null;
    try { raw = window.localStorage.getItem(STORAGE_KEY); } catch (e) {
      return { state: "ilegivel", reason: e instanceof Error ? e.message : "leitura do navegador recusada" };
    }
    const r = parseStoredCalendars(raw);
    // Cópia recuperável do original (só se ainda não existe). Falha de espaço não altera o original.
    if (raw) {
      try { if (window.localStorage.getItem(BACKUP_KEY) === null) window.localStorage.setItem(BACKUP_KEY, raw); } catch { /* original intacto */ }
    }
    return r;
  },
  load() {
    const r = browserCalendarStorage.read!();
    return r.state === "lido" ? r.calendars : null;
  },
  store(calendars) {
    if (typeof window === "undefined") return;
    try {
      const raw = JSON.stringify(calendars);
      window.localStorage.setItem(STORAGE_KEY, raw);
      // Releitura: só há "salvo" se o navegador devolver o que foi gravado.
      return window.localStorage.getItem(STORAGE_KEY) === raw;
    } catch {
      return false;
    }
  },
};

export type RepositoryOptions = {
  /**
   * Modo do artefato real (Supervisão autenticada): sem fixtures, sem `migrateCouncils`, sem regravação
   * na hidratação; carrega o registro EXATO do navegador.
   */
  exact?: boolean;
  /**
   * Decisão do usuário (2026-10-04): o calendário 2027 registrado no código-fonte do projeto é o
   * calendário REAL. Só no modo exato e só quando o registro do navegador está AUSENTE, ele é a base de
   * trabalho (em memória; nada é gravado até "Salvar"). Registro legível sempre tem prioridade.
   */
  projectSource?: () => NetworkCalendar[];
};

export function createInMemoryCalendarRepository(
  seed: NetworkCalendar[] = createCalendarFixtures(),
  storage?: CalendarStorage,
  options: RepositoryOptions = {},
): CalendarRepository {
  let hydrated = !storage;
  let readState: StorageRead | null = storage ? null : { state: "ausente" };
  // Gravação só depois de leitura confirmada como ausente ou lida; ilegível/não lido ⇒ bloqueado.
  const writable = () => !storage || (readState !== null && readState.state !== "ilegivel");
  // Calendários vindos da fonte do projeto e ainda não salvos neste navegador: nunca gravados por tabela.
  const fromSource = new Set<string>();
  const fromCentral = new Set<string>();
  const persist = () => {
    if (!storage) return true;
    if (!writable()) return false;
    return storage.store([...saved.values()].filter((c) => !fromSource.has(c.id))) !== false;
  };
  const loadProjectSource = () => {
    const src = options.projectSource?.() ?? [];
    items = [...src];
    saved.clear();
    fromSource.clear();
    for (const c of src) { saved.set(c.id, c); fromSource.add(c.id); }
  };
  const persistFailed: MutationResult = {
    ok: false,
    reason:
      "Não foi possível gravar no armazenamento do navegador. As alterações NÃO foram salvas.",
  };
  const blocked: MutationResult = {
    ok: false,
    reason:
      "O registro salvo neste navegador está ilegível. Nada foi gravado, para não sobrescrevê-lo.",
  };
  let items = [...seed];
  // Última versão salva de cada calendário; `items` é a cópia em edição.
  const saved = new Map(seed.map((c) => [c.id, c]));
  const dirty = (id: string) => {
    const cur = items.find((c) => c.id === id);
    return !!cur && saved.get(id) !== cur;
  };
  const unsaved: MutationResult = {
    ok: false,
    reason: "Há alterações não salvas. Salve ou descarte antes de continuar.",
  };
  const commit = (res: MutationResult) => {
    if (res.ok) {
      const prev = saved.get(res.calendar.id);
      const wasSource = fromSource.delete(res.calendar.id);
      saved.set(res.calendar.id, res.calendar);
      if (!persist()) {
        if (wasSource) fromSource.add(res.calendar.id);
        if (prev) saved.set(prev.id, prev);
        else saved.delete(res.calendar.id);
        return writable() ? persistFailed : blocked;
      }
    }
    return replace(res);
  };
  const listeners = new Set<() => void>();
  const transient = new Map<string, NetworkCalendar>();
  const emit = () => listeners.forEach((l) => l());
  const replace = (res: MutationResult) => {
    if (res.ok) {
      const exists = items.some((c) => c.id === res.calendar.id);
      items = exists
        ? items.map((c) => (c.id === res.calendar.id ? res.calendar : c))
        : [...items, res.calendar];
      emit();
    }
    return res;
  };
  const missing: MutationResult = { ok: false, reason: "Calendário não encontrado." };
  return {
    list: () => items,
    get: (id) => items.find((c) => c.id === id) ?? transient.get(id),
    installTransientLaboratoryCalendar: (calendar) => {
      transient.set(calendar.id, calendar);
      listeners.forEach((l) => l());
    },
    forYear: (y, m) => items.find((c) => c.academicYearId === y && c.modality === m),
    mutate: (id, actor, m) => {
      const cal = items.find((c) => c.id === id);
      if (!cal) return missing;
      const res = replace(mutateCalendar(cal, actor, m));
      if (res.ok) {
        for (const t of mirrorTargets(res.calendar, items)) {
          const next = mirrorContent(res.calendar, t);
          if (next !== t) items = items.map((c) => (c.id === t.id ? next : c));
        }
        emit();
      }
      return res;
    },
    transition: (id, actor, t, opts) => {
      const cal = items.find((c) => c.id === id);
      if (!cal) return missing;
      if (dirty(id)) return unsaved;
      return commit(transitionCalendar(cal, actor, t, opts));
    },
    duplicate: (id, year, actor) => {
      const cal = items.find((c) => c.id === id);
      if (!cal) return missing;
      if (dirty(id)) return unsaved;
      return commit(duplicateCalendar(cal, year, actor, items));
    },
    remove: (id, actor) => {
      const cal = items.find((c) => c.id === id);
      if (!cal) return missing;
      const check = deleteCalendar(cal, actor);
      if (!check.ok) return check;
      if (!writable()) return blocked;
      const prevSaved = saved.get(id);
      const wasSource = fromSource.delete(id);
      saved.delete(id);
      if (!persist()) {
        if (wasSource) fromSource.add(id);
        if (prevSaved) saved.set(id, prevSaved);
        return persistFailed;
      }
      items = items.filter((c) => c.id !== id);
      emit();
      return { ok: true, calendar: cal } as MutationResult;
    },
    hasUnsavedChanges: dirty,
    save: (id) => {
      const cal = items.find((c) => c.id === id);
      if (!cal) return missing;
      const prev = saved.get(id);
      const wasSource = fromSource.delete(id);
      saved.set(id, cal);
      // Espelho (Regular → EJA Fase I) é salvo junto.
      for (const t of mirrorTargets(cal, items)) { fromSource.delete(t.id); saved.set(t.id, t); }
      if (!persist()) {
        if (wasSource) fromSource.add(id);
        if (prev) saved.set(id, prev);
        else saved.delete(id);
        emit();
        return writable() ? persistFailed : blocked;
      }
      emit();
      return { ok: true, calendar: cal } as MutationResult;
    },
    discard: (id) => {
      const prev = saved.get(id);
      if (!prev) return missing;
      return replace({ ok: true, calendar: prev } as MutationResult);
    },
    storageState: () => readState,
    provenance: (id) => (!items.some((c) => c.id === id) ? null : fromCentral.has(id) ? "central" : fromSource.has(id) ? "fonte-projeto" : "navegador"),
    adoptCentral: (cals, replaceAll = false) => {
      if (replaceAll) { items = []; saved.clear(); fromCentral.clear(); fromSource.clear(); }
      const ids = new Set(cals.map((c) => c.id));
      items = [...cals, ...items.filter((c) => !ids.has(c.id))];
      for (const c of cals) { saved.set(c.id, c); fromCentral.add(c.id); fromSource.delete(c.id); }
      emit();
    },
    commitCentral: (id, cal) => {
      fromCentral.add(id);
      fromSource.delete(id);
      saved.set(id, cal);
      items = items.some((c) => c.id === id) ? items.map((c) => (c.id === id ? cal : c)) : [...items, cal];
      const localCopy = writable() && !!storage && persist();
      emit();
      return { localCopy };
    },
    openProjectSource: () => {
      // Só para leitura/edição em memória: com registro ilegível, `writable()` continua falso.
      if (!options.exact || !options.projectSource || readState?.state !== "ilegivel") return;
      loadProjectSource();
      emit();
    },
    hydrate: () => {
      if (hydrated) return;
      hydrated = true;
      const r: StorageRead = storage?.read
        ? storage.read()
        : (() => { const l = storage?.load(); return l ? { state: "lido", calendars: l } as StorageRead : { state: "ausente" } as StorageRead; })();
      readState = r;
      if (r.state === "ausente" && options.exact && options.projectSource) {
        // Ausência real: base de trabalho = calendário 2027 registrado no projeto (sem gravar nada).
        loadProjectSource();
        emit();
        return;
      }
      if (r.state !== "lido") { emit(); return; }
      if (options.exact) {
        // Artefato exato: nada de fixtures, migração ou regravação.
        items = [...r.calendars];
        saved.clear();
        for (const c of r.calendars) saved.set(c.id, c);
        // Ao reabrir uma das bases oficiais salva, as demais bases do projeto continuam acessíveis.
        // O registro existente não é alterado nem gravado; cada ID salvo prevalece integralmente.
        const project = options.projectSource?.() ?? [];
        if (r.calendars.some((c) => project.some((p) => p.id === c.id))) {
          for (const c of project) if (!saved.has(c.id)) {
            items.push(c); saved.set(c.id, c); fromSource.add(c.id);
          }
        }
        emit();
        return;
      }
      if (!r.calendars.length) { emit(); return; }
      const seedById = new Map(seed.map((c) => [c.id, c]));
      let migrated = false;
      const stored = r.calendars.map((c) => {
        const m = migrateCouncils(c, seedById.get(c.id));
        if (m !== c) migrated = true;
        return m;
      });
      // Migração do laboratório só em memória: nunca regrava o registro do navegador sem Salvar explícito.
      for (const c of stored) saved.set(c.id, c);
      void migrated;
      const ids = new Set(items.map((c) => c.id));
      items = [
        ...items.map((c) => saved.get(c.id) ?? c),
        ...stored.filter((c) => !ids.has(c.id)),
      ];
      emit();
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

const LEGACY_FINAL_NOTE = /^Conselho de Classe Final em \d{2}\/\d{2}\/\d{4}\.?$/;

/**
 * Migra um rascunho salvo com Conselhos de Classe de revisão anterior para os
 * Conselhos da referência vigente. Preserva todas as demais edições. Calendário
 * homologado/arquivado é história institucional e NUNCA é reescrito.
 */
export function migrateCouncils(
  stored: NetworkCalendar,
  reference: NetworkCalendar | undefined,
): NetworkCalendar {
  if (!reference?.councilRevision) return stored;
  if ((stored.councilRevision ?? 0) >= reference.councilRevision) return stored;
  if (stored.status === "homologado" || stored.status === "arquivado") return stored;
  const isCouncil = (t: string) => t === "CC" || t === "CF";
  const refPeriod = new Map(reference.periods.map((p) => [p.id, p]));
  const lines = (stored.observations ?? "")
    .split("\n")
    .filter((l) => !LEGACY_FINAL_NOTE.test(l.trim()));
  return {
    ...stored,
    councilRevision: reference.councilRevision,
    events: [
      ...stored.events.filter((e) => !isCouncil(e.type)),
      ...reference.events.filter((e) => isCouncil(e.type)),
    ].sort((a, b) => a.date.localeCompare(b.date)),
    overrides: [
      ...stored.overrides.filter(
        (o) => !(o.type && isCouncil(o.type)) && !reference.events.some((e) => isCouncil(e.type) && e.date === o.date),
      ),
      ...reference.overrides.filter((o) => o.type && isCouncil(o.type)),
    ],
    periods: stored.periods.map((p) => {
      const r = refPeriod.get(p.id);
      return r ? { ...p, councilLabel: r.councilLabel, finalCouncilLabel: r.finalCouncilLabel } : p;
    }),
    document: { ...stored.document, showCouncils: reference.document.showCouncils },
    observations: lines.join("\n").trim() || undefined,
  };
}

export const calendarRepository = createInMemoryCalendarRepository(
  createCalendarFixtures(),
  browserCalendarStorage,
);

/** Calendário 2027 registrado no código-fonte do projeto (decisão do usuário: é o calendário real). */
export const projectCalendars2027 = (): NetworkCalendar[] =>
  createCalendarFixtures().filter((c) => c.year === 2027);

let supervisionRepo: CalendarRepository | null = null;
/** Repositório do artefato real da Supervisão: registro exato do navegador, sem fixtures. */
export function supervisionCalendarRepository(): CalendarRepository {
  supervisionRepo ??= createInMemoryCalendarRepository([], browserCalendarStorage, {
    exact: true,
    projectSource: projectCalendars2027,
  });
  return supervisionRepo;
}

export function useStorageState(repo: CalendarRepository = calendarRepository) {
  useEffect(() => repo.hydrate(), [repo]);
  return useSyncExternalStore(repo.subscribe, repo.storageState, repo.storageState);
}

export function useNetworkCalendars(repo: CalendarRepository = calendarRepository) {
  useEffect(() => repo.hydrate(), [repo]);
  return useSyncExternalStore(repo.subscribe, repo.list, repo.list);
}

export function useProvenance(id: string, repo: CalendarRepository = calendarRepository) {
  const snap = () => repo.provenance?.(id) ?? null;
  return useSyncExternalStore(repo.subscribe, snap, snap);
}

export function useUnsavedChanges(id: string, repo: CalendarRepository = calendarRepository) {
  const snap = () => repo.hasUnsavedChanges(id);
  return useSyncExternalStore(repo.subscribe, snap, snap);
}
