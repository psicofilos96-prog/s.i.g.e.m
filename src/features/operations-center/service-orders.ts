/**
 * Centro de Operações — L06: ordem de serviço (migration 0409).
 * Solicitação (L02) ≠ ordem de manutenção (L05) ≠ serviço executado (OS). A OS só é emitida
 * para manutenção já PROGRAMADA e só é "executada" após confirmação por profissional autorizado
 * (`confirmar-servicos-executados`) que não declarou nem integra a equipe. Declarar execução exige
 * evidência juntada. Equipe = atuações vigentes; material com origem e referência declaradas;
 * custo só com comprovante documental (juntada do SIGEM Documentos) — sem comprovante não há custo,
 * e total só existe quando todos os lançamentos são comprovados (sempre o são, por construção).
 * Estados impostos no banco (`ops_service_state` / `ops_service_next_ok`); este módulo espelha.
 */
export type ServiceEventKind = "equipe-inclusao" | "equipe-saida" | "material" | "custo" | "evidencia" | "inicio" | "suspensao" | "retomada"
  | "execucao-declarada" | "confirmacao" | "rejeicao" | "cancelamento";
export type ServiceState = "emitida" | "em-execucao" | "suspensa" | "aguardando-confirmacao" | "executada" | "cancelada";

const STATE_OF: Partial<Record<ServiceEventKind, ServiceState>> = {
  inicio: "em-execucao", retomada: "em-execucao", suspensao: "suspensa", "execucao-declarada": "aguardando-confirmacao",
  confirmacao: "executada", rejeicao: "em-execucao", cancelamento: "cancelada",
};
const RECORD_ONLY: ServiceEventKind[] = ["equipe-inclusao", "equipe-saida", "material", "custo", "evidencia"];

/** Espelho de public.ops_service_next_ok. */
export function serviceNextOk(state: ServiceState, kind: ServiceEventKind): boolean {
  if (state === "executada" || state === "cancelada") return false;
  if (RECORD_ONLY.includes(kind)) return true;
  switch (kind) {
    case "cancelamento": return state !== "aguardando-confirmacao";
    case "inicio": return state === "emitida";
    case "suspensao": case "execucao-declarada": return state === "em-execucao";
    case "retomada": return state === "suspensa";
    case "confirmacao": case "rejeicao": return state === "aguardando-confirmacao";
    default: return false;
  }
}

export const SERVICE_CAPABILITY = (kind: ServiceEventKind) =>
  kind === "confirmacao" || kind === "rejeicao" ? "confirmar-servicos-executados"
  : kind === "custo" ? "registrar-custos-de-servico"
  : kind === "equipe-inclusao" || kind === "equipe-saida" || kind === "cancelamento" ? "emitir-ordens-de-servico"
  : "executar-manutencao";

export interface ServiceEvent {
  seq: number; kind: ServiceEventKind; actorPerson: string; actorIsTeam?: boolean;
  engagementId?: string | null; materialLabel?: string | null; quantity?: number | null; unit?: string | null;
  materialOrigin?: "almoxarifado" | "fornecedor" | "doacao" | "reaproveitamento" | null; amount?: number | null;
  hasDocRef?: boolean; occurredOn?: string | null; note?: string | null;
}
export interface ServiceView {
  state: ServiceState; team: string[]; materials: { label: string; quantity: number; unit: string; origin: string }[];
  costTotal: number | null; costEntries: number; evidences: number; rejections: number;
  executedConfirmed: boolean; label: string; issues: string[];
}

export function projectService(events: readonly ServiceEvent[]): ServiceView {
  const v: ServiceView = { state: "emitida", team: [], materials: [], costTotal: null, costEntries: 0, evidences: 0, rejections: 0,
    executedConfirmed: false, label: "", issues: [] };
  let cost = 0;
  const declarers = new Set<string>();
  [...events].sort((a, b) => a.seq - b.seq).forEach((e, i) => {
    if (e.seq !== i + 1) v.issues.push(`sequência quebrada em ${e.seq}`);
    if (!serviceNextOk(v.state, e.kind)) { v.issues.push(`${e.kind} inválido em ${v.state}`); return; }
    switch (e.kind) {
      case "equipe-inclusao": if (e.engagementId && !v.team.includes(e.engagementId)) v.team.push(e.engagementId); break;
      case "equipe-saida": v.team = v.team.filter((t) => t !== e.engagementId); break;
      case "material": v.materials.push({ label: e.materialLabel!, quantity: e.quantity!, unit: e.unit!, origin: e.materialOrigin! }); break;
      case "custo": if (!e.hasDocRef) { v.issues.push("custo sem comprovante ignorado"); return; } cost += e.amount ?? 0; v.costEntries += 1; break;
      case "evidencia": v.evidences += 1; break;
      case "execucao-declarada":
        if (v.evidences === 0) { v.issues.push("declaração sem evidência"); return; }
        declarers.add(e.actorPerson); break;
      case "confirmacao": case "rejeicao":
        if (declarers.has(e.actorPerson) || e.actorIsTeam) { v.issues.push("confirmação por quem executou"); return; }
        if (e.kind === "rejeicao") v.rejections += 1;
        break;
    }
    const s = STATE_OF[e.kind];
    if (s) v.state = s;
  });
  v.costTotal = v.costEntries ? cost : null;
  v.executedConfirmed = v.state === "executada";
  v.label = v.state === "aguardando-confirmacao" ? "Execução declarada pela equipe — ainda não confirmada"
    : v.state === "executada" ? "Serviço executado e confirmado por profissional autorizado"
    : v.state === "emitida" ? "Ordem emitida — serviço não iniciado" : v.state;
  return v;
}

export const costLabel = (v: ServiceView) => v.costTotal === null ? "custo não informado (sem comprovante)" : `R$ ${v.costTotal.toFixed(2)} em ${v.costEntries} comprovante(s)`;
export const serviceOrderKey = (maintenanceOrder: string, purposeRef: string) => `ops-so|${maintenanceOrder}|${purposeRef}`;
export const serviceEventKey = (so: string, expected: number, kind: ServiceEventKind) => `ops-so-e|${so}|${expected}|${kind}`;
