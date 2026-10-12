// LOTE CORRETIVO 17 — gera etapas do console operacional a partir das assinaturas reais dos writers
// (src/integrations/supabase/types.ts). Não cria writer nem regra: só expõe na tela o que o banco já valida.
// Uso: node scripts/rpc-console-stages.mjs
import { readFileSync, writeFileSync } from "node:fs";

const types = readFileSync("src/integrations/supabase/types.ts", "utf8");
const fnStart = types.indexOf("    Functions: {");

function args(rpc) {
  const i = types.indexOf(`      ${rpc}: {`, fnStart);
  if (i < 0) throw new Error(`writer ausente: ${rpc}`);
  const a = types.indexOf("Args:", i), open = types.indexOf("{", a);
  if (types.slice(a, open).includes("never")) return [];
  let depth = 0, j = open;
  for (; j < types.length; j++) { if (types[j] === "{") depth++; else if (types[j] === "}" && --depth === 0) break; }
  return types.slice(open + 1, j).split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = /^(\w+)(\??):\s*(.+)$/.exec(l); if (!m) return null;
    const t = m[3].replace(/\s*\|\s*null/, "");
    const kind = t === "number" ? "int" : t === "boolean" ? "bool" : t === "Json" ? "json" : t.endsWith("[]") ? "list" : "text";
    return { arg: m[1], optional: m[2] === "?", kind };
  }).filter(Boolean);
}
const human = (a) => { const s = a.replace(/^_/, "").replace(/_/g, " "); return s[0].toUpperCase() + s.slice(1); };
const KEY = new Set(["_key", "_idem", "_idempotency_key"]);

function stages(spec) {
  return spec.map(([id, title, summary, rpcs]) => ({ id, title, summary, reads: [], actions: rpcs.map(([rpc, label]) => {
    const fs = args(rpc), key = fs.find((f) => KEY.has(f.arg));
    return { id: rpc, label, rpc, ...(key ? { keyArg: key.arg } : {}),
      fields: fs.filter((f) => f !== key).map((f) => ({ arg: f.arg, label: human(f.arg), kind: f.kind, ...(f.optional ? { optional: true } : {}) })) };
  }) }));
}

const PERMANENCE = [
  ["regras", "Regras e catálogos", "Regra preventiva, tipo de barreira e prioridade: versões validadas e aprovadas no banco por pessoa diferente do autor.", [
    ["register_permanence_rule_version", "Registrar versão de regra"], ["register_permanence_barrier_type", "Registrar tipo de barreira"], ["register_permanence_priority", "Registrar prioridade"]]],
  ["alertas", "Alertas", "Alerta só de regra aprovada vigente; conferir antes de agir e encerrar com justificativa.", [
    ["register_permanence_alert", "Registrar alerta"], ["record_permanence_alert_event", "Registrar evento do alerta"]]],
  ["contatos", "Contatos e visitas", "Destinatário é sempre o responsável autorizado vigente; visita só com segurança conferida. Não registre endereço, CPF, telefone ou laudo.", [
    ["record_permanence_contact_attempt", "Registrar tentativa de contato"], ["record_permanence_visit", "Registrar visita/atendimento"]]],
  ["plano", "Plano, encaminhamento e retorno", "Plano individual em versões; encaminhamento só pela allowlist do destino aprovado; retorno referencia a enturmação oficial.", [
    ["record_permanence_plan_version", "Registrar versão do plano"], ["record_permanence_plan_review", "Registrar reavaliação"],
    ["record_permanence_referral_event", "Registrar evento de encaminhamento"], ["record_permanence_return", "Registrar retorno escolar"]]],
];
const OPERATIONS = [
  ["solicitacoes", "Solicitações", "Solicitação dos setores com eventos append-only; responsável = atuação vigente.", [
    ["open_ops_request", "Abrir solicitação"], ["record_ops_request_event", "Registrar evento"]]],
  ["infraestrutura", "Infraestrutura", "Espaços em versões, vistorias, disponibilidade e restrições de uso; evidência só juntada no SIGEM Documentos.", [
    ["record_ops_space_version", "Registrar versão do espaço"], ["record_ops_inspection", "Registrar vistoria"],
    ["record_ops_space_availability", "Registrar disponibilidade"], ["record_ops_space_use_restriction", "Impor/levantar restrição de uso"]]],
  ["manutencao", "Manutenção, serviços e obras", "Etapas impostas no banco; conferência por pessoa diferente de quem executou.", [
    ["open_ops_maintenance_order", "Abrir ordem de manutenção"], ["record_ops_maintenance_event", "Registrar etapa da manutenção"],
    ["record_ops_service_event", "Registrar evento da ordem de serviço"], ["open_ops_work", "Abrir obra"], ["record_ops_work_event", "Registrar evento da obra"]]],
  ["patrimonio", "Patrimônio", "Bem com cadeia única; transferência, inventário e baixa só pelos processos próprios.", [
    ["record_ops_asset_event", "Registrar evento do bem"], ["record_ops_asset_transfer_event", "Registrar evento de transferência"],
    ["open_ops_asset_inventory", "Abrir inventário"], ["record_ops_asset_inventory_event", "Registrar evento do inventário"], ["record_ops_asset_disposal_event", "Registrar evento da baixa"]]],
  ["almoxarifado", "Almoxarifado", "Movimentos e requisições de material de consumo, separados do bem permanente.", [
    ["record_ops_supply_movement", "Registrar movimento"], ["open_ops_supply_requisition", "Abrir requisição"], ["record_ops_supply_requisition_event", "Registrar evento da requisição"]]],
  ["transporte", "Transporte", "Rotas em versões, veículos, equipe, viagens, ocorrências e custos só com comprovante.", [
    ["record_ops_route_version", "Registrar versão da rota"], ["record_ops_vehicle_event", "Registrar evento do veículo"], ["record_ops_crew_credential", "Registrar credencial da equipe"],
    ["record_ops_trip_execution", "Registrar viagem"], ["record_ops_trip_measure", "Registrar medida da viagem"], ["record_ops_trip_occurrence", "Registrar ocorrência"],
    ["record_ops_transport_measurement", "Registrar medição"], ["record_ops_transport_cost", "Registrar custo"]]],
];

