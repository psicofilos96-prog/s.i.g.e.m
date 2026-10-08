/**
 * NPAG.1 — paginação de listas já lidas com a ACL de quem consulta.
 * Ordenação estável (chave + desempate por id), página sempre válida e contagem honesta:
 * `total` é o que foi lido; `truncated` sinaliza que o leitor parou num limite.
 */
import { useEffect, useState } from "react";

export type PageResult<T> = { items: T[]; page: number; pageCount: number; total: number; from: number; to: number; truncated: boolean };

export function stableSort<T>(rows: readonly T[], key: (r: T) => string, id: (r: T) => string, dir: "asc" | "desc" = "asc"): T[] {
  const s = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => s * key(a).localeCompare(key(b), "pt-BR", { sensitivity: "base" }) || id(a).localeCompare(id(b)));
}

export function paginate<T>(rows: readonly T[], page: number, size: number, opts: { limit?: number } = {}): PageResult<T> {
  const total = rows.length; const pageCount = Math.max(1, Math.ceil(total / size));
  const p = Math.min(pageCount, Math.max(1, Math.floor(Number.isFinite(page) ? page : 1)));
  const start = (p - 1) * size;
  return { items: rows.slice(start, start + size), page: p, pageCount, total, from: total ? start + 1 : 0, to: Math.min(total, start + size),
    truncated: opts.limit !== undefined && total >= opts.limit };
}

/** Filtro persistente na aba (sessionStorage), lido só após montar para não divergir do SSR. */
export function usePersistentState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(initial);
  useEffect(() => { try { const raw = sessionStorage.getItem(`sigem:${key}`); if (raw !== null) setV(JSON.parse(raw) as T); } catch { /* ignora */ } }, [key]);
  return [v, (next: T) => { setV(next); try { sessionStorage.setItem(`sigem:${key}`, JSON.stringify(next)); } catch { /* ignora */ } }];
}
