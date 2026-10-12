/**
 * Centro de Operações — L02: núcleo compartilhado de solicitações (migration 0403).
 * Solicitação e eventos são fatos append-only; estado, responsável vigente e vínculos
 * temporais são PROJEÇÃO dos eventos, nunca campo gravado. Anexo é referência a juntada
 * no SIGEM Documentos (lida só pela leitura restrita de lá); protocolo é o L06 único.
 * Escrita só por `open_ops_request` / `record_ops_request_event` (capacidades
 * `solicitar-<setor>` / `atender-<setor>` na escola, pessoa da sessão, seq esperado,
 * chave idempotente). O executor técnico não grava: `OPS_EXECUTOR_WRITES` é vazio.
 */
export type OpsSector = "transporte" | "infraestrutura" | "patrimonio";
export const OPS_SECTORS: readonly OpsSector[] = ["transporte", "infraestrutura", "patrimonio"];
export type OpsEventKind = "atribuicao" | "inicio" | "espera" | "conclusao" | "cancelamento" | "reabertura"
  | "vinculo-protocolo" | "vinculo-objeto" | "fim-vinculo-objeto" | "anexo";
export type OpsObjectKind = "rota" | "ponto" | "veiculo" | "ambiente" | "bem" | "item-almoxarifado";
export type OpsState = "aberta" | "atribuida" | "em-atendimento" | "em-espera" | "concluida" | "cancelada";

export interface OpsEvent {
  seq: number; kind: OpsEventKind; actorPerson: string; at: string;
  responsibleEngagement?: string | null; protocolRef?: string | null;
  objectKind?: OpsObjectKind | null; objectRef?: string | null; validFrom?: string | null; note?: string | null;
}
export interface OpsLink { objectKind: OpsObjectKind; objectRef: string; from: string; to: string | null }
export interface OpsProjection {
  state: OpsState; responsible: string | null; protocols: string[]; links: OpsLink[]; attachments: number; issues: string[];
}

export const capabilityFor = (action: "solicitar" | "atender" | "acompanhar", sector: OpsSector) => `${action}-${sector}`;
export const OPS_EXECUTOR_WRITES: readonly string[] = [];

/** Transições admitidas por estado (estrutura do núcleo, não norma de setor). */
const ALLOWED: Record<OpsState, OpsEventKind[]> = {
  aberta: ["atribuicao", "cancelamento"],
  atribuida: ["atribuicao", "inicio", "espera", "cancelamento"],
  "em-atendimento": ["atribuicao", "espera", "conclusao", "cancelamento"],
  "em-espera": ["atribuicao", "inicio", "cancelamento"],
  concluida: ["reabertura"],
  cancelada: ["reabertura"],
};
const NEUTRAL: OpsEventKind[] = ["vinculo-protocolo", "vinculo-objeto", "fim-vinculo-objeto", "anexo"];

export function canApply(state: OpsState, kind: OpsEventKind): boolean {
  if (NEUTRAL.includes(kind)) return state !== "cancelada";
  return ALLOWED[state].includes(kind);
}

export function projectRequest(events: readonly OpsEvent[]): OpsProjection {
  const p: OpsProjection = { state: "aberta", responsible: null, protocols: [], links: [], attachments: 0, issues: [] };
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  sorted.forEach((e, i) => {
    if (e.seq !== i + 1) p.issues.push(`sequência quebrada em ${e.seq}`);
    if (!canApply(p.state, e.kind)) { p.issues.push(`evento ${e.kind} inválido em ${p.state} (seq ${e.seq})`); return; }
    switch (e.kind) {
      case "atribuicao": p.responsible = e.responsibleEngagement ?? null; if (p.state === "aberta") p.state = "atribuida"; break;
      case "inicio": p.state = "em-atendimento"; break;
      case "espera": p.state = "em-espera"; break;
      case "conclusao": p.state = "concluida"; break;
      case "cancelamento": p.state = "cancelada"; break;
      case "reabertura": p.state = p.responsible ? "atribuida" : "aberta"; break;
      case "vinculo-protocolo": if (e.protocolRef && !p.protocols.includes(e.protocolRef)) p.protocols.push(e.protocolRef); break;
      case "anexo": p.attachments += 1; break;
      case "vinculo-objeto": {
        const open = p.links.find((l) => l.objectKind === e.objectKind && l.objectRef === e.objectRef && l.to === null);
        if (open) p.issues.push(`vínculo já aberto com ${e.objectKind}:${e.objectRef}`);
        else p.links.push({ objectKind: e.objectKind!, objectRef: e.objectRef!, from: e.validFrom!, to: null });
        break;
      }
      case "fim-vinculo-objeto": {
        const open = p.links.find((l) => l.objectKind === e.objectKind && l.objectRef === e.objectRef && l.to === null);
        if (!open) p.issues.push(`fim de vínculo inexistente ${e.objectKind}:${e.objectRef}`);
        else if (e.validFrom! < open.from) p.issues.push("fim de vínculo anterior ao início");
        else open.to = e.validFrom!;
        break;
      }
    }
  });
  return p;
}

/** Vínculos vigentes numa data (vigência [from, to) ). */
export const linksOn = (p: OpsProjection, date: string) => p.links.filter((l) => l.from <= date && (l.to === null || date < l.to));

/** Pré-validação na tela antes do writer; o banco revalida capacidade, seq e responsável vigente. */
export function validateEvent(state: OpsState, e: Omit<OpsEvent, "seq" | "actorPerson" | "at">): string[] {
  const p: string[] = [];
  if (!canApply(state, e.kind)) p.push(`Ação indisponível no estado ${state}.`);
  if (e.kind === "atribuicao" && !e.responsibleEngagement) p.push("Responsável é uma atuação vigente na escola.");
  if (["espera", "cancelamento", "reabertura"].includes(e.kind) && (!e.note || e.note.trim().length < 10)) p.push("Justificativa obrigatória (mín. 10 caracteres).");
  if ((e.kind === "vinculo-objeto" || e.kind === "fim-vinculo-objeto") && (!e.objectKind || !e.objectRef || !e.validFrom)) p.push("Vínculo exige objeto e data.");
  if (e.kind === "vinculo-protocolo" && !e.protocolRef) p.push("Protocolo vem do SIGEM Documentos.");
  return p;
}

export const opsRequestKey = (sector: OpsSector, school: string, purposeRef: string) => `ops|${sector}|${school}|${purposeRef}`;
export const opsEventKey = (request: string, expectedSeq: number, kind: OpsEventKind) => `ops-ev|${request}|${expectedSeq}|${kind}`;
