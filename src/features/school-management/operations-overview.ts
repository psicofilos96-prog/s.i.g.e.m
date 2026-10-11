// SIGEM 2.0 — Direção, Lote 07: NEI, alimentação, infraestrutura e patrimônio (núcleo puro).
// Só projeta o que os readers dos setores já devolvem (nei_dashboard, meal_kitchen_day_at/meal_reporting_summary,
// asset-core, cadastro canônico); a Direção nunca edita prescrição, nunca movimenta bem e nunca vê dado clínico.

/** NEI: só contagens por escola; grupo 1–4 suprimido; nenhum campo clínico ou nominal atravessa. */
export function neiOverview(counts: Record<string, number | null>, suppressBelow = 5) {
  const out: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(counts)) {
    if (/cid|laudo|diagn|clinic/i.test(k)) continue;
    out[k] = v == null ? "não disponível" : v > 0 && v < suppressBelow ? "suprimido (grupo pequeno)" : v;
  }
  return out;
}

/** Alimentação: previsto/servido/entregas/ocorrências como grandezas separadas; ausente ≠ 0; prescrição só referência. */
export function mealsOverview(d: { menuVersionId: string | null; forecast: number | null; served: number | null; deliveries: { status: string }[] | null; nonconformities: number | null; stockKnown: boolean }) {
  const nr = "não informado";
  return { cardapio: d.menuVersionId ?? "sem cardápio publicado", previsto: d.forecast ?? nr, servido: d.served ?? nr,
    entregas: d.deliveries ?? nr, ocorrencias: d.nonconformities ?? nr, insumos: d.stockKnown ? "ver estoque do livro" : nr,
    editavel: false as const };
}

/** Infraestrutura: serviço só confirmado com evidência e por pessoa ≠ executor. */
export function confirmService(os: { id: string; executedBy: string | null; evidenceIds: string[] }, by: string, isNaturalPerson: boolean) {
  if (!isNaturalPerson) return { ok: false as const, code: "infra:autor-humano-obrigatorio" };
  if (!os.executedBy) return { ok: false as const, code: "infra:sem-execucao" };
  if (by === os.executedBy) return { ok: false as const, code: "infra:autoconfirmacao" };
  if (!os.evidenceIds.length) return { ok: false as const, code: "infra:sem-evidencia" };
  return { ok: true as const, confirmation: { osId: os.id, by, evidenceIds: os.evidenceIds } };
}

/** Patrimônio: Direção só comunica irregularidade; movimentação/baixa ficam no setor de patrimônio. */
export function reportAssetIrregularity(a: { assetId: string; schoolId: string }, actorSchoolId: string, description: string) {
  if (a.schoolId !== actorSchoolId) return { ok: false as const, code: "patrimonio:fora-da-escola" };
  if (!description.trim()) return { ok: false as const, code: "patrimonio:descricao-obrigatoria" };
  return { ok: true as const, protocol: { sector: "patrimonio" as const, assetId: a.assetId, description, movesAsset: false as const } };
}

// ── Protocolos aos setores com SLA configurável ──
export type Sector = "nei" | "alimentacao" | "infraestrutura" | "patrimonio";
export interface SlaRule { sector: Sector; kind: string; businessDays: number; homologated: boolean }
export interface SectorProtocol { id: string; sector: Sector; kind: string; openedOn: string; events: { type: "aberto" | "respondido" | "encerrado"; on: string; by: string }[] }

/** Prazo só com regra homologada e dias úteis lidos do calendário; sem isso, sem prazo (nunca presumido). */
export function slaStatus(p: SectorProtocol, rules: SlaRule[], schoolDays: string[] | null, today: string) {
  const rule = rules.find((r) => r.sector === p.sector && r.kind === p.kind && r.homologated);
  if (!rule) return { state: "sem-prazo" as const, reason: "SLA não configurado/homologado" };
  if (!schoolDays) return { state: "sem-prazo" as const, reason: "calendário não lido" };
  const after = schoolDays.filter((d) => d > p.openedOn).sort();
  const due = after[rule.businessDays - 1];
  if (!due) return { state: "sem-prazo" as const, reason: "calendário não cobre o prazo" };
  const closed = p.events.find((e) => e.type === "encerrado");
  const ref = closed?.on ?? today;
  return { state: closed ? (ref <= due ? "cumprido" : "cumprido-com-atraso") : ref <= due ? "no-prazo" : "vencido", due } as const;
}
