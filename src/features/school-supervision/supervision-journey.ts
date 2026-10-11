/**
 * Lote 11 Supervisão — percurso cotidiano como projeção declarativa.
 * Cada etapa aponta o núcleo dono e diz se pode gravar AGORA. Sem ledger no banco
 * (aguarda decisão do coordenador), a etapa fica "aguardando-decisao" — a tela nunca
 * simula visita, instrumento ou resposta. Só "registrar acompanhamento" grava hoje,
 * pelo writer real `record_school_supervision`.
 */
export type StepState = "disponivel" | "consulta" | "aguardando-decisao";
export interface JourneyStep { id: string; title: string; who: "supervisao" | "escola"; module: string; persisted: boolean; requires: string | null }

export const JOURNEY: JourneyStep[] = [
  { id: "planejar", title: "Planejar a visita", who: "supervisao", module: "supervision-visits", persisted: false, requires: "coordenador da Supervisão designado" },
  { id: "instrumento", title: "Aplicar instrumento", who: "supervisao", module: "supervision-instruments", persisted: false, requires: "instrumento publicado" },
  { id: "situacao", title: "Registrar situação", who: "supervisao", module: "record_school_supervision", persisted: true, requires: null },
  { id: "orientar", title: "Orientar a escola", who: "supervisao", module: "supervision-guidance", persisted: false, requires: "modelos de expediente aprovados" },
  { id: "responder", title: "Escola responde", who: "escola", module: "supervision-guidance", persisted: false, requires: "expediente emitido" },
  { id: "verificar", title: "Verificar providências", who: "supervisao", module: "supervision-nonconformity", persisted: false, requires: "coordenador da Supervisão designado" },
  { id: "encerrar", title: "Encerrar", who: "supervisao", module: "supervision-nonconformity", persisted: false, requires: "coordenador da Supervisão designado" },
];

export function journeyState(canRecord: boolean): (JourneyStep & { state: StepState; note: string })[] {
  return JOURNEY.map((s) => {
    if (!s.persisted) return { ...s, state: "aguardando-decisao", note: `Ainda não grava: falta ${s.requires}.` };
    return canRecord ? { ...s, state: "disponivel", note: "Grava no registro oficial da Supervisão." }
      : { ...s, state: "consulta", note: "Só consulta: sua atuação não tem a permissão de registro." };
  });
}

/** Busca local só sobre linhas já autorizadas; nunca amplia leitura. */
export function filterRecords<T extends { subject: string; referral: string | null }>(rows: T[], q: string) {
  const n = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const words = n(q).split(/\s+/).filter(Boolean);
  return words.length ? rows.filter((r) => words.every((w) => n(`${r.subject} ${r.referral ?? ""}`).includes(w))) : rows;
}
