// Centro de Operações L23 — 16 relatórios de Transporte, 15 de Infraestrutura e 18 de Patrimônio/Almoxarifado sobre o
// motor comum. Cada um declara fonte (tabela/projeção canônica lida com a sessão), metodologia e unidade de contagem;
// sem configuração aprovada declara dependência e recusa execução. Nominal e exportação exigem capacidade própria.
import { runReport, toCsv, toXlsx, toPrintableHtml, type Branding, type CellValue, type ColumnDef, type ParamDef, type ReportDefinition, type ReportRequest, type ReportResult } from "@/features/reports/report-engine";

export type OpsSector = "transporte" | "infraestrutura" | "patrimonio";

const PARAMS: readonly ParamDef[] = [
  { id: "asOf", label: "Data de referência", type: "date", required: true },
  { id: "knownAt", label: "Conhecido até", type: "datetime", required: true },
  { id: "scope", label: "Escopo", type: "enum", required: true, options: ["escola", "rede"] },
  { id: "from", label: "Período — início", type: "date", required: false },
];

export const OPS_COLUMNS: readonly ColumnDef[] = [
  { id: "escola", label: "Escola", kind: "text" },
  { id: "item", label: "Item", kind: "text" },
  { id: "pessoa", label: "Pessoa", kind: "text", sensitive: true },
  { id: "valor", label: "Valor", kind: "number" },
  { id: "unidade", label: "Unidade de contagem", kind: "text" },
  { id: "situacao", label: "Situação", kind: "text" },
  { id: "data", label: "Data", kind: "date" },
  { id: "motivo", label: "Motivo/lacuna", kind: "text" },
];

export type OpsReportDefinition = ReportDefinition & Readonly<{ sector: OpsSector; methodology: string; unit: string; nominal: boolean }>;
const d = (sector: OpsSector, id: string, title: string, source: string, unit: string, methodology: string, o: { nominal?: boolean; dependency?: string } = {}): OpsReportDefinition => ({
  id: `ops-${sector}-${id}`, version: 1, title, description: methodology, source, methodology, unit, sector, nominal: o.nominal ?? false,
  params: PARAMS, columns: OPS_COLUMNS, formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 20000, dependency: o.dependency ?? null,
});

const T = (id: string, t: string, s: string, u: string, m: string, o?: { nominal?: boolean; dependency?: string }) => d("transporte", id, t, s, u, m, o);
const I = (id: string, t: string, s: string, u: string, m: string, o?: { nominal?: boolean; dependency?: string }) => d("infraestrutura", id, t, s, u, m, o);
const P = (id: string, t: string, s: string, u: string, m: string, o?: { nominal?: boolean; dependency?: string }) => d("patrimonio", id, t, s, u, m, o);

