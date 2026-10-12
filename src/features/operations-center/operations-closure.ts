/**
 * Centro de Operações — L24: fechamento (60 seções + 20 critérios), exportação auditada e cenários.
 * Nenhum status "homologado": nenhuma regra, catálogo, mínimo, requisito ou capacidade foi aprovada
 * ou atribuída por pessoa competente até aqui; homologação exige ato real.
 */
import { OPS_CRITERIA, OPS_SECTIONS, type OpsRow } from "./operations-audit";

export const OPS_CLOSURE_BASE_SHA = "6e4e90c8148f11c4481f2e889ad1e74b0b19e2ef";
export type OpsClosureStatus = "persistido-com-tela" | "persistido" | "nucleo-testado" | "bloqueado";
export interface OpsLot { lot: number; title: string; status: OpsClosureStatus; evidence: string[]; blocker: string | null }

const F = "src/features/operations-center";
const M = "drizzle/migrations";
const CAP = "Capacidade não atribuída em política homologada (decisão da rede).";
const ev = (name: string, ...migs: string[]) => [`${F}/${name}.ts`, ...migs.map((m) => `${M}/${m}.sql`)];

export const OPS_LOTS: readonly OpsLot[] = [
  { lot: 1, title: "Auditoria", status: "nucleo-testado", evidence: [...ev("operations-audit"), `${F}/operations-audit.test.ts`], blocker: null },
  { lot: 2, title: "Solicitações compartilhadas", status: "persistido", evidence: ev("shared-requests", "0403_ops02_shared_requests", "0404_ops02_hide_attachment_ref"), blocker: CAP },
  { lot: 3, title: "Espaços escolares", status: "persistido", evidence: ev("infrastructure-spaces", "0405_ops03_infrastructure_spaces"), blocker: "Tipos de espaço não aprovados." },
  { lot: 4, title: "Vistorias", status: "persistido", evidence: ev("inspections", "0406_ops04_inspections", "0407_ops04_hide_evidence_refs"), blocker: "Checklists não aprovados." },
  { lot: 5, title: "Manutenção", status: "persistido", evidence: ev("maintenance-orders", "0408_ops05_maintenance_orders"), blocker: "Catálogo de categoria/urgência não aprovado." },
  { lot: 6, title: "Ordens de serviço", status: "persistido", evidence: ev("service-orders", "0409_ops06_service_orders"), blocker: CAP },
  { lot: 7, title: "Preventiva e disponibilidade", status: "persistido", evidence: ev("preventive-maintenance", "0410_ops07_preventive_availability", "0411_ops07_hide_certificate_doc"), blocker: "Planos e limiares não aprovados." },
  { lot: 8, title: "Obras e restrições", status: "persistido", evidence: ev("works-restrictions", "0412_ops08_works_restrictions", "0413_ops08_hide_doc_refs"), blocker: CAP },
  { lot: 9, title: "Bens permanentes", status: "persistido", evidence: ev("permanent-assets", "0414_ops09_assets", "0415_ops09_category_network_capability"), blocker: "Categorias não aprovadas; patrimônio contábil municipal não integrado." },
  { lot: 10, title: "Transferências", status: "persistido", evidence: ev("asset-transfers", "0416_ops10_asset_transfers", "0417_ops10_revoke_helpers"), blocker: CAP },
  { lot: 11, title: "Inventários", status: "persistido", evidence: ev("asset-inventories", "0418_ops11_asset_inventories"), blocker: "Periodicidade não decidida." },
  { lot: 12, title: "Baixa e destinação", status: "persistido", evidence: ev("asset-disposals", "0419_ops12_asset_disposals"), blocker: CAP },
  { lot: 13, title: "Almoxarifado: catálogo e saldo", status: "persistido", evidence: ev("supply-stock", "0420_ops13_supply_stock"), blocker: "Itens não aprovados." },
  { lot: 14, title: "Movimentos transacionais", status: "persistido", evidence: ev("supply-transactions", "0421_ops14_supply_transactions"), blocker: null },
  { lot: 15, title: "Requisições e mínimos", status: "persistido", evidence: ev("supply-requisitions", "0422_ops15_supply_requisitions"), blocker: "Estoques mínimos não aprovados." },
  { lot: 16, title: "Elegibilidade ao transporte", status: "persistido", evidence: ev("transport-eligibility", "0423_ops16_transport_eligibility"), blocker: "Nenhuma regra de elegibilidade aprovada." },
  { lot: 17, title: "Rotas e versões", status: "persistido", evidence: ev("transport-routes", "0424_ops17_transport_routes"), blocker: "Limiar de privacidade não decidido." },
  { lot: 18, title: "Veículos", status: "persistido", evidence: ev("transport-vehicles", "0425_ops18_transport_vehicles", "0426_ops18_vehicles_hide_doc_refs"), blocker: "Documentos exigidos e validade de vistoria não configurados." },
  { lot: 19, title: "Motoristas e monitores", status: "persistido", evidence: ev("transport-crew", "0427_ops19_transport_crew"), blocker: "Requisitos de habilitação não aprovados." },
  { lot: 20, title: "Viagens e ocorrências", status: "persistido", evidence: ev("transport-trips", "0428_ops20_transport_trips"), blocker: "Categorias oficiais de ocorrência não definidas." },
  { lot: 21, title: "Frota, contratos e custos", status: "persistido", evidence: ev("fleet-contracts", "0429_ops21_fleet_contracts_costs"), blocker: "Sistema contábil/contratos municipal não identificado." },
  { lot: 22, title: "Integrações e viabilidade", status: "nucleo-testado", evidence: ev("operations-integrations"), blocker: "Modelo de aviso à família não aprovado." },
  { lot: 23, title: "Painel e relatórios", status: "persistido-com-tela", evidence: [...ev("operations-reports"), `${F}/operations-hub-page.tsx`, "src/routes/centro-de-operacoes.tsx"], blocker: CAP },
  { lot: 24, title: "Segurança e fechamento", status: "nucleo-testado", evidence: [...ev("operations-closure", "0430_ops24_revoke_anon_helpers"), "supabase/tests/ops24_operations_rls.sql"], blocker: "E2E autenticado no navegador e concorrência real não executados." },
];

