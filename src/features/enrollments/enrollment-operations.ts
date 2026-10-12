/**
 * Lote corretivo 06 — Central operacional de Matrículas.
 * Especificação declarativa: cada etapa lê só tabelas/leitores sob RLS de quem consulta (colunas sem dado
 * pessoal) e grava só pelos writers SECURITY DEFINER já existentes (0455–0476). Nenhum INSERT/UPDATE direto,
 * nenhuma tabela nova: o banco revalida capacidade, escopo, sequência e autor em toda ação.
 */

export type FieldKind = "text" | "uuid" | "int" | "number" | "bool" | "datetime" | "date" | "select" | "list" | "json" | "uuid-list";
export interface ActionField {
  arg: string;
  label: string;
  kind: FieldKind;
  options?: readonly string[];
  optional?: boolean;
  hint?: string;
}
export interface OperationAction {
  id: string;
  label: string;
  rpc: string;
  fields: readonly ActionField[];
  /** Argumento de idempotência gerado pela tela (estável até a gravação aceita). */
  keyArg?: string;
  /** Argumentos fixos declarados pela especificação (não editáveis na tela). */
  fixed?: Readonly<Record<string, string | number | boolean>>;
}
export interface OperationRead {
  label: string;
  table: string;
  columns: readonly string[];
  order: string;
  /** Filtro de igualdade declarado (a RLS continua decidindo o que volta). */
  eq?: Readonly<Record<string, string>>;
}
export interface OperationStage {
  id: string;
  title: string;
  summary: string;
  reads: readonly OperationRead[];
  actions: readonly OperationAction[];
}

const reason = (label = "Justificativa"): ActionField => ({ arg: "_reason", label, kind: "text" });
const seq = (arg = "_expected_seq"): ActionField => ({ arg, label: "Sequência esperada (último registro lido)", kind: "int", hint: "0 quando ainda não há registro" });
const ver = (arg = "_expected_version"): ActionField => ({ arg, label: "Versão esperada (última lida)", kind: "int", hint: "0 quando ainda não há versão" });
const actRef = (arg = "_act"): ActionField => ({ arg, label: "Ato (versão assinada no SIGEM Documentos)", kind: "uuid" });

