/**
 * Docente LOTE 08 — Busca no catálogo curricular e vínculo de habilidades (puro).
 *
 * O catálogo vem dos readers de `reference-source.ts` (edições homologadas, texto
 * oficial imutável). Vínculo guarda `CurricularReferenceRef` (item + edição) e a
 * posição curricular do contexto na data, nunca texto copiado. Selecionar no plano
 * é intenção; só aula concluída registrada (ou avaliação/intervenção aplicada)
 * evidencia trabalho com a habilidade.
 */
export type CatalogItem = {
  itemId: string;
  editionId: string;
  code: string;
  description: string;
  stage?: string | null;
  year?: string | null;
  component?: string | null;
  thematicUnit?: string | null;
  knowledgeObject?: string | null;
};

export type CatalogQuery = Partial<Pick<CatalogItem, "stage" | "year" | "component" | "thematicUnit" | "knowledgeObject">> & { text?: string };

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Filtros por igualdade exata; texto exige todas as palavras em código/descrição/unidade/objeto. */
export function searchCatalog(items: readonly CatalogItem[], q: CatalogQuery): CatalogItem[] {
  const words = q.text ? norm(q.text).split(/\s+/).filter(Boolean) : [];
  return items
    .filter((i) =>
      (["stage", "year", "component", "thematicUnit", "knowledgeObject"] as const).every((k) => !q[k] || i[k] === q[k]),
    )
    .filter((i) => {
      if (!words.length) return true;
      const hay = norm([i.code, i.description, i.thematicUnit ?? "", i.knowledgeObject ?? ""].join(" "));
      return words.every((w) => hay.includes(w));
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

export type LinkTarget = "plano" | "aula" | "atividade" | "avaliacao" | "intervencao";

export type SkillLink = {
  target: LinkTarget;
  targetId: string;
  targetDate: string;
  ref: { itemId: string; editionId: string };
  /** Posição curricular do estudante/turma vigente na data, como registrada (B3.3). */
  positionKey: string | null;
  /** Fato que comprova realização (aula concluída, avaliação aplicada, intervenção registrada). */
  realized: boolean;
};

export function makeLink(input: {
  target: LinkTarget; targetId: string; targetDate: string; item: CatalogItem;
  editionValidOn: (editionId: string, date: string) => boolean;
  positionKey: string | null; realized: boolean;
}): SkillLink {
  if (!input.editionValidOn(input.item.editionId, input.targetDate))
    throw new Error("A edição curricular desta habilidade não estava vigente na data do registro.");
  return {
    target: input.target, targetId: input.targetId, targetDate: input.targetDate,
    ref: { itemId: input.item.itemId, editionId: input.item.editionId },
    positionKey: input.positionKey,
    realized: input.target === "plano" ? false : input.realized, // plano nunca é realização
  };
}

export type SkillCoverage = "planejada" | "trabalhada" | "avaliada" | "sem registro";

/** Situação de uma habilidade: plano só "planejada"; aula/atividade realizada ⇒ "trabalhada"; avaliação aplicada ⇒ "avaliada". */
export function skillCoverage(links: readonly SkillLink[], itemId: string): SkillCoverage {
  const mine = links.filter((l) => l.ref.itemId === itemId);
  if (mine.some((l) => l.target === "avaliacao" && l.realized)) return "avaliada";
  if (mine.some((l) => (l.target === "aula" || l.target === "atividade" || l.target === "intervencao") && l.realized)) return "trabalhada";
  if (mine.some((l) => l.target === "plano" || !l.realized)) return "planejada";
  return "sem registro";
}

/** Leitura histórica: o vínculo exibe a edição gravada, mesmo que hoje haja edição nova. */
export function historicalLabel(link: SkillLink, catalog: readonly CatalogItem[]): string {
  const it = catalog.find((c) => c.itemId === link.ref.itemId && c.editionId === link.ref.editionId);
  return it ? `${it.code} — ${it.description}` : "Habilidade de edição não lida (referência preservada)";
}
