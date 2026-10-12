/**
 * Lote corretivo 08 — Central operacional de Tecnologia (`/tecnologia/operacao`).
 * Declarativo: lê só tabelas de 0403/0477–0495 sob a RLS de quem consulta (sem colunas ocultas `*_ref`,
 * sem texto livre de relato/justificativa) e grava só pelos writers SECURITY DEFINER existentes. Nenhuma
 * tabela nova, nenhum INSERT/UPDATE direto: o banco revalida capacidade, escopo, sequência, autor ≠ aprovador.
 */
import type { ActionField, OperationStage } from "@/features/enrollments/enrollment-operations";

const t = (arg: string, label: string, hint?: string): ActionField => ({ arg, label, kind: "text", ...(hint ? { hint } : {}) });
const u = (arg: string, label: string, optional = false, hint?: string): ActionField => ({ arg, label, kind: "uuid", optional, ...(hint ? { hint } : {}) });
const n = (arg: string, label: string, hint?: string): ActionField => ({ arg, label, kind: "int", ...(hint ? { hint } : {}) });
const seq = (arg = "_expected_seq"): ActionField => ({ arg, label: "Sequência esperada (último registro lido)", kind: "int", hint: "0 quando ainda não há registro" });
const ver = (arg = "_expected"): ActionField => ({ arg, label: "Versão esperada (última lida)", kind: "int", hint: "0 quando ainda não há versão" });
const why = (arg = "_reason", label = "Justificativa"): ActionField => ({ arg, label, kind: "text" });
const opt = (f: ActionField): ActionField => ({ ...f, optional: true });
const doc = (arg: string, label = "Juntada no SIGEM Documentos", optional = true): ActionField => u(arg, label, optional, "identificador da juntada; o arquivo nunca é lido aqui");

