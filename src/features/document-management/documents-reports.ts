// L24 — 20 relatórios documentais declarados (fonte, metodologia). Fonte sem tabela no banco
// ou norma ausente ⇒ bloqueado com motivo; ausência nunca vira zero.
export interface DocReport { key: string; title: string; source: string; methodology: string; blocker: string | null }
const r = (key: string, title: string, source: string, methodology: string, blocker: string | null = null): DocReport => ({ key, title, source, methodology, blocker });

export const DOC_REPORTS: readonly DocReport[] = [
  r("protocolos-periodo", "Protocolos por período", "protocol_registrations", "Contagem por data de registro, canal e unidade."),
  r("protocolos-classificacao", "Protocolos por classificação", "protocol_registrations", "Agrupamento pelo código informado.", "Plano de classificação aprovado ausente: agrupa por texto informado."),
  r("processos-abertos", "Processos em andamento", "admin_case_files + admin_case_events", "Último evento de estado ≠ concluído."),
  r("processos-concluidos", "Processos concluídos", "admin_case_events", "Último evento de estado = concluído."),
  r("reaberturas", "Reaberturas", "admin_case_events", "Eventos 'reaberto' com justificativa."),
  r("tramitacoes-pendentes", "Tramitações aguardando recebimento", "admin_case_dispatches", "Envio sem recebido/devolvido."),
  r("tramitacoes-prazo", "Tramitações com prazo vencido", "admin_case_dispatches", "Só envios com prazo declarado e fundamento."),
  r("caixa-unidade", "Caixa de entrada por unidade", "admin_unit_inbox", "Por situação; sem ranking."),
  r("ciencias", "Ciências registradas", "admin_case_inbox_acts", "Uma por pessoa e tramitação."),
  r("atos-por-especie", "Atos por espécie", "admin_case_acts", "Despacho/parecer/encaminhamento/decisão."),
  r("decisoes", "Decisões", "admin_case_act_versions", "Versão vigente das decisões com dispositivo."),
  r("revisoes", "Revisões aprovadas e devolvidas", "admin_act_reviews", "Por veredito."),
  r("assinaturas", "Assinaturas", "admin_act_signatures", "Por nível; qualificada só com evidência."),
  r("numeracao", "Numeração emitida e cancelada", "document_number_allocations", "Sequência por tipo/unidade/ano; cancelado não reutilizado.", "Nenhuma regra de numeração aprovada."),
  r("anexos-sensiveis", "Acessos a anexos sensíveis", "admin_case_sensitive_access_log", "Leitura com finalidade."),
  r("concessoes-acesso", "Concessões de acesso", "admin_case_access_grants", "Vigentes e revogadas."),
  r("digitalizacoes", "Digitalizações e conferências", "admin_case_digitizations", "Conferida por pessoa diferente."),
  r("arquivo", "Situação arquivística", "admin_case_archival_events", "Fase por processo.", "Tabela de temporalidade aprovada ausente."),
  r("eliminacoes", "Eliminações propostas/autorizadas", "admin_case_archival_events", "Nenhuma eliminação automática.", "Tabela de temporalidade aprovada ausente."),
  r("prazos-configurados", "Regras de prazo", "admin_case_deadline_rules", "Só aprovadas com decisão.", "Nenhuma regra de prazo aprovada."),
];
