// Ordem de apresentação das turmas por etapa (Infantil → Fundamental I → Fundamental II → EJA → AEE/complementar → sem etapa).
// Fonte: etapa declarada na relação de turmas do Censo (class_census_declarations). Só ordena; nunca classifica nem calcula.

export const STAGE_FIELDS = ["Etapa de ensino", "Tipo de turma"] as const;

const ORDER: [RegExp, number][] = [
  [/creche/i, 10],
  [/unificada/i, 11],
  [/pr[ée]-?escola/i, 12],
  [/^ensino fundamental de 9 anos - ([1-5])º/i, 20],
  [/^ensino fundamental de 9 anos - multi/i, 26],
  [/^ensino fundamental de 9 anos - ([6-9])º/i, 30],
  [/EJA.*anos iniciais e anos finais|multietapas/i, 42],
  [/EJA.*anos iniciais|1º segmento/i, 40],
  [/EJA.*anos finais|2º segmento/i, 41],
];

export function stageRank(etapa: string | null | undefined, tipo: string | null | undefined): number {
  const e = (etapa ?? "").trim();
  for (const [re, base] of ORDER) {
    const m = e.match(re);
    if (m) return base * 10 + (m[1] ? Number(m[1]) : 0);
  }
  const t = (tipo ?? "").trim();
  if (/AEE|especializado/i.test(t)) return 500;
  if (/complementar/i.test(t)) return 510;
  return 900;
}

const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

export function compareClasses(a: { name: string; stageRank?: number | undefined }, b: { name: string; stageRank?: number | undefined }): number {
  return (a.stageRank ?? 900) - (b.stageRank ?? 900) || collator.compare(a.name, b.name);
}

type Db = { from: (t: string) => any };

/** Lê a etapa declarada das turmas (sob a RLS de quem consulta). Falha ⇒ mapa vazio (vai para o fim, sem palpite). */
export async function readStageRanks(db: Db, ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!ids.length) return out;
  const r = await db.from("class_census_declarations").select("class_id, field, value_text").in("class_id", ids).in("field", [...STAGE_FIELDS]);
  if (r.error) return out;
  const by = new Map<string, { e?: string; t?: string }>();
  for (const x of (r.data ?? []) as { class_id: string; field: string; value_text: string }[]) {
    const o = by.get(x.class_id) ?? {};
    if (x.field === "Etapa de ensino") o.e = x.value_text; else o.t = x.value_text;
    by.set(x.class_id, o);
  }
  for (const [id, o] of by) out.set(id, stageRank(o.e, o.t));
  return out;
}
