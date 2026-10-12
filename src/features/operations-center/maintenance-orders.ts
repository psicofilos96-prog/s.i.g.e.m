/**
 * Centro de Operações — L05: ordem de manutenção (migration 0408) sobre a solicitação L02.
 * Fluxo: triagem → (devolução) | classificação → avaliação técnica → programação → execução
 *        → conferência (aprovada → conclusão | reprovada → nova execução/programação); cancelamento justificado.
 * Transições são impostas NO BANCO (`ops_maintenance_next_ok`); este módulo espelha a regra para a tela.
 * Categoria e urgência só do catálogo aprovado (pessoa ≠ autor), urgência sempre com motivo escrito.
 * Executor = atuação vigente na data programada; só essa pessoa registra a execução; conferente ≠ executor.
 * Avaliação técnica que exige laudo bloqueia a programação na tela até haver laudo juntado (rota L04).
 * Protocolo é o L06 único do SIGEM Documentos; nenhuma prioridade/SLA nasce do código.
 */
export type MaintenanceStage = "triagem" | "devolucao" | "classificacao" | "avaliacao-tecnica" | "programacao" | "execucao" | "conferencia" | "conclusao" | "cancelamento";

export const STAGE_CAPABILITY: Record<MaintenanceStage, string> = {
  triagem: "triar-manutencao", devolucao: "triar-manutencao", classificacao: "triar-manutencao", cancelamento: "triar-manutencao",
  "avaliacao-tecnica": "avaliar-manutencao", programacao: "programar-manutencao", execucao: "executar-manutencao",
  conferencia: "conferir-manutencao", conclusao: "conferir-manutencao",
};

/** Espelho exato de public.ops_maintenance_next_ok. */
export function nextOk(last: MaintenanceStage | null, stage: MaintenanceStage, lastResult: "aprovada" | "reprovada" | null): boolean {
  if (stage === "cancelamento") return !["conclusao", "cancelamento", "devolucao"].includes(last ?? "");
  switch (last) {
    case null: return stage === "triagem";
    case "triagem": return stage === "classificacao" || stage === "devolucao";
    case "classificacao": return stage === "avaliacao-tecnica" || stage === "classificacao";
    case "avaliacao-tecnica": return stage === "programacao" || stage === "classificacao";
    case "programacao": return stage === "execucao" || stage === "programacao";
    case "execucao": return stage === "conferencia";
    case "conferencia": return lastResult === "aprovada" ? stage === "conclusao" : lastResult === "reprovada" ? stage === "execucao" || stage === "programacao" : false;
    default: return false;
  }
}

export interface MaintenanceEvent {
  seq: number; stage: MaintenanceStage; actorPerson: string; at: string;
  category?: string | null; urgency?: string | null; urgencyReason?: string | null;
  technicalAssessment?: string | null; requiresTechnicalReport?: boolean | null;
  scheduledFor?: string | null; executorEngagement?: string | null; executedOn?: string | null;
  conferenceResult?: "aprovada" | "reprovada" | null; note?: string | null;
}
export interface Catalog { categories: string[]; urgencies: string[] }

export interface MaintenanceView {
  stage: MaintenanceStage | "aberta"; category: string | null; urgency: string | null; urgencyReason: string | null;
  requiresTechnicalReport: boolean | null; scheduledFor: string | null; executor: string | null;
  executions: number; rejections: number; closed: boolean; nextStages: MaintenanceStage[]; issues: string[];
}

const ALL: MaintenanceStage[] = ["triagem", "devolucao", "classificacao", "avaliacao-tecnica", "programacao", "execucao", "conferencia", "conclusao", "cancelamento"];

export function projectOrder(events: readonly MaintenanceEvent[], catalog: Catalog): MaintenanceView {
  const v: MaintenanceView = { stage: "aberta", category: null, urgency: null, urgencyReason: null, requiresTechnicalReport: null, scheduledFor: null,
    executor: null, executions: 0, rejections: 0, closed: false, nextStages: [], issues: [] };
  let last: MaintenanceStage | null = null, lastResult: "aprovada" | "reprovada" | null = null;
  const execPersons = new Set<string>();
  [...events].sort((a, b) => a.seq - b.seq).forEach((e, i) => {
    if (e.seq !== i + 1) v.issues.push(`sequência quebrada em ${e.seq}`);
    if (!nextOk(last, e.stage, lastResult)) { v.issues.push(`transição ${last ?? "início"} → ${e.stage} inválida`); return; }
    if (e.stage === "classificacao") {
      if (!catalog.categories.includes(e.category ?? "") || !catalog.urgencies.includes(e.urgency ?? "")) v.issues.push("classificação fora do catálogo");
      v.category = e.category ?? null; v.urgency = e.urgency ?? null; v.urgencyReason = e.urgencyReason ?? null;
    }
    if (e.stage === "avaliacao-tecnica") v.requiresTechnicalReport = e.requiresTechnicalReport ?? null;
    if (e.stage === "programacao") { v.scheduledFor = e.scheduledFor ?? null; v.executor = e.executorEngagement ?? null; }
    if (e.stage === "execucao") { v.executions += 1; execPersons.add(e.actorPerson); }
    if (e.stage === "conferencia") {
      if (execPersons.has(e.actorPerson)) v.issues.push("conferência pela mesma pessoa que executou");
      if (e.conferenceResult === "reprovada") v.rejections += 1;
    }
    last = e.stage; lastResult = e.stage === "conferencia" ? e.conferenceResult ?? null : lastResult;
    v.stage = e.stage;
  });
  v.closed = ["conclusao", "cancelamento", "devolucao"].includes(v.stage);
  v.nextStages = ALL.filter((s) => nextOk(last, s, lastResult));
  return v;
}

/** Bloqueios de tela antes do writer (o banco revalida capacidade, transição, catálogo, executor e conferente). */
export function blockers(view: MaintenanceView, stage: MaintenanceStage, opts: { hasTechnicalReport?: boolean } = {}): string[] {
  const p: string[] = [];
  if (!view.nextStages.includes(stage)) p.push(`Etapa ${stage} indisponível agora.`);
  if (stage === "programacao" && view.requiresTechnicalReport === true && !opts.hasTechnicalReport)
    p.push("A avaliação técnica exige laudo; junte o laudo pelo SIGEM Documentos antes de programar.");
  return p;
}

export const maintenanceOrderKey = (request: string) => `ops-mo|${request}`;
export const maintenanceEventKey = (order: string, expected: number, stage: MaintenanceStage) => `ops-mo-e|${order}|${expected}|${stage}`;