export const TECH_STAGES: readonly OperationStage[] = [
  {
    id: "chamados", title: "Chamados e fila", summary: "Abrir chamado (setor tecnologia), reclassificar natureza, classificar por categoria aprovada, encaminhar a um grupo e registrar eventos do protocolo canônico (atribuição, conclusão, reabertura).",
    reads: [
      { label: "Chamados (códigos)", table: "tech_ticket_records", columns: ["request_id", "seq", "ticket_code", "nature", "created_at"], order: "created_at" },
      { label: "Eventos do chamado", table: "ops_request_events", columns: ["request_id", "seq", "kind", "responsible_engagement", "valid_from", "created_at"], order: "created_at" },
      { label: "Grupos de suporte", table: "tech_support_groups", columns: ["id", "school_id", "group_key", "label", "created_at"], order: "created_at" },
      { label: "Encaminhamentos", table: "tech_ticket_routings", columns: ["request_id", "seq", "group_id", "created_at"], order: "created_at" },
      { label: "Categorias de chamado", table: "tech_ticket_category_versions", columns: ["id", "category_key", "version", "label", "requires_attachment", "created_at"], order: "created_at" },
    ],
    actions: [
      { id: "abrir", label: "Abrir chamado", rpc: "tech_open_ticket", keyArg: "_key", fields: [t("_school", "Escola (identificador)"), t("_nature", "Natureza", "incidente ou requisição"), t("_kind", "Tipo"), t("_subject", "Assunto (sem dado pessoal)")] },
      { id: "reclassificar", label: "Reclassificar natureza", rpc: "tech_reclassify_ticket", keyArg: "_key", fields: [u("_request", "Chamado"), seq(), t("_nature", "Nova natureza"), why()] },
      { id: "classificar", label: "Classificar por categoria", rpc: "tech_classify_ticket", keyArg: "_key", fields: [u("_request", "Chamado"), seq(), u("_category_version", "Versão da categoria"), { arg: "_answers", label: "Respostas do formulário (JSON)", kind: "json" }, why()] },
      { id: "evento", label: "Registrar evento do chamado", rpc: "record_ops_request_event", keyArg: "_key", fields: [
        u("_request", "Chamado"), seq(), t("_kind", "Evento", "ex.: atribuicao, conclusao, reabertura"),
        u("_engagement", "Atuação responsável", true), u("_protocol", "Protocolo", true), opt(t("_object_kind", "Tipo do objeto vinculado")), opt(t("_object_ref", "Objeto vinculado")),
        { arg: "_valid_from", label: "Vigente desde", kind: "date", optional: true }, doc("_case_event", "Anexo (juntada)"), opt(t("_note", "Observação")),
      ] },
      { id: "grupo", label: "Criar grupo de suporte", rpc: "tech_create_support_group", keyArg: "_key", fields: [t("_school", "Escola"), t("_group_key", "Chave do grupo"), t("_label", "Nome do grupo")] },
      { id: "membro", label: "Incluir/retirar membro", rpc: "record_tech_group_member", keyArg: "_key", fields: [u("_group", "Grupo"), seq(), t("_action", "Ação", "incluir ou retirar"), u("_engagement", "Atuação"), why()] },
      { id: "encaminhar", label: "Encaminhar a grupo", rpc: "tech_route_ticket", keyArg: "_key", fields: [u("_request", "Chamado"), seq(), u("_group", "Grupo"), why()] },
      { id: "categoria", label: "Propor categoria de chamado", rpc: "record_tech_ticket_category", keyArg: "_key", fields: [t("_key_cat", "Chave da categoria"), t("_label", "Nome"), { arg: "_fields", label: "Campos do formulário (JSON)", kind: "json" }, { arg: "_requires_attachment", label: "Exige anexo?", kind: "bool" }, why()] },
      { id: "aprovar-categoria", label: "Aprovar categoria (outra pessoa)", rpc: "approve_tech_ticket_category", fields: [u("_version", "Versão da categoria"), t("_decision", "Decisão")] },
    ],
  },
  {
    id: "sla", title: "SLA", summary: "Política de impacto × urgência versionada com fonte; só vale após aprovação por pessoa diferente do autor. A prioridade é gravada pelo banco a partir da matriz.",
    reads: [
      { label: "Políticas de SLA", table: "tech_sla_policy_versions", columns: ["id", "version", "pause_on_wait", "source", "created_at"], order: "created_at" },
      { label: "Aprovações", table: "tech_sla_policy_approvals", columns: ["policy_version_id", "decision", "created_at"], order: "created_at" },
      { label: "Avaliações de chamado", table: "tech_ticket_assessments", columns: ["request_id", "seq", "impact", "urgency", "priority", "created_at"], order: "created_at" },
    ],
    actions: [
      { id: "politica", label: "Propor política de SLA", rpc: "record_tech_sla_policy", keyArg: "_key", fields: [
        { arg: "_impacts", label: "Impactos (JSON)", kind: "json" }, { arg: "_urgencies", label: "Urgências (JSON)", kind: "json" }, { arg: "_matrix", label: "Matriz (JSON)", kind: "json" },
        { arg: "_deadlines", label: "Prazos em horas (JSON)", kind: "json" }, { arg: "_alerts", label: "Alertas em % (JSON)", kind: "json" }, { arg: "_pause_on_wait", label: "Pausa enquanto aguarda solicitante?", kind: "bool" },
        t("_source", "Fonte normativa"), why(),
      ] },
      { id: "aprovar", label: "Aprovar política (outra pessoa)", rpc: "approve_tech_sla_policy", fields: [u("_version", "Versão"), t("_decision", "Decisão")] },
      { id: "avaliar", label: "Avaliar impacto e urgência", rpc: "tech_assess_ticket", keyArg: "_key", fields: [u("_request", "Chamado"), seq(), t("_impact", "Impacto"), t("_urgency", "Urgência"), why()] },
    ],
  },
  {
    id: "sessoes", title: "Sessões e manutenção", summary: "Atendimento presencial/remoto registrado só pela atuação responsável; triagem e verificação da conclusão por pessoa diferente de quem concluiu. Sessão nunca conclui o chamado.",
    reads: [
      { label: "Revisões (triagem/verificação)", table: "tech_ticket_reviews", columns: ["request_id", "seq", "kind", "conclusion_seq", "created_at"], order: "created_at" },
    ],
    actions: [
      { id: "sessao", label: "Registrar sessão de atendimento", rpc: "record_tech_service_session", keyArg: "_key", fields: [
        u("_request", "Chamado"), seq(), t("_mode", "Modalidade", "presencial ou remoto"), u("_space", "Ambiente", true),
        { arg: "_started", label: "Início", kind: "datetime" }, { arg: "_ended", label: "Fim", kind: "datetime" }, t("_result", "Resultado"), t("_summary", "Resumo técnico (sem dado pessoal)"),
        doc("_evidence", "Evidência (juntada)"), u("_rectifies", "Retifica a sessão", true), opt(why()),
      ] },
      { id: "revisao", label: "Registrar triagem/verificação", rpc: "record_tech_ticket_review", keyArg: "_key", fields: [u("_request", "Chamado"), seq(), t("_kind", "Tipo", "triagem, verificacao-aceita ou verificacao-recusada"), t("_note", "Observação")] },
      { id: "recorrencia", label: "Propor regra de recorrência", rpc: "record_tech_recurrence_rule", keyArg: "_key", fields: [n("_window", "Janela (dias)"), n("_min", "Mínimo de incidentes"), t("_source", "Fonte"), why()] },
      { id: "aprovar-recorrencia", label: "Aprovar regra de recorrência", rpc: "approve_tech_recurrence_rule", fields: [u("_version", "Versão"), t("_decision", "Decisão")] },
    ],
  },
  {
    id: "mudancas", title: "Problemas e mudanças", summary: "Problema (PRB) e mudança (MUD) com eventos append-only; aprovação por pessoa diferente do proponente e com ato em risco alto. Documentos da mudança são juntadas reais.",
    reads: [
      { label: "Problemas", table: "tech_problems", columns: ["id", "problem_code", "school_id", "title", "created_at"], order: "created_at" },
      { label: "Eventos de problema", table: "tech_problem_events", columns: ["problem_id", "seq", "action", "request_id", "created_at"], order: "created_at" },
      { label: "Mudanças", table: "tech_changes", columns: ["id", "change_code", "school_id", "problem_id", "title", "risk", "created_at"], order: "created_at" },
      { label: "Eventos de mudança", table: "tech_change_events", columns: ["change_id", "seq", "action", "created_at"], order: "created_at" },
    ],
    actions: [
      { id: "problema", label: "Abrir problema", rpc: "tech_open_problem", keyArg: "_key", fields: [t("_school", "Escola"), t("_title", "Título")] },
      { id: "evento-problema", label: "Registrar evento de problema", rpc: "record_tech_problem_event", keyArg: "_key", fields: [u("_problem", "Problema"), seq(), t("_action", "Ação"), u("_request", "Chamado vinculado", true), opt(t("_note", "Observação"))] },
      { id: "mudanca", label: "Propor mudança", rpc: "tech_propose_change", keyArg: "_key", fields: [t("_school", "Escola"), u("_problem", "Problema", true), t("_title", "Título"), t("_risk", "Risco"), t("_rollback", "Plano de reversão")] },
      { id: "evento-mudanca", label: "Tramitar mudança", rpc: "record_tech_change_event", keyArg: "_key", fields: [u("_change", "Mudança"), seq(), t("_action", "Ação"), u("_act", "Ato (risco alto)", true), opt(t("_note", "Observação"))] },
      { id: "doc-mudanca", label: "Juntar documento à mudança", rpc: "attach_tech_change_document", keyArg: "_key", fields: [u("_change", "Mudança"), t("_kind", "Tipo", "plano, teste, execucao, reversao ou revisao-pos"), doc("_case_event", "Juntada", false), opt(t("_note", "Observação"))] },
    ],
  },
  {
    id: "inventario", title: "Inventário e empréstimos", summary: "Equipamento é bem patrimonial de categoria marcada como tecnologia (marca aprovada por outra pessoa); ficha técnica versionada sem campos contábeis; empréstimo com termo juntado.",
    reads: [
      { label: "Marcas de categoria", table: "tech_equipment_category_marks", columns: ["id", "seq", "category_key", "action", "created_at"], order: "created_at" },
      { label: "Fichas técnicas", table: "tech_equipment_sheets", columns: ["asset_id", "version", "equipment_type", "manufacturer", "model", "created_at"], order: "created_at" },
      { label: "Empréstimos", table: "tech_equipment_loans", columns: ["id", "asset_id", "school_id", "lent_on", "due_on", "created_at"], order: "created_at" },
      { label: "Devoluções", table: "tech_equipment_loan_returns", columns: ["loan_id", "returned_on", "created_at"], order: "created_at" },
    ],
    actions: [
      { id: "marcar", label: "Marcar categoria como tecnologia", rpc: "mark_tech_equipment_category", keyArg: "_key", fields: [t("_category", "Categoria patrimonial"), t("_action", "Ação", "marcar ou desmarcar"), why()] },
      { id: "aprovar-marca", label: "Aprovar marca (outra pessoa)", rpc: "approve_tech_equipment_category_mark", fields: [u("_mark", "Marca"), t("_decision", "Decisão")] },
      { id: "ficha", label: "Registrar ficha técnica", rpc: "record_tech_equipment_sheet", keyArg: "_key", fields: [u("_asset", "Bem"), ver("_expected_version"), t("_type", "Tipo"), t("_manufacturer", "Fabricante"), t("_model", "Modelo"), opt(t("_serial", "Número de série")), { arg: "_specs", label: "Especificações (JSON)", kind: "json" }, why()] },
      { id: "emprestar", label: "Emprestar equipamento", rpc: "lend_tech_equipment", keyArg: "_key", fields: [u("_asset", "Bem"), u("_engagement", "Atuação de quem recebe"), t("_purpose", "Finalidade"), { arg: "_due", label: "Devolução prevista", kind: "date" }, doc("_term", "Termo (juntada)", false)] },
      { id: "devolver", label: "Registrar devolução", rpc: "return_tech_equipment", fields: [u("_loan", "Empréstimo"), t("_condition", "Condição na devolução")] },
      { id: "laboratorio", label: "Designar laboratório", rpc: "record_tech_lab_designation", keyArg: "_key", fields: [u("_space", "Ambiente"), t("_action", "Ação"), t("_purpose", "Finalidade")] },
      { id: "aprovar-lab", label: "Aprovar designação", rpc: "approve_tech_lab_designation", fields: [u("_d", "Designação")] },
    ],
  },
  {
    id: "conectividade", title: "Conectividade", summary: "Link por escola com velocidade contratada só se houver contrato juntado; medição com método; só medição confirmada por outra pessoa entra no painel.",
    reads: [
      { label: "Links", table: "tech_connectivity_links", columns: ["id", "school_id", "provider_name", "contracted_down_mbps", "contracted_up_mbps", "valid_from", "valid_until", "created_at"], order: "created_at" },
      { label: "Medições", table: "tech_connectivity_measurements", columns: ["id", "link_id", "measured_at", "method", "down_mbps", "up_mbps", "latency_ms", "available", "created_at"], order: "created_at" },
      { label: "Verificações", table: "tech_connectivity_verifications", columns: ["measurement_id", "verdict", "created_at"], order: "created_at" },
    ],
    actions: [
      { id: "link", label: "Registrar link", rpc: "register_tech_connectivity_link", keyArg: "_key", fields: [t("_school", "Escola"), t("_provider", "Provedor"), { arg: "_down", label: "Download contratado (Mbps)", kind: "number", optional: true }, { arg: "_up", label: "Upload contratado (Mbps)", kind: "number", optional: true }, doc("_contract", "Contrato (juntada)"), { arg: "_from", label: "Vigente desde", kind: "date" }, { arg: "_until", label: "Vigente até", kind: "date", optional: true }] },
      { id: "medir", label: "Registrar medição", rpc: "record_tech_connectivity_measurement", keyArg: "_key", fields: [u("_link", "Link"), { arg: "_at", label: "Medido em", kind: "datetime" }, t("_method", "Método"), { arg: "_down", label: "Download (Mbps)", kind: "number", optional: true }, { arg: "_up", label: "Upload (Mbps)", kind: "number", optional: true }, { arg: "_lat", label: "Latência (ms)", kind: "number", optional: true }, { arg: "_avail", label: "Disponível?", kind: "bool" }, doc("_evidence", "Evidência (juntada)")] },
      { id: "verificar", label: "Verificar medição (outra pessoa)", rpc: "verify_tech_connectivity_measurement", fields: [u("_m", "Medição"), t("_verdict", "Parecer", "confirmada ou recusada"), why()] },
    ],
  },
  {
    id: "servicos", title: "Serviços digitais", summary: "Catálogo de sistemas e serviços: versão aprovada por pessoa diferente do autor; operador externo exige contrato juntado; classes de dado declaradas sinalizam atenção LGPD.",
    reads: [
      { label: "Versões do catálogo", table: "tech_digital_service_versions", columns: ["id", "service_key", "version", "name", "kind", "operator", "status", "data_classes", "created_at"], order: "created_at" },
      { label: "Aprovações", table: "tech_digital_service_approvals", columns: ["version_id", "created_at"], order: "created_at" },
      { label: "Acessibilidade declarada", table: "tech_service_accessibility", columns: ["id", "service_version_id", "features", "created_at"], order: "created_at" },
    ],
    actions: [
      { id: "servico", label: "Registrar versão do serviço", rpc: "record_tech_digital_service", keyArg: "_idem", fields: [
        t("_key", "Chave do serviço"), ver(), t("_name", "Nome"), t("_kind", "Tipo"), { arg: "_aud", label: "Público (separado por vírgula)", kind: "list" }, t("_op", "Operador", "municipal, terceiro ou rede"),
        t("_status", "Situação"), { arg: "_data", label: "Classes de dado (separadas por vírgula)", kind: "list", optional: true }, t("_purpose", "Finalidade"), opt(t("_url", "Endereço de acesso")), doc("_contract", "Contrato (juntada)"),
      ] },
      { id: "aprovar", label: "Aprovar versão (outra pessoa)", rpc: "approve_tech_digital_service", fields: [u("_version", "Versão"), t("_decision", "Decisão")] },
      { id: "acessibilidade", label: "Declarar acessibilidade", rpc: "declare_tech_service_accessibility", keyArg: "_key", fields: [t("_service", "Serviço"), { arg: "_features", label: "Recursos (separados por vírgula)", kind: "list" }, t("_standard", "Norma de referência")] },
      { id: "conferir-acess", label: "Conferir acessibilidade", rpc: "check_tech_service_accessibility", fields: [u("_decl", "Declaração"), { arg: "_confirmed", label: "Recursos confirmados (vírgula)", kind: "list" }, opt(t("_note", "Observação"))] },
    ],
  },
  {
    id: "acessos", title: "Acessos", summary: "Pedido de acesso a serviço vigente do catálogo para atuação vigente; análise, aprovação e revogação por pessoas diferentes do solicitante e do beneficiário. Nunca concede permissão do SIGEM.",
    reads: [
      { label: "Pedidos de acesso", table: "tech_access_requests", columns: ["id", "service_key", "school_id", "access_profile", "created_at"], order: "created_at" },
      { label: "Eventos", table: "tech_access_request_events", columns: ["request_id", "seq", "kind", "created_at"], order: "created_at" },
    ],
    actions: [
      { id: "pedir", label: "Pedir acesso", rpc: "open_tech_access_request", keyArg: "_key", fields: [t("_service", "Serviço"), u("_engagement", "Atuação beneficiária"), t("_profile", "Perfil de acesso"), t("_just", "Justificativa")] },
      { id: "evento", label: "Analisar/aprovar/revogar", rpc: "record_tech_access_event", keyArg: "_key", fields: [u("_req", "Pedido"), seq("_expected"), t("_kind", "Evento", "analise, aprovacao, indeferimento, revisao ou revogacao"), t("_note", "Fundamento")] },
    ],
  },
  {
    id: "incidentes", title: "Incidentes de segurança", summary: "Registro restrito (SEG): só quem trata incidentes da rede lê; triagem declara gravidade e dado pessoal; encerrar exige contenção e, com dado pessoal, decisão de comunicação com documento juntado.",
    reads: [
      { label: "Incidentes", table: "tech_security_incidents", columns: ["id", "code", "category", "school_id", "personal_data", "created_at"], order: "created_at" },
      { label: "Fases", table: "tech_security_incident_events", columns: ["incident_id", "seq", "kind", "severity", "personal_data", "communicate", "created_at"], order: "created_at" },
    ],
    actions: [
      { id: "relatar", label: "Relatar incidente", rpc: "report_tech_security_incident", keyArg: "_key", fields: [t("_category", "Categoria"), opt(t("_school", "Escola")), t("_summary", "Resumo (sem dado pessoal)")] },
      { id: "fase", label: "Registrar fase", rpc: "record_tech_security_event", keyArg: "_key", fields: [u("_inc", "Incidente"), seq("_expected"), t("_kind", "Fase", "triagem, contencao, comunicacao ou encerramento"), opt(t("_severity", "Gravidade")), { arg: "_pd", label: "Envolve dado pessoal?", kind: "bool", optional: true }, { arg: "_communicate", label: "Comunicar titulares/ANPD?", kind: "bool", optional: true }, doc("_doc", "Decisão (juntada)"), t("_note", "Registro")] },
    ],
  },
  {
    id: "backup", title: "Backup", summary: "Plano por serviço aprovado por outra pessoa; execução e teste de restauração com evidência; teste por pessoa diferente de quem executou. Só restauração com checksum igual comprova backup.",
    reads: [
      { label: "Planos", table: "tech_backup_plan_versions", columns: ["id", "service_key", "version", "every_hours", "restore_test_every_days", "retention_days", "approved_at", "created_at"], order: "created_at" },
      { label: "Execuções", table: "tech_backup_runs", columns: ["id", "plan_version_id", "started_at", "ended_at", "outcome", "created_at"], order: "created_at" },
      { label: "Testes de restauração", table: "tech_restore_tests", columns: ["id", "run_id", "tested_at", "outcome", "created_at"], order: "created_at" },
    ],
    actions: [
      { id: "plano", label: "Propor plano de backup", rpc: "record_tech_backup_plan", keyArg: "_key", fields: [t("_service", "Serviço"), ver(), t("_scope", "Escopo"), n("_every", "Periodicidade (horas)"), n("_test_days", "Teste de restauração a cada (dias)"), n("_ret", "Retenção (dias)"), t("_src_kind", "Tipo de fonte"), t("_src", "Fonte")] },
      { id: "aprovar", label: "Aprovar plano (outra pessoa)", rpc: "approve_tech_backup_plan", fields: [u("_plan", "Plano")] },
      { id: "execucao", label: "Registrar execução", rpc: "record_tech_backup_run", keyArg: "_key", fields: [u("_plan", "Plano"), { arg: "_start", label: "Início", kind: "datetime" }, { arg: "_end", label: "Fim", kind: "datetime" }, t("_outcome", "Resultado"), opt(t("_checksum", "Checksum")), doc("_evidence", "Evidência (juntada)")] },
      { id: "restauracao", label: "Registrar teste de restauração", rpc: "record_tech_restore_test", keyArg: "_key", fields: [u("_run", "Execução"), { arg: "_at", label: "Testado em", kind: "datetime" }, opt(t("_checksum", "Checksum restaurado")), t("_outcome", "Resultado"), opt(t("_note", "Observação")), doc("_evidence", "Evidência (juntada)")] },
    ],
  },
  {
    id: "conhecimento", title: "Conhecimento", summary: "Artigos são documentos da Base de Conhecimento; vínculos a categoria/serviço validados por outra pessoa. Retorno de autosserviço é lido só agregado.",
    reads: [
      { label: "Vínculos de artigo", table: "tech_kb_links", columns: ["id", "kb_document_id", "target_kind", "target_key", "action", "created_at"], order: "created_at" },
      { label: "Validações", table: "tech_kb_link_validations", columns: ["link_id", "created_at"], order: "created_at" },
    ],
    actions: [
      { id: "vincular", label: "Vincular artigo", rpc: "record_tech_kb_link", keyArg: "_key", fields: [t("_doc", "Documento da base"), t("_kind", "Alvo", "categoria ou servico"), t("_target", "Chave do alvo"), t("_action", "Ação", "vincular ou desvincular")] },
      { id: "validar", label: "Validar vínculo (outra pessoa)", rpc: "validate_tech_kb_link", fields: [u("_link", "Vínculo")] },
      { id: "retorno", label: "Registrar retorno de autosserviço", rpc: "record_tech_selfservice_feedback", keyArg: "_key", fields: [t("_doc", "Documento da base"), t("_outcome", "Resultado", "resolveu ou nao-resolveu"), u("_request", "Chamado aberto depois", true)] },
    ],
  },
  {
    id: "pedagogico", title: "Recursos pedagógicos e inovação", summary: "Recurso pedagógico = serviço do catálogo com público estudantes/professores, avaliado pela rubrica aprovada; projeto de inovação com plano de evidência e eventos.",
    reads: [
      { label: "Rubricas", table: "tech_pedagogical_rubric_versions", columns: ["id", "version", "scale_max", "created_at"], order: "created_at" },
      { label: "Avaliações", table: "tech_pedagogical_evaluations", columns: ["id", "service_version_id", "rubric_version_id", "verdict", "created_at"], order: "created_at" },
      { label: "Projetos de inovação", table: "tech_innovation_projects", columns: ["id", "school_id", "title", "service_keys", "created_at"], order: "created_at" },
      { label: "Eventos de projeto", table: "tech_innovation_events", columns: ["project_id", "seq", "kind", "created_at"], order: "created_at" },
    ],
    actions: [
      { id: "rubrica", label: "Propor rubrica", rpc: "record_tech_pedagogical_rubric", keyArg: "_key", fields: [ver(), { arg: "_criteria", label: "Critérios (JSON)", kind: "json" }, n("_scale", "Nota máxima"), t("_source", "Fonte")] },
      { id: "aprovar-rubrica", label: "Aprovar rubrica (outra pessoa)", rpc: "approve_tech_pedagogical_rubric", fields: [u("_rubric", "Rubrica")] },
      { id: "avaliar", label: "Avaliar recurso", rpc: "record_tech_pedagogical_evaluation", keyArg: "_key", fields: [t("_service", "Serviço"), { arg: "_scores", label: "Notas por critério (JSON)", kind: "json" }, t("_verdict", "Parecer"), { arg: "_items", label: "Itens curriculares (identificadores, vírgula)", kind: "uuid-list", optional: true }, t("_rationale", "Fundamentação")] },
      { id: "projeto", label: "Propor projeto de inovação", rpc: "propose_tech_innovation_project", keyArg: "_key", fields: [t("_school", "Escola"), t("_title", "Título"), t("_objective", "Objetivo"), t("_plan", "Plano de evidência"), { arg: "_services", label: "Serviços (vírgula)", kind: "list", optional: true }] },
      { id: "evento-projeto", label: "Registrar evento do projeto", rpc: "record_tech_innovation_event", keyArg: "_key", fields: [u("_proj", "Projeto"), seq("_expected"), t("_kind", "Evento"), t("_note", "Registro"), opt(t("_source", "Fonte da evidência")), doc("_doc", "Documento (juntada)")] },
    ],
  },
  {
    id: "licencas", title: "Contratos e licenças", summary: "Licença por serviço com vigência e contrato juntado, em versões; plano anual de tecnologia aprovado por pessoa diferente do autor.",
    reads: [
      { label: "Licenças", table: "tech_license_versions", columns: ["id", "service_key", "version", "license_kind", "seats", "valid_from", "valid_until", "created_at"], order: "created_at" },
      { label: "Planos anuais", table: "tech_annual_plan_versions", columns: ["id", "year", "version", "created_at"], order: "created_at" },
      { label: "Aprovações de plano", table: "tech_annual_plan_approvals", columns: ["plan_version_id", "created_at"], order: "created_at" },
    ],
    actions: [
      { id: "licenca", label: "Registrar licença", rpc: "record_tech_license", keyArg: "_key", fields: [t("_service", "Serviço"), ver(), t("_kind", "Tipo de licença"), { arg: "_seats", label: "Quantidade de licenças", kind: "int", optional: true }, { arg: "_from", label: "Vigente desde", kind: "date" }, { arg: "_until", label: "Vigente até", kind: "date", optional: true }, doc("_contract", "Contrato (juntada)")] },
      { id: "plano", label: "Propor plano anual", rpc: "record_tech_annual_plan", keyArg: "_key", fields: [n("_year", "Ano"), ver(), { arg: "_actions", label: "Ações (JSON)", kind: "json" }, why()] },
      { id: "aprovar-plano", label: "Aprovar plano (outra pessoa)", rpc: "approve_tech_annual_plan", fields: [u("_plan", "Plano"), t("_decision", "Decisão")] },
    ],
  },
];
