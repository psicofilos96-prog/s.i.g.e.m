/**
 * Ano letivo de visualização, único para todo o SIGEM.
 * Padrão: o ano cadastrado cuja vigência contém a data operacional de hoje; sem ele, o mais recente
 * cadastrado (com aviso). Escolha manual vale para a sessão do navegador e por conta; filtro de tela
 * nunca autoriza (RLS continua decidindo).
 */
import { useEffect, useSyncExternalStore } from "react";
import { operationalToday } from "@/lib/academic-date";
import { readYears, type YearOption } from "@/features/year-transition/year-transition-source";
import { useSessionUser } from "@/features/authority/session-authority";

export interface CurrentYearPick { id: string; fallback: boolean }

/** Ano corrente pela data; nunca inventa ano: sem cadastro, null. */
export function currentYearFor(years: readonly YearOption[], today: string): CurrentYearPick | null {
  const within = years.find((y) => y.startsOn && y.endsOn && y.startsOn <= today && today <= y.endsOn);
  if (within) return { id: within.id, fallback: false };
  const dated = years.filter((y) => y.startsOn).sort((a, b) => (b.startsOn! < a.startsOn! ? -1 : 1));
  const latest = dated[0] ?? years[years.length - 1];
  return latest ? { id: latest.id, fallback: true } : null;
}

type State = { years: YearOption[] | null; current: CurrentYearPick | null; chosen: string | null; error: boolean; key: string | null };
let state: State = { years: null, current: null, chosen: null, error: false, key: null };
const listeners = new Set<() => void>();
const set = (n: Partial<State>) => { state = { ...state, ...n }; for (const l of [...listeners]) l(); };
const storageKey = (k: string) => `sigem.active-year.${k}`;

function load(key: string) {
  let chosen: string | null = null;
  try { chosen = window.sessionStorage.getItem(storageKey(key)); } catch { /* sem armazenamento */ }
  set({ key, years: null, current: null, chosen, error: false });
  readYears().then(
    (ys) => { if (state.key !== key) return; set({ years: ys, current: currentYearFor(ys, operationalToday()) }); },
    () => { if (state.key === key) set({ years: [], error: true }); },
  );
}

export function setActiveYear(id: string) {
  if (state.key) { try { window.sessionStorage.setItem(storageKey(state.key), id); } catch { /* ignore */ } }
  set({ chosen: id });
}

const SERVER: State = { years: null, current: null, chosen: null, error: false, key: null };

export function useActiveYear() {
  const { user, revision } = useSessionUser();
  const key = user ? `${user.id}#${revision}` : null;
  const s = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => SERVER);
  useEffect(() => { if (key && state.key !== key) load(key); if (!key && state.key) set({ ...SERVER }); }, [key]);
  const valid = s.chosen && s.years?.some((y) => y.id === s.chosen) ? s.chosen : null;
  const id = valid ?? s.current?.id ?? "";
  const year = s.years?.find((y) => y.id === id) ?? null;
  return {
    years: s.years ?? [], loading: s.years === null && !!key, error: s.error,
    id, label: year?.label ?? "", currentId: s.current?.id ?? "",
    isCurrent: !!id && id === s.current?.id, fallback: !valid && !!s.current?.fallback,
    setYear: setActiveYear,
  };
}
