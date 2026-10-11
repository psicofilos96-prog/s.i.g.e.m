// Catálogo territorial IBGE DTB (núcleo puro). Fonte: tabelas territorial_* (0379), ano-base explícito.
// Códigos sempre texto; match por código prevalece; nome só casa quando único; ambíguo/ausente vai para fila.

export const CODE_LEN = { uf: 2, municipio: 7, distrito: 9, subdistrito: 11 } as const;
export type Level = keyof typeof CODE_LEN;

export function validCode(level: Level, raw: unknown): string | null {
  if (typeof raw !== "string") return null; // número perderia zeros à esquerda
  const t = raw.trim();
  return new RegExp(`^\\d{${CODE_LEN[level]}}$`).test(t) ? t : null;
}

export interface Municipality { code: string; ufCode: string; name: string }
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export type Match =
  | { kind: "codigo"; code: string }
  | { kind: "nome-inequivoco"; code: string }
  | { kind: "fila"; reason: "codigo-inexistente" | "nome-ambiguo" | "nome-sem-uf" | "nao-encontrado" | "sem-dado"; candidates: string[] };

/** Reconciliação de um campo legado de município: preserva o original; nunca escolhe entre homônimos. */
export function reconcileMunicipality(catalog: Municipality[], legacy: { code?: string | null; name?: string | null; ufCode?: string | null }): Match {
  const c = legacy.code != null ? validCode("municipio", legacy.code) : null;
  if (c) return catalog.some((m) => m.code === c) ? { kind: "codigo", code: c } : { kind: "fila", reason: "codigo-inexistente", candidates: [] };
  if (!legacy.name?.trim()) return { kind: "fila", reason: "sem-dado", candidates: [] };
  const hits = catalog.filter((m) => norm(m.name) === norm(legacy.name!) && (!legacy.ufCode || m.ufCode === legacy.ufCode));
  if (hits.length === 1 && legacy.ufCode) return { kind: "nome-inequivoco", code: hits[0]!.code };
  if (hits.length === 0) return { kind: "fila", reason: "nao-encontrado", candidates: [] };
  return { kind: "fila", reason: legacy.ufCode ? "nome-ambiguo" : "nome-sem-uf", candidates: hits.map((h) => h.code) };
}

/** Preflight de exportação: só campos que o leiaute real declara; ano do catálogo precisa ser informado. */
export function preflightTerritorial(fields: { field: string; level: Level; value: string | null; required: boolean }[], known: (level: Level, code: string) => boolean, dtbYear: number | null) {
  if (dtbYear == null) return [{ field: "*", code: "territorio:ano-do-catalogo-ausente" }];
  const errs: { field: string; code: string }[] = [];
  for (const f of fields) {
    if (f.value == null || f.value === "") { if (f.required) errs.push({ field: f.field, code: "territorio:obrigatorio" }); continue; }
    const c = validCode(f.level, f.value);
    if (!c) errs.push({ field: f.field, code: "territorio:formato" });
    else if (!known(f.level, c)) errs.push({ field: f.field, code: "territorio:inexistente-no-ano" });
  }
  return errs;
}
