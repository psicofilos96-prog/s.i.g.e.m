/**
 * PERFIL MEDIADOR — LOTE 13 Solicitações de orientação (núcleo puro).
 * Não é fluxo paralelo: a solicitação é um processo do protocolo geral do SIGEM
 * (motor de tramitação `apply_workflow_transition`, definição homologada). Este
 * núcleo só projeta o pedido do mediador nesse motor e lê o histórico de eventos:
 * sem definição homologada ⇒ nada é aberto; prazo só se declarado na definição
 * sobre dias do calendário lido; notificação por `emit_notification_event`.
 */
export const SUGGESTED_TYPES = ["pedagogica", "recurso", "rotina", "formacao", "material", "apoio", "situacao-nao-prevista"] as const;
export const STEPS = ["abertura", "classificacao", "encaminhamento", "analise", "resposta", "ciencia", "encerramento"] as const;
export type Step = (typeof STEPS)[number];

export interface WorkflowDef {
  id: string; version: number; homologated: boolean; processKind: string; types: string[];
  /** etapa → capacidade exigida (null = autor do pedido). */
  stepCapability: Record<Step, string | null>;
  /** prazo em dias letivos por etapa, só se declarado. */
  deadlineSchoolDays: Partial<Record<Step, number>>;
}
export interface WfEvent { seq: number; processId: string; step: Step; by: string; at: string; text: string | null; payload: Record<string, string>; idem: string }

const CLINICAL = /\b(cid|laudo|diagn[oó]stic|transtorno|psiqui|neurol|medica[cç])/i;

export function openRequest(p: { defs: WorkflowDef[] | null; type: string; schoolId: string; studentId: string | null; subject: string; text: string; at: string;
  actor: { personId: string | null; technical: boolean; designationActive: boolean } }) {
  const r: string[] = [];
  if (p.actor.technical || !p.actor.personId) return { ok: false as const, reasons: ["Solicitação exige pessoa natural."] };
  if (p.defs === null) return { ok: false as const, reasons: ["Definições do protocolo não lidas."] };
  const def = p.defs.filter((d) => d.homologated && d.processKind === "solicitacao-mediacao" && d.types.includes(p.type)).sort((a, b) => b.version - a.version)[0];
  if (!def) return { ok: false as const, reasons: ["Sem fluxo homologado no protocolo para este tipo de solicitação: abertura indisponível."] };
  if (!p.actor.designationActive) r.push("Sem designação vigente.");
  if (p.subject.trim().length < 5) r.push("Informe o assunto.");
  if (p.text.trim().length < 10 || p.text.length > 1500) r.push("Descreva a solicitação (10 a 1500 caracteres).");
  if (CLINICAL.test(p.subject + " " + p.text)) r.push("Sem diagnóstico, CID ou termo clínico: o protocolo não carrega dado clínico.");
  if (r.length) return { ok: false as const, reasons: r };
  const idem = `medreq:${p.actor.personId}:${p.type}:${p.studentId ?? "-"}:${hash(p.subject.trim() + "|" + p.text.trim())}`;
  return { ok: true as const, call: { rpc: "apply_workflow_transition" as const, definitionId: def.id, definitionVersion: def.version, step: "abertura" as Step, idem,
    payload: { tipo: p.type, escola: p.schoolId, estudante: p.studentId ?? "", assunto: p.subject.trim() }, text: p.text.trim() },
    notify: { rpc: "emit_notification_event" as const, eventKind: "solicitacao-mediacao-aberta", idem: `${idem}:notif` } };
}

export function nextStep(events: WfEvent[], processId: string): Step | null {
  const done = new Set(events.filter((e) => e.processId === processId).map((e) => e.step));
  if (!done.has("abertura")) return null;
  return STEPS.find((s) => !done.has(s)) ?? null;
}

export function advance(def: WorkflowDef, events: WfEvent[], processId: string, a: { step: Step; expectedSeq: number; text: string; at: string; payload?: Record<string, string> },
  actor: { personId: string | null; technical: boolean; capabilities: string[]; isRequester: boolean }) {
  if (actor.technical || !actor.personId) return { ok: false as const, reasons: ["Ato exige pessoa natural."] };
  const r: string[] = [];
  const mine = events.filter((e) => e.processId === processId);
  const head = Math.max(0, ...mine.map((e) => e.seq));
  if (a.expectedSeq !== head) r.push("O processo mudou desde a leitura.");
  if (!def.homologated) r.push("Definição não homologada.");
  const nx = nextStep(events, processId);
  if (a.step !== nx) r.push(`Etapa esperada: ${nx ?? "nenhuma (encerrado)"}.`);
  const cap = def.stepCapability[a.step];
  if (cap === null ? !actor.isRequester : !actor.capabilities.includes(cap)) r.push(cap === null ? "Só quem solicitou pratica esta etapa." : `Falta a capacidade ${cap}.`);
  if (a.step === "encaminhamento" && !a.payload?.["destino"]) r.push("Encaminhamento exige setor de destino.");
  if (a.step === "classificacao" && !a.payload?.["classe"]) r.push("Classificação exige classe.");
  if (["analise", "resposta", "encerramento"].includes(a.step) && a.text.trim().length < 5) r.push("Descreva o ato.");
  if (CLINICAL.test(a.text)) r.push("Sem diagnóstico, CID ou termo clínico.");
  if (r.length) return { ok: false as const, reasons: r };
  return { ok: true as const, event: { seq: head + 1, processId, step: a.step, by: actor.personId, at: a.at, text: a.text.trim() || null, payload: a.payload ?? {},
    idem: `wf:${processId}:${head}:${a.step}` } satisfies WfEvent };
}

/** Prazo da etapa atual: só se declarado e com calendário lido; senão null (nunca prazo inventado). */
export function currentDeadline(def: WorkflowDef, events: WfEvent[], processId: string, schoolDays: string[] | null): string | null {
  const nx = nextStep(events, processId); if (!nx) return null;
  const n = def.deadlineSchoolDays[nx]; if (n == null || schoolDays === null) return null;
  const last = events.filter((e) => e.processId === processId).sort((a, b) => b.seq - a.seq)[0]!.at.slice(0, 10);
  const after = schoolDays.filter((d) => d > last).sort();
  return after[n - 1] ?? null;
}

/** Trilha auditável legível: quem, quando, etapa; texto só para participantes autorizados (decidido pelo reader). */
export function trail(events: WfEvent[], processId: string) {
  return events.filter((e) => e.processId === processId).sort((a, b) => a.seq - b.seq).map((e) => ({ seq: e.seq, step: e.step, by: e.by, at: e.at }));
}

function hash(s: string) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); }
