// Centro de Operações L22 — integração entre setores e análise de viabilidade de nova turma.
// Integração só por leitores/writers canônicos já existentes (fonte única); a análise nunca decide, nunca grava.
import type { AptCapacity } from "./works-restrictions";

export type SectorLink = { sector: string; reads: string[]; writesVia: string[]; projection: string };

/** Cada setor entra pela própria fonte; o Centro nunca copia cadastro nem grava no domínio alheio. */
export const SECTOR_LINKS: readonly SectorLink[] = [
  { sector: "Transporte", reads: ["ops_route_versions", "ops_vehicle_events", "ops_trip_executions", "ops_transport_decisions"], writesVia: ["record_ops_route_version", "decide_ops_transport"], projection: "src/features/operations-center/transport-routes.ts" },
  { sector: "Infraestrutura", reads: ["ops_space_use_restrictions", "ops_work_events"], writesVia: [], projection: "src/features/operations-center/works-restrictions.ts" },
  { sector: "Patrimônio e Almoxarifado", reads: ["ops_assets", "ops_asset_events", "ops_supply_movements"], writesVia: [], projection: "src/features/operations-center/permanent-assets.ts" },
  { sector: "Gestão de Pessoas", reads: ["institutional_engagements"], writesVia: [], projection: "src/features/staffing/teacher-need.ts" },
  { sector: "Organização da Rede", reads: ["institutional_schools"], writesVia: [], projection: "src/features/enrollments/capacity-model.ts" },
  { sector: "SIGEM Documentos", reads: ["admin_case_events"], writesVia: ["record_admin_case_event"], projection: "src/features/document-management/admin-case.ts" },
  { sector: "Família", reads: [], writesVia: ["emit_notification_event"], projection: "aviso genérico; nunca ficha, rota individual, horário ou custo" },
  { sector: "Gestão Central", reads: ["ops_requests", "ops_transport_measurements"], writesVia: [], projection: "agregados por escola, sem dado nominal" },
];

/** Família só recebe aviso genérico aprovado; termos internos são recusados. */
const FAMILY_FORBIDDEN = /rota|ponto|horário|horario|placa|motorista|custo|contrato|vistoria|ocorr[eê]ncia/i;
export function familyNotice(text: string, approvedTemplate: boolean): { ok: boolean; reason?: string } {
  if (!approvedTemplate) return { ok: false, reason: "modelo-nao-aprovado" };
  return FAMILY_FORBIDDEN.test(text) ? { ok: false, reason: "termo-interno" } : { ok: true };
}

export type Dimension = "espaco-apto" | "docentes" | "transporte" | "mobiliario-e-materiais";
export type DimensionResult = { dimension: Dimension; status: "atende" | "nao-atende" | "indeterminado"; detail: string; sources: string[] };

export type FeasibilityInput = {
  expectedStudents: number | null;
  space: AptCapacity;
  teacherHoursNeeded: number | null;
  teacherHoursUncovered: number | null; // saldo disponível declarado; null = não calculável
  transportNeeded: boolean | null;
  transportSeatsFree: number | null; // de veículos aptos em rotas aprovadas
  transportStudents: number | null;
  furnitureAvailable: number | null; // bens conferidos no ambiente
};

/** Análise por dimensão; nunca produz "aprovar/abrir turma" — decisão é ato da autoridade competente. */
export function analyzeNewClassFeasibility(i: FeasibilityInput) {
  const out: DimensionResult[] = [];
  const n = i.expectedStudents;
  out.push(i.space.value === null || n === null
    ? { dimension: "espaco-apto", status: "indeterminado", detail: i.space.value === null ? i.space.reason : "demanda-nao-informada", sources: ["works-restrictions.aptCapacity"] }
    : { dimension: "espaco-apto", status: i.space.value >= n ? "atende" : "nao-atende", detail: `${i.space.value} lugares aptos para ${n}`, sources: i.space.basis });
  out.push(i.teacherHoursNeeded === null || i.teacherHoursUncovered === null
    ? { dimension: "docentes", status: "indeterminado", detail: "carga necessaria ou saldo nao calculavel", sources: ["staffing/teacher-need"] }
    : { dimension: "docentes", status: i.teacherHoursUncovered >= i.teacherHoursNeeded ? "atende" : "nao-atende", detail: `${i.teacherHoursUncovered} de ${i.teacherHoursNeeded} aulas`, sources: ["staffing/teacher-need"] });
  if (i.transportNeeded === false) out.push({ dimension: "transporte", status: "atende", detail: "sem demanda declarada", sources: ["ops_transport_decisions"] });
  else out.push(i.transportNeeded === null || i.transportSeatsFree === null || i.transportStudents === null
    ? { dimension: "transporte", status: "indeterminado", detail: "demanda ou lugares nao informados", sources: ["transport-routes", "transport-vehicles"] }
    : { dimension: "transporte", status: i.transportSeatsFree >= i.transportStudents ? "atende" : "nao-atende", detail: `${i.transportSeatsFree} lugares para ${i.transportStudents}`, sources: ["transport-routes", "transport-vehicles"] });
  out.push(i.furnitureAvailable === null || n === null
    ? { dimension: "mobiliario-e-materiais", status: "indeterminado", detail: "inventario nao conferido", sources: ["asset-inventories"] }
    : { dimension: "mobiliario-e-materiais", status: i.furnitureAvailable >= n ? "atende" : "nao-atende", detail: `${i.furnitureAvailable} conjuntos para ${n}`, sources: ["asset-inventories"] });
  return { dimensions: out, decision: null, requiresCompetentDecision: true as const, writes: [] as const };
}
