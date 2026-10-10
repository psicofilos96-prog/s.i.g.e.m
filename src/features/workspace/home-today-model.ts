export type Reading = { state: "loading" } | { state: "error" } | { state: "ok"; value: number | null; partial?: boolean | undefined };

/** Falha ou ausência nunca aparecem como zero. */
export function readingValue(r: Reading): string {
  if (r.state === "loading") return "…";
  if (r.state === "error") return "Não foi possível ler";
  if (r.value === null) return "Não disponível";
  return new Intl.NumberFormat("pt-BR").format(r.value);
}
