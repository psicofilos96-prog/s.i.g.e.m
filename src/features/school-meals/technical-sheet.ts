/**
 * Alimentação Lote 03 — catálogo de gêneros e fichas técnicas (modelo puro).
 * Persistência continua SÓ em meal_master_records (espécies item-alimentar, apresentacao-embalagem,
 * especificacao-tecnica, fator-de-conversao, receita-ficha-tecnica) via record_meal_master
 * (rascunho → conferida → homologada por pessoas distintas). Aqui só validação e cálculo.
 */
import { findConversion, isOperational, type MasterRow } from "./planning-model";

export interface FoodItem {
  id: string; name: string; baseUnit: string | null; storage: "seco" | "refrigerado" | "congelado" | null;
  packages: { label: string; qty: number; unit: string }[];
  allergens: string[] | null; // null = não informado (≠ nenhum)
}

/** Problemas do cadastro de gênero; vazio = pode ir à conferência. */
export function itemProblems(i: FoodItem, conversions: MasterRow[]): string[] {
  const p: string[] = [];
  if (!i.name.trim()) p.push("nome obrigatório");
  if (!i.baseUnit) p.push("unidade base obrigatória");
  if (!i.storage) p.push("forma de armazenamento obrigatória");
  if (i.allergens === null) p.push("alergênicos não informados (declarar lista, mesmo vazia)");
  for (const k of i.packages) {
    if (!(k.qty > 0)) p.push(`embalagem ${k.label}: quantidade inválida`);
    else if (i.baseUnit && k.unit !== i.baseUnit && findConversion(conversions, k.unit, i.baseUnit) === "BLOCKED_BY_HOMOLOGATED_RULE")
      p.push(`embalagem ${k.label}: sem conversão homologada ${k.unit}→${i.baseUnit} (densidade nunca é presumida)`);
  }
  return p;
}

export interface Ingredient { itemId: string; grossQty: number; unit: string; correctionFactor: number | null }
export interface NutrientSource { id: string; label: string; homologated: boolean }
export interface Sheet {
  name: string; ingredients: Ingredient[]; yieldPortions: number | null; portionGrams: number | null;
  cookingFactor: number | null; method: string; conservation: string;
  nutrients: { key: string; perPortion: number; sourceId: string | null }[];
}

/** Líquido = bruto ÷ FC (FC ≥ 1). Sem FC declarado ⇒ indeterminado, nunca 1 presumido. */
export function netQty(i: Ingredient): number | null {
  if (i.correctionFactor == null || !(i.correctionFactor >= 1)) return null;
  return round(i.grossQty / i.correctionFactor);
}

/** Escala para N porções; qualquer base ausente ⇒ bloqueado com motivo. */
export function scale(s: Sheet, portions: number): { ok: true; lines: { itemId: string; gross: number; unit: string }[] } | { ok: false; reason: string } {
  if (!s.yieldPortions || s.yieldPortions <= 0) return { ok: false, reason: "rendimento não declarado" };
  if (!(portions > 0)) return { ok: false, reason: "número de porções inválido" };
  const f = portions / s.yieldPortions;
  return { ok: true, lines: s.ingredients.map((i) => ({ itemId: i.itemId, gross: round(i.grossQty * f), unit: i.unit })) };
}

/** Rendimento pronto = soma líquida × fator de cocção (só mesma unidade). */
export function cookedYield(s: Sheet): number | null {
  if (s.cookingFactor == null || !(s.cookingFactor > 0)) return null;
  const nets = s.ingredients.map(netQty);
  if (nets.some((n) => n == null) || new Set(s.ingredients.map((i) => i.unit)).size !== 1) return null;
  return round((nets as number[]).reduce((a, b) => a + b, 0) * s.cookingFactor);
}

/** Nutriente só aparece com fonte identificada e homologada; o resto é descartado e listado. */
export function trustedNutrients(s: Sheet, sources: NutrientSource[]) {
  const ok = new Map(sources.filter((x) => x.homologated).map((x) => [x.id, x]));
  return {
    shown: s.nutrients.filter((n) => n.sourceId && ok.has(n.sourceId)).map((n) => ({ ...n, source: ok.get(n.sourceId!)!.label })),
    rejected: s.nutrients.filter((n) => !n.sourceId || !ok.has(n.sourceId)).map((n) => n.key),
  };
}

export function sheetProblems(s: Sheet, catalog: MasterRow[]): string[] {
  const p: string[] = [];
  const items = new Set(catalog.filter((r) => isOperational(r)).map((r) => r.logical_id));
  if (!s.name.trim()) p.push("nome da preparação obrigatório");
  if (!s.ingredients.length) p.push("ao menos um ingrediente");
  for (const i of s.ingredients) {
    if (!items.has(i.itemId)) p.push(`ingrediente ${i.itemId}: gênero não homologado no catálogo`);
    if (!(i.grossQty > 0)) p.push(`ingrediente ${i.itemId}: quantidade inválida`);
    if (netQty(i) == null) p.push(`ingrediente ${i.itemId}: fator de correção não declarado ou < 1`);
  }
  if (!s.yieldPortions) p.push("rendimento obrigatório");
  if (!s.portionGrams) p.push("porção obrigatória");
  if (!s.method.trim()) p.push("modo de preparo obrigatório");
  if (!s.conservation.trim()) p.push("conservação obrigatória");
  return p;
}

/** Aprovação: só profissional com registro, distinto do autor. */
export function canApprove(a: { authorId: string; approverId: string; approverRegistry: string | null }): string | null {
  if (!a.approverRegistry) return "aprovação exige nutricionista com registro profissional";
  if (a.approverId === a.authorId) return "aprovador deve ser pessoa distinta do autor";
  return null;
}

const round = (n: number) => Math.round(n * 1000) / 1000;