const range = (a: number, b: number, lots: number[]) => Object.fromEntries(Array.from({ length: b - a + 1 }, (_, i) => [a + i, lots]));
const SECTION_LOTS: Record<number, number[]> = {
  1: [17], 2: [17], 3: [16, 17], 4: [16], 5: [18], 6: [19], 7: [19], 8: [20], 9: [18], 10: [21], 11: [20, 21], 12: [20],
  13: [20], 14: [17, 23], 15: [17], 16: [22], 17: [16], 18: [20], 19: [23], 20: [23],
  21: [3], 22: [2], 23: [3], 24: [2, 4], 25: [3], 26: [4], 27: [2, 5], 28: [5], 29: [6], 30: [5], 31: [7], 32: [21],
  33: [7, 8], 34: [8], 35: [8], 36: [6], 37: [2], 38: [3], 39: [23], 40: [23],
  41: [9], 42: [9], 43: [10], 44: [12], 45: [11], 46: [9], 47: [9, 10], 48: [13], 49: [13, 14], 50: [15], 51: [13, 14],
  52: [14], 53: [13], 54: [21], 55: [13], 56: [9], 57: [9], 58: [9, 12], 59: [23], 60: [23],
};
const CRITERIA_LOTS: Record<number, number[]> = {
  ...range(1, 8, [2, 24]), 9: [5, 10, 12], 10: [21], 11: [8, 22], 12: [13, 14], 13: [17, 24], 14: [22],
  15: [2, 24], 16: [22], 17: [14, 24], 18: [3, 16], 19: [23, 24], 20: [24],
};
/** Bloqueio normativo/externo mesmo com código pronto. */
const NORMATIVE_BLOCK = new Set(["s4", "s10", "s11", "s14", "s16", "s30", "s31", "s32", "s36", "s45", "s46", "s54", "c10", "c14"]);

export interface OpsClosureRow { n: number; title: string; before: OpsRow["status"]; status: OpsClosureStatus; lots: number[]; blocker: string | null }
function close(rows: readonly OpsRow[], map: Record<number, number[]>, prefix: "s" | "c"): OpsClosureRow[] {
  const rank: OpsClosureStatus[] = ["persistido-com-tela", "persistido", "nucleo-testado"];
  return rows.map((row) => {
    const lots = (map[row.n] ?? []).map((n) => OPS_LOTS.find((l) => l.lot === n)).filter((l): l is OpsLot => !!l);
    const best = rank.find((s) => lots.some((l) => l.status === s));
    const blocked = NORMATIVE_BLOCK.has(`${prefix}${row.n}`) || !best;
    const blocker = lots.find((l) => l.blocker)?.blocker ?? null;
    return { n: row.n, title: row.title, before: row.status, lots: lots.map((l) => l.lot), status: blocked ? "bloqueado" : best!, blocker: blocked ? (blocker ?? (row.gap || "Sem lote que cubra.")) : blocker };
  });
}
export const OPS_CLOSURE_SECTIONS = close(OPS_SECTIONS, SECTION_LOTS, "s");
export const OPS_CLOSURE_CRITERIA = close(OPS_CRITERIA, CRITERIA_LOTS, "c");
export const opsClosureSummary = (rows: readonly { status: OpsClosureStatus }[]) =>
  rows.reduce<Record<OpsClosureStatus, number>>((a, r) => ({ ...a, [r.status]: a[r.status] + 1 }), { "persistido-com-tela": 0, persistido: 0, "nucleo-testado": 0, bloqueado: 0 });

