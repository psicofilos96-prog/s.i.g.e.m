/**
 * Alimentação Lote 06 — aquisições, fornecedores e contratos (modelo puro).
 * Fornecedor e contrato continuam espécies `fornecedor`/`referencia-contratual` homologadas em
 * meal_master_records (mesmas usadas por purchase-map.ts); nada aqui cria contrato, licitação,
 * pagamento ou assinatura — o SIGEM só referencia o processo formal externo.
 * Quatro grandezas distintas, nunca somadas entre si: solicitado, contratado, entregue, aceito.
 */
export interface ContractItem { itemId: string; unitPrice: number | null; contractedQty: number | null; familyFarming: boolean | null }
export interface Contract {
  id: string; supplierId: string; homologated: boolean; processRef: string | null;
  validFrom: string; validTo: string | null; items: ContractItem[];
  supplierDocs: { kind: string; validTo: string | null }[];
}
export interface Flow { requested: number | null; delivered: number | null; accepted: number | null } // por item

export function contractProblems(c: Contract, on: string, requiredDocs: string[] | null): string[] {
  const p: string[] = [];
  if (!c.homologated) p.push("referência contratual não homologada");
  if (!c.processRef) p.push("processo formal de aquisição não referenciado");
  if (on < c.validFrom || (c.validTo && on > c.validTo)) p.push("contrato fora de vigência na data");
  if (requiredDocs == null) p.push("documentos exigidos do fornecedor não configurados");
  else for (const k of requiredDocs) {
    const d = c.supplierDocs.find((x) => x.kind === k);
    if (!d) p.push(`documento ${k} ausente`);
    else if (d.validTo && d.validTo < on) p.push(`documento ${k} vencido em ${d.validTo}`);
  }
  return p;
}

/** Saldo do contrato por item: contratado − aceito (entregue não aceito não consome saldo). */
export function balances(c: Contract, flows: Record<string, Flow>) {
  return c.items.map((i) => {
    const f = flows[i.itemId] ?? { requested: null, delivered: null, accepted: null };
    const occ: string[] = [];
    if (f.accepted != null && f.delivered != null && f.accepted > f.delivered) occ.push("aceito maior que entregue (verificar)");
    if (f.delivered != null && i.contractedQty != null && f.delivered > i.contractedQty) occ.push("entregue acima do contratado");
    if (f.requested != null && i.contractedQty != null && f.requested > i.contractedQty) occ.push("solicitado acima do contratado");
    return {
      itemId: i.itemId,
      requested: f.requested, contracted: i.contractedQty, delivered: f.delivered, accepted: f.accepted,
      pendingAcceptance: f.delivered != null && f.accepted != null ? f.delivered - f.accepted : null,
      balance: i.contractedQty != null && f.accepted != null ? i.contractedQty - f.accepted : null,
      acceptedValue: i.unitPrice != null && f.accepted != null ? r2(i.unitPrice * f.accepted) : null,
      occurrences: occ,
    };
  });
}

/** Parâmetro legal (ex.: percentual mínimo da agricultura familiar) só de versão homologada com fonte. */
export interface LegalParam { key: string; percent: number; legalRef: string; version: string; homologated: boolean }

/** Demonstrativo agricultura familiar sobre valor ACEITO; item sem marcação/preço deixa o resultado incompleto. */
export function familyFarmingStatement(contracts: Contract[], flows: Record<string, Record<string, Flow>>, param: LegalParam | null) {
  let total = 0, family = 0; const gaps: string[] = [];
  for (const c of contracts.filter((x) => x.homologated)) for (const i of c.items) {
    const acc = flows[c.id]?.[i.itemId]?.accepted;
    if (acc == null || i.unitPrice == null) { gaps.push(`${c.id}/${i.itemId}: valor aceito não apurado`); continue; }
    if (i.familyFarming == null) { gaps.push(`${c.id}/${i.itemId}: origem agricultura familiar não declarada`); continue; }
    const v = acc * i.unitPrice; total += v; if (i.familyFarming) family += v;
  }
  const share = !gaps.length && total > 0 ? r2((family / total) * 100) : null;
  if (!param || !param.homologated) return { state: "BLOCKED_BY_HOMOLOGATED_RULE" as const, total: r2(total), family: r2(family), share, gaps };
  return {
    state: gaps.length ? ("incompleto" as const) : share == null ? ("sem-base" as const) : share >= param.percent ? ("atende" as const) : ("nao-atende" as const),
    total: r2(total), family: r2(family), share, gaps,
    rule: `participação ≥ ${param.percent}% (${param.legalRef}, versão ${param.version}) sobre valor aceito`,
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
