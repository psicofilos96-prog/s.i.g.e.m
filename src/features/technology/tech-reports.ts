// SIGEM Tecnologia L23 — 22 relatórios declarados (fonte, metodologia, data de referência, filtros, unidade).
// Relatório só lê linhas que a RLS de quem consulta devolve; dependência não satisfeita ⇒ bloqueado com motivo.
// Ficha com linha do tempo = projeção ordenada dos ledgers canônicos, sem gravação.

export type TechFilter = "escola" | "periodo" | "categoria" | "natureza" | "servico" | "fase" | "prioridade" | "grupo";

export interface TechReport {
  key: string;
  title: string;
  sources: readonly string[];
  methodology: string;
  dateBasis: string;
  filters: readonly TechFilter[];
  unit: string;
  dependency?: string;
}

const R = (key: string, title: string, sources: string[], methodology: string, dateBasis: string, filters: TechFilter[], unit: string, dependency?: string): TechReport =>
  ({ key, title, sources, methodology, dateBasis, filters, unit, ...(dependency ? { dependency } : {}) });

export const TECH_REPORTS: readonly TechReport[] = [
  R("t01", "Chamados abertos por escola", ["ops_requests", "ops_request_events"], "Contagem de chamados do setor tecnologia sem conclusão vigente.", "data de abertura", ["escola", "periodo", "categoria"], "chamados"),
  R("t02", "Incidentes × requisições", ["tech_ticket_records"], "Natureza vigente = último registro do chamado.", "data do registro", ["escola", "periodo", "natureza"], "chamados"),
  R("t03", "Cumprimento de prazos (SLA)", ["tech_sla_policy_versions", "ops_request_events"], "Prazo projetado pela política aprovada; sem política ⇒ não avaliado.", "data de abertura", ["escola", "periodo", "prioridade"], "chamados", "politica-sla-aprovada"),
  R("t04", "Fila e carga por grupo de suporte", ["tech_support_groups", "tech_ticket_routings"], "Chamados abertos por grupo vigente; sem rodízio presumido.", "data da consulta", ["escola", "grupo"], "chamados"),
  R("t05", "Atendimentos presenciais e remotos", ["tech_service_sessions"], "Sessões vigentes (retificadas substituem a anterior).", "início da sessão", ["escola", "periodo"], "sessões"),
  R("t06", "Verificações e reaberturas", ["tech_ticket_reviews", "ops_request_events"], "Verificação por pessoa ≠ executor; reabertura pelo evento canônico.", "data do evento", ["escola", "periodo"], "chamados"),
  R("t07", "Problemas recorrentes candidatos", ["tech_recurrence_rule_versions", "tech_ticket_records"], "Agrupamento escola+categoria+objeto na janela da regra aprovada.", "data do incidente", ["escola", "categoria"], "grupos", "regra-de-recorrencia-aprovada"),
  R("t08", "Problemas (PRB) por fase", ["tech_problems", "tech_problem_events"], "Fase = último evento do problema.", "data do evento", ["escola", "fase"], "problemas"),
  R("t09", "Mudanças (MUD) e reversões", ["tech_changes", "tech_change_events"], "Fase = último evento; reversão não apaga execução.", "data do evento", ["escola", "fase", "periodo"], "mudanças"),
  R("t10", "Inventário de equipamentos", ["ops_assets", "tech_equipment_sheets"], "Bens em categoria marcada como tecnologia aprovada.", "data da consulta", ["escola", "categoria"], "bens", "categoria-tecnologica-aprovada"),
  R("t11", "Lacunas e séries duplicadas", ["tech_equipment_sheets"], "Ficha ausente/incompleta e número de série repetido.", "data da consulta", ["escola"], "bens", "categoria-tecnologica-aprovada"),
  R("t12", "Ciclo de vida dos equipamentos", ["ops_asset_events", "ops_maintenance_orders", "ops_service_orders"], "Serviço só após confirmação; fim de vida indeterminado sem regra.", "data do evento", ["escola", "categoria"], "bens", "regra-de-vida-util-aprovada"),
  R("t13", "Conectividade medida × contratada", ["tech_connectivity_links", "tech_connectivity_measurements"], "Mediana só de medições verificadas por pessoa ≠ autor.", "data da medição", ["escola", "periodo"], "escolas"),
  R("t14", "Mapa de conectividade agregado", ["tech_connectivity_measurements", "institutional_schools"], "Estado por escola agregado por rede; supressão com limiar declarado.", "data da medição", ["periodo"], "escolas", "limiar-de-supressao-aprovado"),
  R("t15", "Catálogo digital e atenção LGPD", ["tech_digital_service_versions"], "Última versão aprovada por serviço; classes de dado declaradas.", "data da aprovação", ["servico"], "serviços"),
  R("t16", "Pedidos de acesso por fase", ["tech_access_requests", "tech_access_request_events"], "Fase = último evento; vencimento só com periodicidade declarada.", "data do pedido", ["servico", "fase", "periodo"], "pedidos"),
  R("t17", "Incidentes de segurança (restrito)", ["tech_security_incidents", "tech_security_incident_events"], "Só para capacidade de segurança; relator vê código/fase.", "data do registro", ["fase", "periodo"], "incidentes"),
  R("t18", "Backups e restaurações verificadas", ["tech_backup_plan_versions", "tech_backup_runs", "tech_restore_tests"], "Verificado = restauração bem-sucedida com checksum igual por pessoa ≠ executor.", "data da execução", ["servico", "periodo"], "planos"),
  R("t19", "Conhecimento técnico e autosserviço", ["tech_kb_links", "tech_selfservice_summary"], "Só agregados; taxa só acima do mínimo declarado.", "data do retorno", ["categoria", "servico"], "artigos", "minimo-de-respostas-declarado"),
  R("t20", "Recursos pedagógicos avaliados", ["tech_pedagogical_evaluations"], "Avaliações na versão e rubrica vigentes; divergência sem média.", "data da avaliação", ["servico"], "recursos", "rubrica-aprovada"),
  R("t21", "Projetos, laboratórios e empréstimos", ["tech_innovation_projects", "tech_lab_designations", "tech_equipment_loans"], "Uso e percepção não comprovam aprendizagem; empréstimo aberto = sem devolução.", "data do ato", ["escola", "periodo"], "registros"),
  R("t22", "Licenças e plano anual", ["tech_license_versions", "tech_annual_plan_versions", "tech_access_request_events"], "Uso = acessos ativos; plano vigente só aprovado por pessoa ≠ autor; sem valor sem fonte contábil.", "data da consulta", ["servico"], "licenças"),
];

export type ReportStatus = { status: "disponivel" } | { status: "bloqueado"; reason: string };

export function reportStatus(r: TechReport, satisfied: ReadonlySet<string>): ReportStatus {
  return r.dependency && !satisfied.has(r.dependency) ? { status: "bloqueado", reason: r.dependency } : { status: "disponivel" };
}

/** Filtro só sobre os declarados no relatório; desconhecido é recusado. */
export function validFilters(r: TechReport, filters: Record<string, string>): string[] {
  return Object.keys(filters).filter((k) => !(r.filters as readonly string[]).includes(k));
}

export interface TimelineItem { at: string; source: string; label: string; seq?: number }

/** Linha do tempo: ordem por data, depois fonte+seq; itens sem data ficam fora e são contados. */
export function buildTimeline(items: TimelineItem[]): { items: TimelineItem[]; undated: number } {
  const dated = items.filter((i) => i.at && !Number.isNaN(Date.parse(i.at)));
  dated.sort((a, b) => a.at.localeCompare(b.at) || a.source.localeCompare(b.source) || (a.seq ?? 0) - (b.seq ?? 0));
  return { items: dated, undated: items.length - dated.length };
}