/** Cenário exigido → arquivo que o prova e trecho que precisa existir nele. */
export const OPS_SCENARIOS: readonly { scenario: string; file: string; needle: string; layer: "ts" | "sql" | "e2e-pendente" }[] = [
  { scenario: "Concorrência e saldo negativo do estoque", file: `${F}/supply-transactions.test.ts`, needle: "concorr", layer: "ts" },
  { scenario: "Lock de saldo no banco", file: `${M}/0421_ops14_supply_transactions.sql`, needle: "for update", layer: "sql" },
  { scenario: "Idempotência de movimento", file: `${F}/supply-transactions.test.ts`, needle: "idempot", layer: "ts" },
  { scenario: "Transferência: uma localização vigente", file: `${F}/asset-transfers.test.ts`, needle: "vigent", layer: "ts" },
  { scenario: "Lock de transferência", file: `${M}/0416_ops10_asset_transfers.sql`, needle: "for update", layer: "sql" },
  { scenario: "Rotas: vigência de versão", file: `${F}/transport-routes.test.ts`, needle: "vigent", layer: "ts" },
  { scenario: "Viagens: odômetro sem regressão", file: `${F}/transport-trips.test.ts`, needle: "regress", layer: "ts" },
  { scenario: "OS: equipe e confirmação distinta", file: `${F}/service-orders.test.ts`, needle: "equipe", layer: "ts" },
  { scenario: "Vigência acadêmica → reavaliação", file: `${F}/transport-eligibility.test.ts`, needle: "reavalia", layer: "ts" },
  { scenario: "Integração sem decisão automática", file: `${F}/operations-integrations.test.ts`, needle: "writes", layer: "ts" },
  { scenario: "RLS, DML, anexos, trajetos e funções", file: "supabase/tests/ops24_operations_rls.sql", needle: "ops24-ok", layer: "sql" },
  { scenario: "Exportação auditada", file: `${F}/operations-closure.test.ts`, needle: "auditedOpsExport", layer: "ts" },
  { scenario: "Fluxo autenticado no navegador", file: `${F}/operations-hub.test.ts`, needle: "describe", layer: "e2e-pendente" },
];

export function opsClosureProblems(exists: (p: string) => boolean, read: (p: string) => string): string[] {
  const p: string[] = [];
  if (OPS_LOTS.length !== 24) p.push("Esperados 24 lotes.");
  if (OPS_CLOSURE_SECTIONS.length !== 60 || OPS_CLOSURE_CRITERIA.length !== 20) p.push("Esperadas 60 seções e 20 critérios.");
  for (const l of OPS_LOTS) for (const e of l.evidence) if (!exists(e)) p.push(`L${l.lot}: evidência ausente ${e}`);
  for (const r of [...OPS_CLOSURE_SECTIONS, ...OPS_CLOSURE_CRITERIA]) if (r.lots.length === 0) p.push(`#${r.n} sem lote`);
  for (const s of OPS_SCENARIOS) {
    if (!exists(s.file)) { p.push(`${s.scenario}: arquivo ausente`); continue; }
    if (!read(s.file).toLowerCase().includes(s.needle.toLowerCase())) p.push(`${s.scenario}: "${s.needle}" não encontrado`);
  }
  return p;
}

/* ---------- Exportação auditada ---------- */
export type OpsEmissionRecorder = (a: { reportId: string; version: number; title: string; format: "csv" | "xlsx" | "pdf"; rows: number; sha256: string; key: string }) => Promise<{ verification_code: string }>;

async function sha256Hex(content: string | ArrayBuffer): Promise<string> {
  const buf = typeof content === "string" ? new TextEncoder().encode(content) : new Uint8Array(content);
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Registra a emissão ANTES de liberar o arquivo; sem capacidade ou falha no registro ⇒ nenhum arquivo. */
export async function auditedOpsExport(a: {
  caps: ReadonlySet<string>; exportCap: string; reportId: string; version: number; title: string;
  format: "csv" | "xlsx" | "pdf"; rows: number; content: string | ArrayBuffer; key: string; record: OpsEmissionRecorder;
}): Promise<{ content: string | ArrayBuffer; sha256: string; code: string }> {
  if (!a.caps.has(a.exportCap)) throw new Error("Exportação exige capacidade atribuída.");
  if (!a.key) throw new Error("Chave idempotente obrigatória.");
  const sha256 = await sha256Hex(a.content);
  const e = await a.record({ reportId: a.reportId, version: a.version, title: a.title, format: a.format, rows: a.rows, sha256, key: a.key });
  if (!e?.verification_code) throw new Error("Emissão não registrada; arquivo não liberado.");
  return { content: a.content, sha256, code: e.verification_code };
}
