// Tecnologia L03 — painel operacional. Projeção calculada na hora dos ledgers canônicos lidos pela RLS de quem
// consulta (ops_requests 'tecnologia' + ops_request_events, tech_ticket_records, tech_problems/_events,
// tech_changes/_events). Nada é gravado; fonte sem registro canônico aparece "indisponível" com motivo, nunca zero.
import { projectRequest, type OpsEvent, type OpsState } from "@/features/operations-center/shared-requests";
import { currentNature, problemState, type ChangeAction, type ProblemAction, type TicketRecord } from "./itsm-core";

export interface TicketRow { id: string; schoolId: string; createdAt: string; events: OpsEvent[]; records: TicketRecord[] }
export interface ItemRow<A> { id: string; schoolId: string | null; events: { seq: number; action: A }[] }
export interface DashboardInput { tickets: TicketRow[]; problems: ItemRow<ProblemAction>[]; changes: ItemRow<ChangeAction>[]; truncated: boolean; today: string }

export type Panel =
  | { key: string; status: "ok"; values: Record<string, number>; source: string }
  | { key: string; status: "unavailable"; reason: string; source: string };

const OPEN: OpsState[] = ["aberta", "atribuida", "em-atendimento", "em-espera"];
const daysBetween = (a: string, b: string) => Math.floor((Date.parse(b) - Date.parse(a.slice(0, 10))) / 86_400_000);

export function changeState(ev: readonly { seq: number; action: ChangeAction }[]) {
  return [...ev].sort((a, b) => a.seq - b.seq).at(-1)?.action ?? "proposta";
}

export function techDashboard(i: DashboardInput): { panels: Panel[]; schools: number; issues: number; truncated: boolean } {
  let issues = 0;
  const t = { abertos: 0, "em-atendimento": 0, "em-espera": 0, concluidos: 0, cancelados: 0, "sem-natureza": 0, "abertos-mais-de-30-dias": 0 };
  const n = { incidentes: 0, requisicoes: 0, "incidentes-abertos": 0 };
  for (const r of i.tickets) {
    const p = projectRequest(r.events);
    if (p.issues.length) issues++;
    const open = OPEN.includes(p.state);
    if (p.state === "em-atendimento") t["em-atendimento"]++;
    else if (p.state === "em-espera") t["em-espera"]++;
    else if (p.state === "concluida") t.concluidos++;
    else if (p.state === "cancelada") t.cancelados++;
    if (open) { t.abertos++; if (daysBetween(r.createdAt, i.today) > 30) t["abertos-mais-de-30-dias"]++; }
    const nat = currentNature(r.records);
    if (!nat) t["sem-natureza"]++;
    else if (nat === "incidente") { n.incidentes++; if (open) n["incidentes-abertos"]++; }
    else n.requisicoes++;
  }
  const prob: Record<string, number> = {};
  for (const p of i.problems) { const s = problemState(p.events); prob[s] = (prob[s] ?? 0) + 1; }
  const chg: Record<string, number> = {};
  for (const c of i.changes) { const s = changeState(c.events); chg[s] = (chg[s] ?? 0) + 1; }
  const schools = new Set(i.tickets.map((r) => r.schoolId)).size;
  return {
    schools, issues, truncated: i.truncated,
    panels: [
      { key: "chamados", status: "ok", values: t, source: "ops_requests (setor tecnologia) + ops_request_events" },
      { key: "incidentes", status: "ok", values: n, source: "tech_ticket_records (natureza vigente)" },
      { key: "problemas", status: "ok", values: prob, source: "tech_problems + tech_problem_events" },
      { key: "mudancas", status: "ok", values: chg, source: "tech_changes + tech_change_events" },
      { key: "equipamentos", status: "unavailable", source: "ops_assets + ops_asset_category_versions",
        reason: "Nenhuma categoria de bem foi declarada e aprovada como equipamento de tecnologia; sem essa decisão, o painel não presume quais bens contar." },
      { key: "conectividade", status: "unavailable", source: "nenhuma fonte canônica",
        reason: "Não há medição de conectividade por escola registrada (depende de provedor/contrato); velocidade não é presumida." },
      { key: "projetos", status: "unavailable", source: "nenhuma fonte canônica",
        reason: "Não existe registro de projetos de tecnologia no SIGEM; mudanças não são apresentadas como projetos." },
    ],
  };
}