const DEVELOPMENT = [
  ["catalogo", "Catálogo e trilhas", "Curso com código imutável e versões; trilha e versões só valem aprovadas por pessoa diferente do autor.", [
    ["record_dev_catalog_course_version", "Registrar versão de curso do catálogo"], ["decide_dev_version", "Decidir versão (aprovar/devolver)"],
    ["record_dev_track_version", "Registrar versão de trilha"], ["decide_dev_track_version", "Decidir versão de trilha"]]],
  ["inscricoes", "Inscrições", "Pedido não ocupa vaga; análise por outra pessoa; colocação só sob trava da turma, pelo critério de espera aprovado.", [
    ["request_dev_enrollment", "Pedir inscrição"], ["review_dev_enrollment", "Analisar inscrição"], ["place_dev_enrollment", "Colocar na turma ou na espera"],
    ["record_dev_waitlist_criteria", "Registrar critério de espera"], ["approve_dev_waitlist_criteria", "Aprovar critério de espera"], ["adopt_dev_class_waitlist_criteria", "Adotar critério na turma"],
    ["record_dev_participation", "Registrar desistência ou cancelamento"]]],
  ["turmas", "Turmas e encontros", "Turma é oferta de uma versão de curso; estado e encontros são versões com motivo.", [
    ["record_dev_formative_class", "Abrir turma formativa"], ["record_dev_class_status", "Registrar estado da turma"], ["record_dev_meeting_version", "Registrar versão de encontro"]]],
  ["formadores", "Formadores", "Designação temporal sem sobreposição; formador externo nunca recebe permissão.", [
    ["designate_dev_trainer", "Designar formador"], ["end_dev_trainer_designation", "Encerrar designação"]]],
  ["frequencia", "Frequência e atividades", "Presença só com evidência por encontro ou entrega; percentual nunca é digitado: sai da apuração.", [
    ["record_dev_attendance", "Registrar frequência por encontro/atividade"], ["record_dev_class_activity", "Registrar atividade"],
    ["publish_dev_material", "Publicar material"], ["withdraw_dev_material", "Retirar material"], ["submit_dev_activity", "Entregar atividade"], ["record_dev_feedback", "Registrar devolutiva"]]],
  ["avaliacoes", "Avaliações (rubricas)", "Resultado = nível e justificativa em cada critério da rubrica aprovada; nenhuma nota calculada.", [
    ["record_dev_rubric_version", "Registrar versão de rubrica"], ["approve_dev_rubric", "Aprovar rubrica"], ["record_dev_learning_result", "Registrar resultado"],
    ["request_dev_result_review", "Pedir revisão"], ["decide_dev_result_review", "Decidir revisão"]]],
  ["conclusao", "Conclusão", "Critério aprovado → apuração no banco pelas evidências e rubrica → confirmação por pessoa diferente do participante.", [
    ["record_dev_completion_criteria", "Registrar critério de conclusão"], ["approve_dev_completion_criteria", "Aprovar critério"],
    ["assess_dev_completion", "Apurar conclusão pelas evidências"], ["confirm_dev_completion", "Confirmar conclusão"]]],
  ["certificados", "Certificados", "Versão → validação humana por pessoa autorizada (≠ autor, titular e confirmador) → emissão com código. PDF só é oferecido depois da emissão.", [
    ["record_dev_certificate_version", "Registrar versão do certificado"], ["validate_dev_certificate", "Validar ou recusar versão"],
    ["issue_dev_certificate", "Emitir certificado validado"], ["revoke_dev_certificate", "Revogar certificado"]]],
  ["externa", "Formação externa", "Comprovante juntado no SIGEM Documentos; análise por outra pessoa.", [
    ["submit_dev_external_training", "Enviar formação externa"], ["review_dev_external_training", "Analisar formação externa"],
    ["record_dev_partner_version", "Registrar versão de parceiro"], ["approve_dev_partner", "Aprovar parceiro"]]],
  ["pdi", "Competências e PDI", "Competência só vale aprovada; PDI é da própria pessoa e o compartilhamento pode ser revogado.", [
    ["record_dev_competency_version", "Registrar versão de competência"], ["approve_dev_competency", "Aprovar competência"],
    ["record_dev_idp_version", "Registrar versão do PDI"], ["record_dev_idp_activity", "Registrar atividade do PDI"], ["revoke_dev_idp_share", "Revogar compartilhamento do PDI"]]],
  ["questionarios", "Questionários", "Questionário sem gabarito/nota e resposta única; pesquisa só aprovada; satisfação nunca entra na conclusão.", [
    ["record_dev_questionnaire", "Registrar questionário"], ["answer_dev_questionnaire", "Responder questionário"],
    ["record_dev_survey_version", "Registrar versão de pesquisa"], ["approve_dev_survey", "Aprovar pesquisa"], ["answer_dev_survey", "Responder pesquisa"]]],
  ["indicadores", "Indicadores", "Indicador e limiar só aprovados por outra pessoa; agregado só com grupo mínimo.", [
    ["record_dev_impact_indicator", "Registrar indicador"], ["approve_dev_impact_indicator", "Aprovar indicador"], ["record_dev_impact_reading", "Registrar leitura"],
    ["record_dev_impact_observation", "Registrar observação"], ["record_dev_threshold_version", "Registrar limiar"], ["approve_dev_threshold", "Aprovar limiar"]]],
];
// Frequência é derivada: o argumento de percentual é sempre nulo e nunca aparece como campo.
const DERIVED = { record_dev_participation: { _pct: null } };
function withDerived(st) {
  for (const s of st) for (const a of s.actions) { const d = DERIVED[a.rpc]; if (!d) continue;
    a.fields = a.fields.filter((f) => !(f.arg in d)); a.fixed = { ...(a.fixed ?? {}), ...d }; }
  return st;
}

const out = (name, data) => `// GERADO por scripts/rpc-console-stages.mjs a partir das assinaturas reais dos writers. Não edite à mão.\nimport type { OperationStage } from "@/features/enrollments/enrollment-operations";\n\nexport const ${name}: readonly OperationStage[] = ${JSON.stringify(data, null, 1)};\n`;
writeFileSync("src/features/permanence/permanence-operations.gen.ts", out("PERMANENCE_STAGES", stages(PERMANENCE)));
writeFileSync("src/features/operations-center/ops-operations.gen.ts", out("OPS_STAGES", stages(OPERATIONS)));
writeFileSync("src/features/professional-development/development-operations.gen.ts", out("DEVELOPMENT_STAGES", withDerived(stages(DEVELOPMENT))));
console.log("ok");
