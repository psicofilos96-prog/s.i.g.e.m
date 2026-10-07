/**
 * BU.CAL.2 — Resolvedor visual ÚNICO dos modelos externos (Panorâmico e Mosaico).
 *
 * Causa raiz corrigida: os snapshots institucionais reais (0035) gravaram `typeMap` como
 * `código do catálogo → versão do tipo` (ex.: `FERIADO → <uuid>`), enquanto `buildPrintModel` espera
 * `versão do tipo → código`. Nenhuma declaração encontrava símbolo, e a folha externa mostrava
 * "Tipo sem mapeamento visual" para todos os tipos, sem cor nem feriados.
 *
 * A normalização é por IDENTIDADE estável (código existente no catálogo visual do próprio snapshot ↔ id de
 * versão do tipo), nunca por rótulo. Só a apresentação muda: dias, efeitos e totais continuam vindo das
 * declarações (`calendar_days_at`). O snapshot gravado não é alterado e o modelo interno não usa este módulo.
 */
import { dayTypesOf, typeInfo } from "./calendar-catalog";

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Devolve `versão do tipo → código` aceitando as duas direções gravadas; entradas que não são tipo (ex.: `period:*`) são ignoradas. */
export function canonicalTypeMap(presentation: Record<string, unknown>): Record<string, string> {
  const raw = isObj(presentation["typeMap"]) ? presentation["typeMap"] : {};
  const catalog = isObj(presentation["dayTypeCatalog"]) ? presentation["dayTypeCatalog"] : {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== "string" || !v) continue;
    const keyIsCode = Object.prototype.hasOwnProperty.call(catalog, k);
    const valIsCode = Object.prototype.hasOwnProperty.call(catalog, v);
    if (valIsCode && !keyIsCode) out[k] = v; // versão → código (contrato documentado)
    else if (keyIsCode && !valIsCode) out[v] = k; // código → versão (forma gravada nos snapshots reais)
    else if (Object.keys(catalog).length === 0) out[k] = v; // sem catálogo para provar direção: contrato documentado (versão → código)
  }
  return out;
}

/** Apresentação para os externos: mesma apresentação com `typeMap` canônico. Não muda nada além do vínculo visual. */
export function externalPresentation(presentation: Record<string, unknown>): Record<string, unknown> {
  return { ...presentation, typeMap: canonicalTypeMap(presentation) };
}

export type VisualToken = Readonly<{ code: string; mark: string; label: string; bg: string; fg: string; known: boolean }>;
type Overrides = Record<string, { background?: string; foreground?: string }>;

/** Token visual de um código do catálogo. `known=false` = código ausente do catálogo (alerta explícito). */
export function resolveVisual(presentation: Record<string, unknown>, code: string, overrides: Overrides = {}): VisualToken {
  const types = dayTypesOf({ dayTypeCatalog: (presentation["dayTypeCatalog"] ?? undefined) as never });
  const known = Object.prototype.hasOwnProperty.call(types, code);
  const t = typeInfo(types, code as never);
  const o = overrides[code] ?? {};
  return { code, mark: t.mark, label: t.label, bg: o.background ?? t.background, fg: o.foreground ?? t.foreground, known };
}

/** Cobertura: todo código do catálogo do snapshot tem token conhecido; e todo tipo do `typeMap` aponta para código do catálogo. */
export function catalogCoverage(presentation: Record<string, unknown>): { codes: string[]; missing: string[] } {
  const catalog = isObj(presentation["dayTypeCatalog"]) ? presentation["dayTypeCatalog"] : {};
  const codes = Object.keys(catalog);
  const missing = codes.filter((c) => !resolveVisual(presentation, c).known);
  for (const c of Object.values(canonicalTypeMap(presentation))) if (!codes.includes(c)) missing.push(c);
  return { codes, missing };
}
