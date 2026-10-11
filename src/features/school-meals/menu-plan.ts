/**
 * Alimentação Lote 04 — cardápios e planejamento nutricional (modelo puro).
 * Persistência: cardápio = espécie `cardapio-planejado` em meal_master_records (record_meal_master);
 * publicação às escolas = meal_menu_publications (ato append-only sobre versão homologada).
 * Parâmetros legais (per capita, metas de nutrientes) vêm só de versões homologadas; nada é presumido.
 */
export type Horizon = "semanal" | "mensal" | "semestral" | "anual";
export type MenuState = "rascunho" | "em-revisao" | "aprovado" | "publicado" | "devolvido";

export interface Slot { date: string; meal: string; preparationId: string | null; portionGrams: number | null }
export interface Substitution { date: string; meal: string; from: string; to: string; reason: string; by: string; at: string }
export interface Menu {
  id: string; horizon: Horizon; from: string; to: string;
  stage: string | null; modality: string | null; journey: string | null;
  slots: Slot[]; substitutions: Substitution[];
}

/** Grade visual: dias × refeições; vazio fica null (nunca preparação inventada). */
export function grid(m: Menu, meals: string[]) {
  const days: string[] = [];
  for (let t = Date.parse(m.from); t <= Date.parse(m.to); t += 864e5) days.push(new Date(t).toISOString().slice(0, 10));
  return days.map((d) => ({ date: d, cells: meals.map((ml) => m.slots.find((s) => s.date === d && s.meal === ml) ?? null) }));
}

export function horizonProblems(m: Menu): string[] {
  const p: string[] = [];
  const days = (Date.parse(m.to) - Date.parse(m.from)) / 864e5 + 1;
  const max = { semanal: 7, mensal: 31, semestral: 184, anual: 366 }[m.horizon];
  if (!(days > 0)) p.push("período inválido");
  else if (days > max) p.push(`período excede o horizonte ${m.horizon}`);
  if (!m.stage) p.push("etapa não declarada");
  if (!m.journey) p.push("jornada não declarada");
  for (const s of m.slots) {
    if (s.date < m.from || s.date > m.to) p.push(`${s.date}: fora do período`);
    if (s.preparationId && !s.portionGrams) p.push(`${s.date} ${s.meal}: porção não declarada`);
  }
  return p;
}

// ---------- Adequação nutricional ----------
export interface Target { nutrient: string; minPerDay: number | null; maxPerDay: number | null; paramVersion: string; homologated: boolean }
export interface PrepNutrient { preparationId: string; nutrient: string; perGram: number | null } // só fonte homologada (Lote 03)

export function adequacy(m: Menu, targets: Target[], nutrients: PrepNutrient[]) {
  const legal = targets.filter((t) => t.homologated);
  if (!legal.length) return { state: "BLOCKED_BY_HOMOLOGATED_RULE" as const, rows: [] };
  const days = [...new Set(m.slots.map((s) => s.date))];
  const rows = days.flatMap((d) => legal.map((t) => {
    const ss = m.slots.filter((s) => s.date === d && s.preparationId);
    let total: number | null = 0;
    for (const s of ss) {
      const n = nutrients.find((x) => x.preparationId === s.preparationId && x.nutrient === t.nutrient);
      if (!n || n.perGram == null || s.portionGrams == null) { total = null; break; }
      total += n.perGram * s.portionGrams;
    }
    const status = total == null ? "indeterminado" : t.minPerDay != null && total < t.minPerDay ? "abaixo" : t.maxPerDay != null && total > t.maxPerDay ? "acima" : "adequado";
    return { date: d, nutrient: t.nutrient, total: total == null ? null : Math.round(total * 100) / 100, status, paramVersion: t.paramVersion };
  }));
  return { state: "OK" as const, rows };
}

// ---------- Substituição com histórico ----------
export function substitute(m: Menu, s: Omit<Substitution, "from">): Menu | { error: string } {
  if (!s.reason.trim()) return { error: "motivo obrigatório" };
  if (!s.by) return { error: "autor humano obrigatório" };
  const slot = m.slots.find((x) => x.date === s.date && x.meal === s.meal);
  if (!slot?.preparationId) return { error: "não há preparação planejada nesse dia/refeição" };
  if (slot.preparationId === s.to) return { error: "substituição idêntica" };
  return {
    ...m,
    slots: m.slots.map((x) => (x === slot ? { ...x, preparationId: s.to } : x)),
    substitutions: [...m.substitutions, { ...s, from: slot.preparationId }],
  };
}

// ---------- Fluxo ----------
export interface Actor { id: string; isPerson: boolean; nutritionistRegistry: string | null; canReview: boolean; canPublish: boolean }
const NEXT: Record<MenuState, MenuState[]> = { rascunho: ["em-revisao"], "em-revisao": ["aprovado", "devolvido"], devolvido: ["em-revisao"], aprovado: ["publicado"], publicado: [] };

export function transition(state: MenuState, to: MenuState, actor: Actor, authorId: string, menu: Menu, note?: string): string | null {
  if (!actor.isPerson) return "transição exige pessoa natural; executor técnico não aprova nem publica";
  if (!NEXT[state].includes(to)) return `transição ${state}→${to} não permitida`;
  if (to === "em-revisao" && horizonProblems(menu).length) return "cardápio com pendências não vai à revisão";
  if (to === "devolvido" && !note?.trim()) return "devolução exige motivo";
  if ((to === "aprovado" || to === "devolvido") && !actor.nutritionistRegistry) return "aprovação/devolução só por nutricionista com registro";
  if (to === "aprovado" && actor.id === authorId) return "aprovador deve ser distinto do autor";
  if (to === "aprovado" && !actor.canReview) return "sem capability manter-planejamento-nutricional homologada";
  if (to === "publicado" && !actor.canPublish) return "sem capability de publicação homologada";
  return null;
}

// ---------- Cenários ----------
export function compareScenarios(a: Menu, b: Menu) {
  const key = (s: Slot) => `${s.date}|${s.meal}`;
  const bm = new Map(b.slots.map((s) => [key(s), s]));
  return a.slots.filter((s) => bm.get(key(s))?.preparationId !== s.preparationId).map((s) => ({ at: key(s), a: s.preparationId, b: bm.get(key(s))?.preparationId ?? null }));
}

// ---------- Impressão ----------
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export function printHtml(m: Menu, meals: string[], state: MenuState, label: (id: string) => string): string {
  const draft = state !== "publicado" ? `<p class="draft">RASCUNHO — CARDÁPIO NÃO PUBLICADO</p>` : "";
  const rows = grid(m, meals).map((r) => `<tr><th>${esc(r.date)}</th>${r.cells.map((c) => `<td>${c?.preparationId ? esc(label(c.preparationId)) + (c.portionGrams ? ` (${c.portionGrams} g)` : "") : "—"}</td>`).join("")}</tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4 landscape}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4px;font:11px sans-serif}.draft{font-weight:bold}</style></head><body>${draft}<h1>Cardápio ${esc(m.horizon)} ${esc(m.from)} a ${esc(m.to)}</h1><p>${esc(m.stage ?? "etapa não declarada")} · ${esc(m.journey ?? "jornada não declarada")}</p><table><tr><th>Dia</th>${meals.map((x) => `<th>${esc(x)}</th>`).join("")}</tr>${rows}</table></body></html>`;
}