export const OPERATION_STAGES: readonly OperationStage[] = [
  {
    id: "campanhas", title: "Campanhas e regras", summary: "Criar campanha, versionar período/escopo e tramitar até a publicação. Preferências e critérios só valem após aprovação por outra pessoa.",
    reads: [
      { label: "Campanhas", table: "enr_campaigns", columns: ["id", "cycle_year", "cycle_term", "kind", "created_at"], order: "created_at" },
      { label: "Eventos de campanha", table: "enr_campaign_events", columns: ["campaign_id", "seq", "action", "to_state", "on_version", "created_at"], order: "created_at" },
      { label: "Políticas de preferência", table: "enr_preference_policies", columns: ["id", "campaign_id", "version", "min_choices", "max_choices", "ordering", "created_at"], order: "created_at" },
    ],
    actions: [
      { id: "criar", label: "Criar campanha", rpc: "create_enr_campaign", keyArg: "_key", fields: [
        { arg: "_year", label: "Ano do ciclo", kind: "int" },
        { arg: "_term", label: "Período", kind: "select", options: ["anual", "1-semestre", "2-semestre"] },
        { arg: "_kind", label: "Tipo (catálogo)", kind: "text" },
      ] },
      { id: "evento", label: "Tramitar campanha", rpc: "record_enr_campaign_event", keyArg: "_key", fields: [
        { arg: "_c", label: "Campanha", kind: "uuid" }, seq(),
        { arg: "_action", label: "Ação", kind: "select", options: ["enviar-revisao", "devolver", "autorizar", "publicar", "suspender", "retomar", "encerrar", "cancelar"] },
        reason(),
      ] },
      { id: "preferencia", label: "Registrar política de preferência", rpc: "record_enr_preference_policy", keyArg: "_key", fields: [
        { arg: "_campaign", label: "Campanha", kind: "uuid" }, ver(),
        { arg: "_min", label: "Mínimo de escolhas", kind: "int" }, { arg: "_max", label: "Máximo de escolhas", kind: "int" },
        { arg: "_ordering", label: "Ordenação", kind: "text" },
        { arg: "_shifts", label: "Turnos (separados por vírgula)", kind: "list" }, { arg: "_offers", label: "Ofertas (separadas por vírgula)", kind: "list" },
        { arg: "_justification", label: "Justificativa", kind: "text" },
      ] },
      { id: "aprovar-preferencia", label: "Aprovar política de preferência", rpc: "approve_enr_preference_policy", fields: [{ arg: "_policy", label: "Política", kind: "uuid" }, reason()] },
    ],
  },
  {
    id: "conferencia", title: "Conferência e anexos", summary: "Analisar inscrições, conferir documentos enviados e decidir sinais de duplicidade. Anexo só é conferido se o arquivo existir no armazenamento privado.",
    reads: [
      { label: "Documentos enviados", table: "enr_application_documents", columns: ["id", "application_id", "doc_type", "version", "mime_type", "size_bytes", "created_at"], order: "created_at" },
      { label: "Conferências de documento", table: "enr_document_reviews", columns: ["document_id", "seq", "outcome", "created_at"], order: "created_at" },
      { label: "Análises", table: "enr_application_analyses", columns: ["application_id", "seq", "kind", "subject", "created_at"], order: "created_at" },
    ],
    actions: [
      { id: "analise", label: "Registrar análise", rpc: "record_enr_application_analysis", keyArg: "_key", fields: [
        { arg: "_app", label: "Inscrição", kind: "uuid" }, seq(),
        { arg: "_kind", label: "Tipo", kind: "select", options: ["anotacao", "pendencia-aberta", "pendencia-resolvida", "criterio-conferido", "criterio-nao-comprovado"] },
        { arg: "_subject", label: "Assunto", kind: "text" }, { arg: "_note", label: "Nota", kind: "text" },
      ] },
      { id: "documento", label: "Conferir documento", rpc: "record_enr_document_review", keyArg: "_key", fields: [
        { arg: "_doc", label: "Documento", kind: "uuid" }, seq(),
        { arg: "_outcome", label: "Resultado", kind: "select", options: ["conferido", "complementacao-solicitada", "recusado", "vinculado-ged"] },
        reason(), { arg: "_ged_case", label: "Processo no GED (só para vincular)", kind: "uuid", optional: true },
      ] },
      { id: "sinal", label: "Decidir sinal", rpc: "record_enr_signal_resolution", keyArg: "_key", fields: [
        { arg: "_app", label: "Inscrição", kind: "uuid" },
        { arg: "_kind", label: "Sinal", kind: "select", options: ["inscricao-repetida", "ja-matriculado", "identificador-inconsistente", "responsaveis-multiplos"] },
        { arg: "_related", label: "Chave relacionada", kind: "text" }, seq(),
        { arg: "_decision", label: "Decisão", kind: "select", options: ["legitimo", "procede", "indeterminado"] }, reason(),
      ] },
    ],
  },
  {
    id: "protocolo", title: "Protocolo", summary: "Protocolar a inscrição no protocolo único do SIGEM Documentos (número PROT, comprovante com hash).",
    reads: [{ label: "Inscrições protocoladas", table: "enr_application_protocols", columns: ["application_id", "registration_id", "created_at"], order: "created_at" }],
    actions: [{ id: "protocolar", label: "Protocolar inscrição", rpc: "enr_protocol_application", fields: [{ arg: "_application", label: "Inscrição", kind: "uuid" }] }],
  },
  {
    id: "classificacao", title: "Classificação", summary: "Critérios versionados e aprovados por pessoa diferente do autor; execução em simulação ou oficial com hash de entrada e resultado.",
    reads: [
      { label: "Critérios", table: "enr_classification_criteria", columns: ["id", "campaign_id", "version", "campaign_version", "created_at"], order: "created_at" },
      { label: "Execuções", table: "enr_classification_runs", columns: ["id", "campaign_id", "criteria_id", "mode", "engine_version", "input_hash", "result_hash", "reprocess_matches", "created_at"], order: "created_at" },
    ],
    actions: [
      { id: "criterio", label: "Registrar critérios", rpc: "record_enr_classification_criteria", keyArg: "_key", fields: [
        { arg: "_campaign", label: "Campanha", kind: "uuid" }, ver(), { arg: "_campaign_version", label: "Versão da campanha", kind: "int" },
        { arg: "_rules", label: "Regras (JSON de primitivas)", kind: "json" }, { arg: "_tiebreaks", label: "Desempates (JSON)", kind: "json" },
        { arg: "_justification", label: "Justificativa", kind: "text" },
      ] },
      { id: "aprovar-criterio", label: "Aprovar critérios", rpc: "approve_enr_classification_criteria", fields: [{ arg: "_criteria", label: "Critérios", kind: "uuid" }, reason()] },
    ],
  },
  {
    id: "distribuicao", title: "Distribuição", summary: "Proposta gerada a partir de uma execução oficial; validar exige ato; publicar não cria matrícula.",
    reads: [
      { label: "Propostas", table: "enr_distribution_proposals", columns: ["id", "run_id", "campaign_id", "conflict_count", "created_at"], order: "created_at" },
      { label: "Eventos de proposta", table: "enr_distribution_events", columns: ["proposal_id", "seq", "action", "act_ref", "created_at"], order: "created_at" },
    ],
    actions: [
      { id: "propor", label: "Gerar proposta", rpc: "enr_propose_distribution", fields: [{ arg: "_run", label: "Execução de classificação", kind: "uuid" }] },
      { id: "evento", label: "Validar / devolver / publicar", rpc: "record_enr_distribution_event", keyArg: "_key", fields: [
        { arg: "_proposal", label: "Proposta", kind: "uuid" }, seq(),
        { arg: "_action", label: "Ação", kind: "select", options: ["validar", "devolver", "publicar"] },
        { ...actRef(), optional: true, hint: "obrigatório para validar" }, reason(),
      ] },
    ],
  },
  {
    id: "reservas", title: "Reservas de vaga", summary: "Reserva com teto relido no banco a cada gravação; confirmar ou liberar encerra a reserva uma única vez.",
    reads: [
      { label: "Quadros de vaga", table: "enr_seat_pools", columns: ["id", "campaign_id", "cell_key", "created_at"], order: "created_at" },
      { label: "Eventos de reserva", table: "enr_seat_events", columns: ["pool_id", "seq", "hold_id", "kind", "origin", "expires_at", "created_at"], order: "created_at" },
    ],
    actions: [
      { id: "reservar", label: "Reservar vaga", rpc: "enr_seat_reserve_v2", keyArg: "_key", fields: [
        { arg: "_pool", label: "Quadro", kind: "uuid" }, { arg: "_application", label: "Inscrição", kind: "uuid" },
        { arg: "_proposal", label: "Proposta (se da distribuição)", kind: "uuid", optional: true },
        { arg: "_origin", label: "Origem", kind: "select", options: ["distribuicao", "lista-de-espera", "transferencia"] },
      ] },
      { id: "encerrar", label: "Confirmar / liberar reserva", rpc: "enr_seat_close", keyArg: "_key", fields: [
        { arg: "_hold", label: "Reserva", kind: "uuid" }, { arg: "_kind", label: "Ação", kind: "select", options: ["confirmar", "liberar"] }, reason(),
      ] },
    ],
  },
  {
    id: "listas", title: "Listas de espera", summary: "Lista aberta só a partir de proposta; reclassificação é nova versão com ato; chamada relê a vaga.",
    reads: [{ label: "Listas", table: "enr_waitlists", columns: ["id", "campaign_id", "cell_key", "proposal_id", "created_at"], order: "created_at" }],
    actions: [
      { id: "abrir", label: "Abrir lista", rpc: "enr_open_waitlist", keyArg: "_key", fields: [{ arg: "_proposal", label: "Proposta", kind: "uuid" }, { arg: "_cell", label: "Célula (escola|etapa|modalidade)", kind: "text" }] },
      { id: "chamar", label: "Chamar próximo", rpc: "enr_call_from_waitlist", keyArg: "_key", fields: [{ arg: "_w", label: "Lista", kind: "uuid" }, ver()] },
      { id: "reclassificar", label: "Reclassificar", rpc: "enr_reclassify_waitlist", keyArg: "_key", fields: [
        { arg: "_w", label: "Lista", kind: "uuid" }, ver(), { arg: "_entries", label: "Inscrições na nova ordem (separadas por vírgula)", kind: "uuid-list" }, actRef(), reason(),
      ] },
    ],
  },
  {
    id: "confirmacao", title: "Confirmação", summary: "Validação administrativa da reserva aceita e vínculo com a matrícula formalizada pelo writer da Secretaria — nunca matrícula paralela.",
    reads: [
      { label: "Validações", table: "enr_admin_validations", columns: ["hold_id", "outcome", "receipt_hash", "created_at"], order: "created_at" },
      { label: "Vínculos com matrícula", table: "enr_formalization_links", columns: ["hold_id", "enrollment_id", "created_at"], order: "created_at" },
    ],
    actions: [
      { id: "validar", label: "Validar / devolver", rpc: "record_enr_admin_validation", keyArg: "_key", fields: [
        { arg: "_hold", label: "Reserva", kind: "uuid" }, { arg: "_outcome", label: "Resultado", kind: "select", options: ["validado", "devolvido"] }, reason(),
      ] },
      { id: "vincular", label: "Vincular matrícula formalizada", rpc: "enr_link_formalized_enrollment", fields: [{ arg: "_hold", label: "Reserva", kind: "uuid" }, { arg: "_enrollment", label: "Matrícula (registro da Secretaria)", kind: "text" }] },
    ],
  },
  {
    id: "recursos", title: "Recursos", summary: "Recurso, revisão ou exceção: registrar e analisar exigem competência; deferir/indeferir exige ato e encerra.",
    reads: [{ label: "Eventos de recurso", table: "enr_appeal_events", columns: ["appeal_id", "seq", "application_id", "kind", "action", "act_ref", "created_at"], order: "created_at" }],
    actions: [{ id: "evento", label: "Registrar evento de recurso", rpc: "record_enr_appeal_event", keyArg: "_key", fields: [
      { arg: "_appeal", label: "Recurso (vazio para registrar novo)", kind: "uuid", optional: true }, seq(),
      { arg: "_application", label: "Inscrição", kind: "uuid" },
      { arg: "_kind", label: "Tipo", kind: "select", options: ["recurso", "revisao", "excecao"] },
      { arg: "_action", label: "Ação", kind: "select", options: ["registrar", "analisar", "deferir", "indeferir"] },
      { ...actRef(), optional: true, hint: "obrigatório para decidir" }, reason(),
    ] }],
  },
  {
    id: "enturmacao", title: "Enturmação", summary: "Enturma a reserva validada pelo writer canônico; a turma e a vigência são conferidas no banco.",
    reads: [{ label: "Enturmações", table: "enr_allocation_links", columns: ["hold_id", "episode_id", "class_id", "valid_from", "created_at"], order: "created_at" }],
    actions: [{ id: "enturmar", label: "Enturmar", rpc: "enr_allocate_formalized", keyArg: "_key", fields: [
      { arg: "_hold", label: "Reserva", kind: "uuid" }, { arg: "_class", label: "Turma", kind: "text" }, { arg: "_valid_from", label: "Início", kind: "date" }, reason(),
    ] }],
  },
  {
    id: "transferencias", title: "Transferências", summary: "Analisar → autorizar (com ato) → efetivar; indeferir só após análise. A origem só é encerrada na efetivação.",
    reads: [{ label: "Eventos de transferência", table: "enr_transfer_events", columns: ["hold_id", "seq", "action", "act_ref", "created_at"], order: "created_at" }],
    actions: [{ id: "evento", label: "Registrar etapa", rpc: "record_enr_transfer_event", keyArg: "_key", fields: [
      { arg: "_hold", label: "Reserva de destino", kind: "uuid" }, seq(),
      { arg: "_action", label: "Ação", kind: "select", options: ["analisar", "indeferir", "autorizar", "efetivar"] },
      { arg: "_origin", label: "Matrícula de origem", kind: "text" },
      { ...actRef(), optional: true, hint: "obrigatório para autorizar" },
      { arg: "_movement_type", label: "Tipo de movimentação (catálogo)", kind: "text", optional: true },
      { arg: "_type_version", label: "Versão do tipo", kind: "int", optional: true },
      { arg: "_effective_on", label: "Data efetiva", kind: "date", optional: true }, reason(),
    ] }],
  },
];

