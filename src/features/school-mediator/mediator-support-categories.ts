/**
 * PERFIL MEDIADOR — LOTE 09 Categorias de apoio e acessibilidade (núcleo puro).
 * Os sete domínios são SUGESTÃO de configuração (dado), nunca norma: a categoria só
 * vale quando a configuração homologada vigente a libera para a função da designação,
 * com protocolo declarado quando exigido. Descrição registra o suporte prestado,
 * sem prescrição clínica nem dado íntimo desnecessário.
 */
export const SUGGESTED_DOMAINS = [
  { key: "locomocao", label: "Locomoção" },
  { key: "alimentacao", label: "Alimentação" },
  { key: "higiene-autocuidado", label: "Higiene e autocuidado" },
  { key: "comunicacao", label: "Comunicação" },
  { key: "participacao-atividades", label: "Participação em atividades" },
  { key: "organizacao-rotina", label: "Organização da rotina" },
  { key: "tecnologia-assistiva", label: "Tecnologia assistiva" },
] as const;

export interface CategoryConfig {
  id: string; version: number; status: "rascunho" | "homologada" | "retirada"; validFrom: string; validTo: string | null;
  domain: string; label: string; functions: string[]; protocolRef: string | null; requiresProtocol: boolean;
  homologatedBy: string | null; authorPersonId: string;
}

/** Cabeça vigente de cada categoria na data; só homologada, homologador ≠ autor. */
export function activeCategories(cfg: CategoryConfig[] | null, date: string): CategoryConfig[] | null {
  if (cfg === null) return null;
  const heads = new Map<string, CategoryConfig>();
  for (const c of cfg) { const h = heads.get(c.id); if (!h || c.version > h.version) heads.set(c.id, c); }
  return [...heads.values()].filter((c) => c.status === "homologada" && c.homologatedBy && c.homologatedBy !== c.authorPersonId
    && c.validFrom <= date && (!c.validTo || date <= c.validTo) && (!c.requiresProtocol || !!c.protocolRef));
}

/** Categorias disponíveis para a função da designação (null ⇒ indisponível por extenso). */
export function categoriesFor(cfg: CategoryConfig[] | null, functionId: string | null, date: string) {
  if (!functionId) return { ok: false as const, reason: "Designação sem função declarada: nenhuma categoria disponível." };
  const act = activeCategories(cfg, date);
  if (act === null) return { ok: false as const, reason: "Configuração de categorias não lida." };
  const list = act.filter((c) => c.functions.includes(functionId));
  if (!list.length) return { ok: false as const, reason: "Nenhuma categoria homologada para esta função na data." };
  return { ok: true as const, categories: list.map((c) => ({ id: c.id, version: c.version, domain: c.domain, label: c.label, protocolRef: c.protocolRef })) };
}

const PRESCRIPTION = /\b(\d+\s?(mg|ml|gotas)|dose|posologia|administr\w* (o |a )?(rem[eé]dio|medicament)|medicou|prescrev|deve tomar|sonda|aspira[cç][aã]o|injet)/i;
const CLINICAL = /\b(cid|laudo|diagn[oó]stic|transtorno|psiqui|neurol)/i;
const INTIMATE = /\b(genit|[oó]rg[aã]os? [ií]ntim|nu[ad]?\b|despid|menstrua|evacu|fezes|urina|ere[cç][aã]o|seio)/i;

export function validateSupportDescription(text: string, domain: string): { block: string[]; advise: string[] } {
  const b: string[] = [], a: string[] = []; const t = text.trim();
  if (t.length > 500) b.push("Descrição com mais de 500 caracteres.");
  if (PRESCRIPTION.test(t)) b.push("Sem prescrição ou procedimento clínico: registre só o apoio prestado.");
  if (CLINICAL.test(t)) b.push("Sem diagnóstico, CID ou termo clínico.");
  if (INTIMATE.test(t)) (domain === "higiene-autocuidado" ? a : b).push(domain === "higiene-autocuidado"
    ? "Registre apenas que o apoio de higiene foi prestado, sem detalhes íntimos." : "Detalhe íntimo desnecessário para esta categoria.");
  if (t && !/\b(apoi|auxili|acompanh|orient|ofere|ajud|conduz|posicion|organiz|utiliz|us(ou|o)\b|mostr|leu|lemb)/i.test(t)) a.push("Descreva o apoio efetivamente prestado (o que foi feito).");
  return { block: b, advise: a };
}

/** Uso de categoria num registro: designação×função×categoria vigente na data e descrição válida. */
export function checkUse(p: { cfg: CategoryConfig[] | null; functionId: string | null; date: string; categoryId: string; categoryVersion: number; text: string }) {
  const av = categoriesFor(p.cfg, p.functionId, p.date);
  if (!av.ok) return { ok: false as const, reasons: [av.reason], advise: [] as string[] };
  const c = av.categories.find((x) => x.id === p.categoryId);
  const r: string[] = [];
  if (!c) r.push("Categoria não autorizada para esta função na data.");
  else if (c.version !== p.categoryVersion) r.push("A categoria foi atualizada: releia antes de registrar.");
  const v = validateSupportDescription(p.text, c?.domain ?? "");
  r.push(...v.block);
  return r.length ? { ok: false as const, reasons: r, advise: v.advise } : { ok: true as const, advise: v.advise, ref: { categoryId: c!.id, version: c!.version, protocolRef: c!.protocolRef } };
}
