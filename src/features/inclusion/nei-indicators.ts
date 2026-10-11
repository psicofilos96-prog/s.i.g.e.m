// NEI.6 — catálogo documentado dos indicadores lidos de `nei_indicators` (0340). Nada é gravado; ausência não vira zero.
export type IndicatorRow = {
  school_id: string; followed: number; with_paee: number; with_pei: number; plans_total: number; plans_overdue: number;
  aee_services: number; aee_planned: number; aee_started: number; aee_interrupted: number;
  cases_open: number; cases_overdue: number; support_open: number; actions_open: number; actions_overdue: number;
  mediations: number; mediations_uncovered: number; protocols_sent: number; protocols_answered: number;
  protocol_reply_days_median: number | null; support_first_move_days_median: number | null; barriers_open: number;
};
export type IndicatorKey = keyof Omit<IndicatorRow, "school_id">;
export type IndicatorDef = { key: IndicatorKey; label: string; formula: string; denominator: string | null; source: string; drill?: "plans_overdue" | "cases_open" | "aee_services"; unit?: "dias" };

export const INDICATORS: readonly IndicatorDef[] = [
  { key: "followed", label: "Estudantes acompanhados", formula: "Estudantes distintos com entrada na ficha NEI, caso ou plano", denominator: null, source: "nei_profile_entries ∪ nei_cases ∪ nei_plans" },
  { key: "with_paee", label: "Estudantes com PAEE", formula: "Estudantes distintos com plano tipo PAEE (qualquer situação)", denominator: "Estudantes acompanhados", source: "nei_plans" },
  { key: "with_pei", label: "Estudantes com PEI", formula: "Estudantes distintos com plano tipo PEI", denominator: "Estudantes acompanhados", source: "nei_plans" },
  { key: "plans_overdue", label: "Planos com meta vencida", formula: "Planos cuja última versão não está concluída e tem meta com prazo anterior a hoje", denominator: "Planos registrados", source: "nei_plan_versions", drill: "plans_overdue" },
  { key: "aee_services", label: "AEE vigentes", formula: "Atendimentos AEE vigentes (última versão não encerrada)", denominator: null, source: "aee_services", drill: "aee_services" },
  { key: "aee_planned", label: "AEE planejado (não iniciado)", formula: "AEE vigentes cuja última situação da oferta é planejada ou sem registro", denominator: "AEE vigentes", source: "nei_aee_offer_events" },
  { key: "aee_started", label: "AEE iniciado", formula: "AEE vigentes com última situação iniciada ou retomada", denominator: "AEE vigentes", source: "nei_aee_offer_events" },
  { key: "aee_interrupted", label: "AEE interrompido", formula: "AEE vigentes com última situação interrompida", denominator: "AEE vigentes", source: "nei_aee_offer_events" },
  { key: "cases_open", label: "Casos em aberto", formula: "Casos cuja última etapa não é encerramento", denominator: null, source: "nei_case_events", drill: "cases_open" },
  { key: "cases_overdue", label: "Casos com prazo vencido", formula: "Casos em aberto com último prazo declarado anterior a hoje (sem prazo nunca conta)", denominator: "Casos em aberto", source: "nei_case_events" },
  { key: "support_open", label: "Pedidos de apoio em aberto", formula: "Pedidos não indeferidos, cancelados ou encerrados", denominator: null, source: "nei_support_request_events" },
  { key: "actions_open", label: "Providências abertas", formula: "Providências não concluídas nem canceladas", denominator: null, source: "nei_action_events" },
  { key: "actions_overdue", label: "Providências vencidas", formula: "Providências abertas com prazo anterior a hoje", denominator: "Providências abertas", source: "nei_actions" },
  { key: "mediations", label: "Mediações vigentes", formula: "Mediações registradas pela escola vigentes hoje", denominator: null, source: "inclusion_mediation_assignments" },
  { key: "mediations_uncovered", label: "Mediações descobertas", formula: "Mediador sem atuação vigente, ou afastado sem substituição registrada", denominator: "Mediações vigentes", source: "nei_coverage_events" },
  { key: "protocols_sent", label: "Protocolos enviados", formula: "Protocolos do NEI enviados pela escola", denominator: null, source: "nei_protocols" },
  { key: "protocols_answered", label: "Protocolos com devolutiva", formula: "Protocolos com ao menos uma devolutiva", denominator: "Protocolos enviados", source: "nei_protocol_events" },
  { key: "protocol_reply_days_median", label: "Tempo mediano até devolutiva", formula: "Mediana de dias entre envio e primeira devolutiva (só protocolos respondidos)", denominator: null, source: "nei_protocol_events", unit: "dias" },
  { key: "support_first_move_days_median", label: "Tempo mediano de 1ª resposta a pedido", formula: "Mediana de dias entre pedido e primeiro andamento", denominator: null, source: "nei_support_request_events", unit: "dias" },
  { key: "barriers_open", label: "Barreiras em aberto", formula: "Barreiras não resolvidas nem sem solução", denominator: null, source: "nei_barrier_events" },
];

const DENOM_KEY: Record<string, IndicatorKey> = {
  "Estudantes acompanhados": "followed", "Planos registrados": "plans_total", "AEE vigentes": "aee_services", "Casos em aberto": "cases_open",
  "Providências abertas": "actions_open", "Mediações vigentes": "mediations", "Protocolos enviados": "protocols_sent",
};

/** Percentual só com denominador > 0; caso contrário "não se aplica" (null), nunca 0%. */
export function share(def: IndicatorDef, row: IndicatorRow): number | null {
  if (!def.denominator) return null;
  const d = Number(row[DENOM_KEY[def.denominator]!]); const n = Number(row[def.key]);
  return d > 0 ? Math.round((n / d) * 1000) / 10 : null;
}

/** Totais da seleção: soma só contagens; medianas não se somam (ficam nulas no total). */
export function totals(rows: readonly IndicatorRow[]): IndicatorRow {
  const t = { school_id: "Total" } as IndicatorRow;
  for (const d of INDICATORS) (t as Record<string, unknown>)[d.key] = d.unit ? null : rows.reduce((s, r) => s + Number(r[d.key] ?? 0), 0);
  t.plans_total = rows.reduce((s, r) => s + Number(r.plans_total), 0);
  return t;
}