/** Converte o formulário nos argumentos do writer; devolve problemas por extenso em vez de enviar dado inválido. */
export function buildArgs(action: OperationAction, values: Record<string, string>, key: string): { args: Record<string, unknown>; problems: string[] } {
  const args: Record<string, unknown> = {};
  const problems: string[] = [];
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const f of action.fields) {
    const raw = (values[f.arg] ?? "").trim();
    if (!raw) {
      if (f.optional) { args[f.arg] = null; continue; }
      problems.push(`Preencha: ${f.label}.`);
      continue;
    }
    switch (f.kind) {
      case "int": {
        if (!/^\d+$/.test(raw)) problems.push(`${f.label}: use um número inteiro.`);
        else args[f.arg] = Number(raw);
        break;
      }
      case "number": if (!/^\d+([.,]\d+)?$/.test(raw)) problems.push(`${f.label}: use um número.`); else args[f.arg] = Number(raw.replace(",", ".")); break;
      case "bool": if (raw !== "sim" && raw !== "não") problems.push(`${f.label}: escolha sim ou não.`); else args[f.arg] = raw === "sim"; break;
      case "datetime": if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) problems.push(`${f.label}: data e hora inválidas.`); else args[f.arg] = new Date(raw).toISOString(); break;
      case "uuid": if (!UUID.test(raw)) problems.push(`${f.label}: identificador inválido.`); else args[f.arg] = raw; break;
      case "date": if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) problems.push(`${f.label}: data inválida.`); else args[f.arg] = raw; break;
      case "select": if (!f.options?.includes(raw)) problems.push(`${f.label}: opção inválida.`); else args[f.arg] = raw; break;
      case "list": args[f.arg] = raw.split(",").map((s) => s.trim()).filter(Boolean); break;
      case "uuid-list": {
        const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
        if (ids.some((i) => !UUID.test(i))) problems.push(`${f.label}: há identificador inválido.`); else args[f.arg] = ids;
        break;
      }
      case "json": try { args[f.arg] = JSON.parse(raw); } catch { problems.push(`${f.label}: JSON inválido.`); } break;
      default: args[f.arg] = raw;
    }
  }
  if (action.keyArg) args[action.keyArg] = key;
  return { args, problems };
}