export const OPS_REPORTS: readonly OpsReportDefinition[] = [
  T("solicitacoes", "Solicitações de transporte", "ops_transport_requests", "solicitação", "Solicitações por escola e situação projetada das decisões."),
  T("autorizacoes", "Autorizações vigentes", "ops_transport_decisions", "estudante-unico", "Última decisão autorização/mantida vigente na data; estudante distinto.", { nominal: true }),
  T("indeferimentos", "Indeferimentos e revogações", "ops_transport_decisions", "decisão", "Decisões de indeferimento/revogação com regra aplicada."),
  T("reavaliacoes", "Reavaliações pendentes", "ops_transport_reevaluation_queue", "solicitação", "Autorizações cuja matrícula/turno/ponto mudou; nunca revogação automática."),
  T("rotas", "Rotas vigentes", "ops_route_versions + ops_route_approvals", "rota", "Versão aprovada vigente na data, turno e escolas atendidas."),
  T("pontos", "Pontos e avaliação de segurança", "ops_stop_safety_assessments", "ponto", "Última avaliação por ponto; sem avaliação = não avaliado."),
  T("ocupacao", "Ocupação por rota", "ops_route_versions + ops_transport_decisions", "lugar", "Autorizados por rota vs capacidade com fonte; contagem por ponto suprimida abaixo do limiar.", { dependency: "limiar de supressão não aprovado" }),
  T("frota", "Frota e situação dos veículos", "ops_vehicles + ops_vehicle_events", "veículo", "Apto/inapto/indeterminado projetado; documentos exigidos só de configuração.", { dependency: "documentos exigidos e validade da vistoria não configurados" }),
  T("documentos-veiculos", "Documentos de veículos a vencer", "ops_vehicle_events", "documento", "Documentos por validade na data de referência."),
  T("equipe", "Motoristas e monitores designados", "ops_crew_designations", "pessoa", "Designações vigentes com ato juntado.", { nominal: true }),
  T("habilitacoes", "Habilitações a vencer", "ops_crew_credentials + ops_crew_requirement_versions", "habilitação", "Habilitações exigidas pela versão aprovada, por validade.", { nominal: true }),
  T("viagens", "Viagens planejadas, programadas e realizadas", "ops_trips + ops_trip_executions", "viagem", "Estado por estágio; data passada sem execução = pendente de registro."),
  T("nao-realizadas", "Viagens não realizadas", "ops_trip_executions", "viagem", "Não realizadas com motivo declarado."),
  T("ocorrencias", "Ocorrências e providências", "ops_trip_occurrences + ops_trip_occurrence_measures", "ocorrência", "Por categoria; sem providência = em aberto."),
  T("quilometragem", "Quilometragem realizada", "ops_trip_executions", "km", "Soma km_fim − km_início de viagens realizadas; ausente fora da conta."),
  T("medicoes-custos", "Medições e custos de contratos", "ops_transport_measurements + ops_transport_costs", "medição", "Medição derivada das execuções; custo só com comprovante e referência oficial, senão não informado."),

  I("espacos", "Espaços por escola", "ops_spaces", "espaço", "Hierarquia prédio→ambiente vigente; tipo só de versão aprovada."),
  I("capacidade-apta", "Capacidade apta", "works-restrictions.aptCapacity", "lugar", "Capacidade com fonte menos restrições; sem fonte ou disponibilidade = indeterminada."),
  I("acessibilidade", "Acessibilidade dos espaços", "ops_spaces", "espaço", "Atributos do tipo configurado; ausente = não informada."),
  I("condicao", "Condição dos espaços", "ops_spaces", "espaço", "Condição com data de avaliação; sem data = não avaliada."),
  I("vistorias", "Vistorias programadas e realizadas", "ops_inspections", "vistoria", "Por checklist aprovado; vistoria não é laudo."),
  I("itens-nao-conformes", "Itens não conformes", "ops_inspections", "item", "Respostas não conformes da última vistoria; item sem resposta = não verificado."),
  I("solicitacoes-manutencao", "Solicitações de manutenção", "ops_requests", "solicitação", "Solicitações do setor infraestrutura por escola."),
  I("ordens-manutencao", "Ordens de manutenção por etapa", "ops_maintenance_orders", "ordem", "Etapa atual imposta pelo banco; urgência com motivo."),
  I("ordens-servico", "Ordens de serviço", "ops_service_orders", "ordem", "Estado; executada só após confirmação fora da equipe."),
  I("custos-servico", "Custos de serviços", "ops_service_orders", "ordem", "Custo só com comprovante; sem comprovante = não informado."),
  I("preventiva", "Manutenção preventiva a vencer", "ops_preventive_plans", "plano", "Próxima data a partir de serviço confirmado; janela só com limiar configurado.", { dependency: "janela de alerta não configurada" }),
  I("reincidencia", "Reincidência de problemas", "ops_maintenance_orders", "espaço", "Corretivas repetidas no espaço acima do limiar configurado.", { dependency: "limiar de reincidência não configurado" }),
  I("obras", "Obras e intervenções", "ops_works + ops_work_events", "obra", "Estado projetado, cronograma e recebimento por pessoa distinta."),
  I("restricoes", "Restrições de uso vigentes", "ops_space_use_restrictions", "restrição", "Restrições impostas e não levantadas na data."),
  I("certificados", "Certificados de segurança referenciados", "ops_preventive_plans", "espaço", "Só referência a documento juntado; ausente = sem certificado registrado."),

  P("bens", "Bens permanentes por escola", "ops_assets + ops_asset_events", "bem", "Localização vigente pela cadeia; sem baixa."),
  P("tombamento", "Bens com e sem tombamento oficial", "ops_asset_events", "bem", "Tombamento com fonte e documento; código interno não é tombamento."),
  P("categorias", "Bens por categoria", "ops_assets", "bem", "Categoria de versão aprovada."),
  P("estado", "Estado de conservação", "ops_asset_events", "bem", "Último estado do catálogo da categoria."),
  P("responsaveis", "Responsáveis por bens", "ops_asset_events", "bem", "Responsável = atuação vigente da escola.", { nominal: true }),
  P("transferencias", "Transferências de bens", "ops_asset_transfers", "transferência", "Solicitação→autorização→envio→recebimento; em trânsito sem mudança de localização."),
  P("inventarios", "Inventários", "ops_asset_inventories", "inventário", "Escopo, fotografia congelada e encerramento por pessoa fora da equipe."),
  P("divergencias", "Divergências de inventário", "ops_asset_inventories", "bem", "Esperado×conferido; cada divergência com providência."),
  P("manutencao-bens", "Manutenção de bens", "ops_asset_events", "bem", "Vínculos a ordens de manutenção da mesma escola."),
  P("baixas", "Baixas e destinação", "ops_asset_disposals", "processo", "Só por processo autorizado e destinado; nunca exclusão."),
  P("catalogo-consumo", "Catálogo de materiais de consumo", "ops_supply_items", "item", "Versão aprovada; gêneros alimentícios ficam no NAE."),
  P("saldos", "Saldos por depósito", "ops_supply_movements", "unidade do item", "Saldo derivado dos movimentos válidos; nunca digitado."),
  P("movimentos", "Entradas e saídas", "ops_supply_movements", "movimento", "Movimentos append-only com documento/destino/motivo."),
  P("lotes-validade", "Lotes e validades", "ops_supply_movements", "lote", "Só itens que exigem lote; vencido só descartável."),
  P("ajustes", "Ajustes autorizados", "ops_supply_movements", "movimento", "Ajustes com pedido e aprovação por outra pessoa."),
  P("requisicoes", "Requisições de materiais", "ops_supply_requisitions", "requisição", "Fluxo até recebimento, atendimento parcial justificado."),
  P("estoque-minimo", "Itens abaixo do mínimo", "ops_supply_min_levels", "item", "Saldo abaixo do mínimo aprovado; sem mínimo = sem referência."),
  P("previsao", "Previsão de cobertura", "supply-requisitions.forecast", "dia", "Consumo médio do período; sem consumo = não calculável; sem compra automática."),
];

