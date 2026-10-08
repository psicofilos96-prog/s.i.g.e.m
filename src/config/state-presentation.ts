/**
 * NSTATE.1 — apresentação canônica de estados. Cada domínio declara, para cada estado CANÔNICO
 * (o valor que o banco ou a projeção do ledger devolve), uma FASE semântica e um rótulo.
 * A cor sai só da fase, para que estados equivalentes em domínios diferentes tenham a mesma cor.
 * O frontend não cria estados: valor fora do registro aparece como "Situação não reconhecida".
 */
import type { CalendarStatus } from "@/features/calendar/calendar-types";
import type { ClassAdministrativeStatus } from "@/features/classes/institutional-class-contract";
import type { EmissionStatus } from "@/features/school-documents/document-engine";
import type { WorkflowStage } from "@/features/statistical-map/map-structures";
import type { ReviewState } from "@/features/teacher-review/teacher-work-review";
import type { OrderStatus } from "@/features/school-meals/order-model";
import type { TaskStatus } from "@/features/tasks/task-model";
import type { InstrumentStatus } from "@/features/assessment/assessment-types";

export type StatePhase = "rascunho" | "aguardando" | "em-curso" | "devolvido" | "vigente" | "encerrado" | "substituido";
export type StateTone = "success" | "warning" | "danger" | "info" | "neutral";

/** Única fonte da cor: fase → tom. */
export const PHASE_TONE: Record<StatePhase, StateTone> = {
  rascunho: "neutral", aguardando: "info", "em-curso": "info", devolvido: "warning",
  vigente: "success", encerrado: "danger", substituido: "neutral",
};

type Entry = Readonly<{ label: string; phase: StatePhase }>;
const e = (label: string, phase: StatePhase): Entry => ({ label, phase });

export const STATE_REGISTRY = {
  calendario: {
    rascunho: e("Rascunho", "rascunho"), "em-revisao": e("Em revisão", "aguardando"),
    homologado: e("Homologado", "vigente"), arquivado: e("Arquivado", "substituido"),
  } satisfies Record<CalendarStatus, Entry>,
  turma: { ativa: e("Ativa", "vigente"), inativa: e("Inativa", "encerrado") } satisfies Record<ClassAdministrativeStatus, Entry>,
  documento: {
    valida: e("Válido", "vigente"), cancelada: e("Cancelado", "encerrado"), retificada: e("Retificado", "substituido"),
  } satisfies Record<EmissionStatus, Entry>,
  mapa: {
    rascunho: e("Rascunho", "rascunho"), enviado: e("Enviado à Estatística", "aguardando"),
    devolvido: e("Devolvido para ajuste", "devolvido"), reenviado: e("Reenviado", "aguardando"),
    aprovado: e("Aprovado (oficial)", "vigente"), "em-retificacao": e("Em retificação", "em-curso"),
  } satisfies Record<WorkflowStage, Entry>,
  "sipe-sia": {
    "nao-enviado": e("Ainda não enviado à Orientação Pedagógica", "rascunho"),
    "em-analise": e("Enviado — em análise pela Orientação Pedagógica", "aguardando"),
    "ajuste-solicitado": e("Ajuste solicitado — corrija e reenvie", "devolvido"),
    aprovado: e("Aprovado pela Orientação Pedagógica", "vigente"),
    "aprovado-versao-anterior": e("Versão anterior aprovada — esta versão ainda não foi enviada", "rascunho"),
  } satisfies Record<ReviewState, Entry>,
  avaliacao: { planejado: e("Planejado", "rascunho"), aplicado: e("Aplicado", "vigente") } satisfies Record<InstrumentStatus, Entry>,
  solicitacao: {
    rascunho: e("Rascunho da escola", "rascunho"), submetido: e("Submetido", "aguardando"), "em-analise": e("Em análise", "em-curso"),
    devolvido: e("Devolvido para correção", "devolvido"), "autorizado-total": e("Autorizado (total)", "vigente"),
    "autorizado-parcial": e("Autorizado (parcial)", "vigente"), rejeitado: e("Rejeitado", "encerrado"),
    cancelado: e("Cancelado", "encerrado"), retificado: e("Autorização retificada", "vigente"),
  } satisfies Record<OrderStatus, Entry>,
  servico: {
    aberta: e("Aberta", "aguardando"), "em-andamento": e("Em andamento", "em-curso"),
    concluida: e("Concluída", "vigente"), cancelada: e("Cancelada", "encerrado"),
  } satisfies Record<TaskStatus, Entry>,
} as const;

/** Rótulos de um domínio, para consumidores que já exportavam um mapa de rótulos. */
export function labelsOf<K extends string>(m: Readonly<Record<K, Entry>>): Record<K, string> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, (v as Entry).label])) as Record<K, string>;
}

export type StateDomain = keyof typeof STATE_REGISTRY;
export type StatePresentation = Readonly<{ label: string; tone: StateTone; phase: StatePhase | null; known: boolean }>;

/** Rótulo e cor só do estado canônico; desconhecido falha fechado, sem palpite. */
export function presentState(domain: StateDomain, value: string | null | undefined): StatePresentation {
  if (!value) return { label: "Sem situação registrada", tone: "neutral", phase: null, known: false };
  const hit = (STATE_REGISTRY[domain] as Record<string, Entry>)[value];
  return hit ? { label: hit.label, tone: PHASE_TONE[hit.phase], phase: hit.phase, known: true }
    : { label: "Situação não reconhecida", tone: "neutral", phase: null, known: false };
}
