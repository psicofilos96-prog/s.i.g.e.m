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

const out = (name, data) => `// GERADO por scripts/rpc-console-stages.mjs a partir das assinaturas reais dos writers. Não edite à mão.\nimport type { OperationStage } from "@/features/enrollments/enrollment-operations";\n\nexport const ${name}: readonly OperationStage[] = ${JSON.stringify(data, null, 1)};\n`;
writeFileSync("src/features/permanence/permanence-operations.gen.ts", out("PERMANENCE_STAGES", stages(PERMANENCE)));
writeFileSync("src/features/operations-center/ops-operations.gen.ts", out("OPS_STAGES", stages(OPERATIONS)));
console.log("ok");