export const OPS_EXPORT_CAP = "exportar-relatorios-de-operacoes";
export const OPS_NOMINAL_CAP = "ler-relatorio-nominal-de-operacoes";

export type OpsRow = Readonly<Partial<Record<string, CellValue>>>;
export function runOpsReport(id: string, req: ReportRequest, rows: readonly OpsRow[], caps: ReadonlySet<string>): { def: OpsReportDefinition; result: ReportResult } {
  const def = OPS_REPORTS.find((r) => r.id === id);
  if (!def) throw new Error(`report:unknown:${id}`);
  if (req.includeSensitive && !caps.has(OPS_NOMINAL_CAP)) throw new Error("report:nominal-not-authorized");
  const src = rows.map((r) => { const o: Record<string, CellValue> = {}; for (const c of OPS_COLUMNS) o[c.id] = (r[c.id] as CellValue) ?? null; o["unidade"] = def.unit; return o; });
  return { def, result: runReport(def, req, src) };
}

export function opsReportMeta(def: OpsReportDefinition, result: ReportResult): string[] {
  return [`Fonte: ${def.source}`, `Metodologia: ${def.methodology}`, `Unidade de contagem: ${def.unit}`,
    `Data de referência: ${String(result.params["asOf"])}`, `Conhecido até: ${String(result.params["knownAt"])}`, `Gerado em: ${result.generatedAt}`];
}

export async function exportOpsReport(def: OpsReportDefinition, result: ReportResult, branding: Branding, format: "csv" | "xlsx" | "pdf", caps: ReadonlySet<string>) {
  if (!caps.has(OPS_EXPORT_CAP)) throw new Error("report:export-not-authorized");
  const meta = opsReportMeta(def, result);
  return format === "csv" ? toCsv(result, branding, meta) : format === "xlsx" ? toXlsx(result, branding, meta) : toPrintableHtml(result, branding, meta);
}
