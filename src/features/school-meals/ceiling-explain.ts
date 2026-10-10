/**
 * ALIM-03 — teto explicado do pedido, conversão exata de embalagem e alerta de itens essenciais zerados.
 * Puro. Parâmetro ausente ou não homologado NUNCA vira bloqueio duro nem zero: vira pendência
 * que impede a autorização definitiva até revisão competente (decisão do lote ALIM-03).
 */
export type Conversion = { from: string; to: string; numerator: number; denominator: number; homologated: boolean };

/** Conversão exata em inteiros (ex.: pacote 5 kg = 5000 g ⇒ 5000/1). Sem fator homologado ⇒ null. */
export function convert(qty: number, c: Conversion | null): number | null {
  if (!c || !c.homologated || c.denominator === 0) return null;
  return (qty * c.numerator) / c.denominator;
}

export type CeilingInput = {
  perCapitaGrams: number | null; perCapitaHomologated: boolean;
  servedPublic: number | null; schoolDays: number | null;
  eligibleStockGrams: number | null; pendingDeliveriesGrams: number | null;
};

export type Ceiling =
  | { state: "calculado"; grossGrams: number; netGrams: number; formula: string }
  | { state: "pendente"; missing: string[] };

export function explainCeiling(i: CeilingInput): Ceiling {
  const missing: string[] = [];
  if (i.perCapitaGrams === null) missing.push("per capita não informado");
  else if (!i.perCapitaHomologated) missing.push("per capita não homologado");
  if (i.servedPublic === null) missing.push("público atendido não informado");
  if (i.schoolDays === null) missing.push("dias letivos da competência não resolvidos");
  if (i.eligibleStockGrams === null) missing.push("estoque elegível desconhecido");
  if (missing.length) return { state: "pendente", missing };
  const gross = i.perCapitaGrams! * i.servedPublic! * i.schoolDays!;
  const net = Math.max(0, gross - i.eligibleStockGrams! - (i.pendingDeliveriesGrams ?? 0));
  return { state: "calculado", grossGrams: gross, netGrams: net, formula: "per capita × público × dias letivos − estoque elegível − entregas pendentes" };
}

export type RequestCheck = { canAuthorize: boolean; warnings: string[] };

/** Pedido acima do teto calculado é sinalizado; teto pendente impede autorização definitiva, não o envio. */
export function checkRequest(requestedGrams: number, ceiling: Ceiling, essential: boolean, justification: string | null): RequestCheck {
  const warnings: string[] = [];
  if (ceiling.state === "pendente") warnings.push(`teto não calculável: ${ceiling.missing.join("; ")}`);
  else if (requestedGrams > ceiling.netGrams) warnings.push(`pedido excede o teto calculado em ${requestedGrams - ceiling.netGrams} g`);
  if (essential && requestedGrams === 0 && !justification?.trim()) warnings.push("item essencial zerado: confirme o saldo ou justifique");
  return { canAuthorize: ceiling.state === "calculado" && warnings.length === 0, warnings };
}

/** LOTE 9 — avaliação calculada no banco (`meal_order_ceiling_evaluation`, congelada no ato). A tela só a explica. */
export type ServerCeilingLine = {
  linha: number; item_ref: string; estado: "calculado" | "pendente"; faltas: string[]; solicitado: number | null;
  per_capita: number | null; per_capita_registro: string | null; per_capita_versao: number | null;
  publico_atendido: number | null; dias_letivos: number | null; estoque: number | null; bruto: number | null; teto: number | null;
  excede: boolean | null; justificativa_excesso: string | null; formula: string;
};
export type AuthorizationNeeds = { ackRequired: boolean; exceeding: number[]; blocked: string | null };
/** Nunca autoriza em silêncio: pendente ⇒ ciência; excesso calculado ⇒ justificativa por linha (≥10 caracteres). */
export function authorizationNeeds(lines: readonly ServerCeilingLine[]): AuthorizationNeeds {
  if (lines.length === 0) return { ackRequired: false, exceeding: [], blocked: "Pedido sem itens avaliados." };
  return {
    ackRequired: lines.some((l) => l.estado === "pendente"),
    exceeding: lines.filter((l) => l.excede === true && (l.justificativa_excesso ?? "").trim().length < 10).map((l) => l.linha),
    blocked: null,
  };
}
export function explainServerLine(l: ServerCeilingLine): string {
  if (l.estado === "pendente") return `Teto não calculável: ${l.faltas.join("; ")}.`;
  return `${l.per_capita} × ${l.publico_atendido} × ${l.dias_letivos} = ${l.bruto} − estoque ${l.estoque} ⇒ teto ${l.teto}${l.excede ? ` · pedido ${l.solicitado} excede` : ""}.`;
}
