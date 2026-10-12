/**
 * PERFIL MEDIADOR — LOTE 11 Ocorrências e urgências (núcleo puro).
 * Ocorrência = ledger append-only (seq esperado, idempotência) com fato observável,
 * providências, destinatários e encaminhamento. Tipos (barreira, falta de recurso,
 * alteração de rotina, segurança, necessidade de orientação) são lista aberta.
 * Urgência NÃO é resolvida pelo registro: exibe só protocolos institucionais
 * homologados de ação imediata; sem protocolo, aviso fixo de acionar quem está
 * presente e os serviços competentes. Registrar nunca substitui proteção.
 */
export const SUGGESTED_TYPES = ["barreira", "falta-recurso", "alteracao-rotina", "seguranca", "necessidade-orientacao"] as const;
export type Status = "registrada" | "recebida" | "em-providencia" | "encaminhada" | "concluida";
export type Act = "registrar" | "complementar" | "receber" | "providenciar" | "encaminhar" | "concluir";
export interface Recipient { kind: "direcao" | "nei" | "orientacao" | "secretaria" | "supervisao"; schoolId: string | null }
export interface OccEvent { seq: number; occurrenceId: string; act: Act; by: string; byRole: "autor" | "destinatario"; at: string; text: string; idem: string; referral: string | null }
export interface Occurrence { id: string; schoolId: string; studentId: string | null; designationId: string; type: string; date: string; place: string; fact: string; actions: string; recipients: Recipient[]; urgent: boolean; authorPersonId: string }
export interface Protocol { id: string; version: number; types: string[]; title: string; steps: string[]; homologated: boolean; validFrom: string; validTo: string | null }

export const URGENT_FALLBACK = "Em situação de risco, acione imediatamente a Direção ou o profissional responsável presente e, se necessário, os serviços competentes (SAMU 192, Bombeiros 193, Polícia 190, Conselho Tutelar). Este registro não substitui esse acionamento.";
const CLINICAL = /\b(cid|laudo|diagn[oó]stic|transtorno|psiqui|neurol)/i;
const JUDGEMENT = /\b(agressiv|mal[- ]educad|culpa|de prop[oó]sito|manipul|parece que|deve ter|provavelmente)/i;

export function urgentGuidance(type: string, protocols: Protocol[] | null, date: string) {
  const ok = (protocols ?? []).filter((p) => p.homologated && p.types.includes(type) && p.validFrom <= date && (!p.validTo || date <= p.validTo));
  return { protocols: ok.map((p) => ({ id: p.id, version: p.version, title: p.title, steps: p.steps })), notice: URGENT_FALLBACK, protocolsRead: protocols !== null };
}

export function validateOccurrence(o: Occurrence, ctx: { personId: string | null; technical: boolean; today: string; designation: { logicalId: string; personId: string; schoolId: string; studentId: string; from: string; to: string | null } | null }) {
  const r: string[] = [], advise: string[] = [];
  if (ctx.technical || !ctx.personId) return { reasons: ["Ocorrência exige pessoa natural."], advise };
  const d = ctx.designation;
  if (!d || d.personId !== ctx.personId || d.logicalId !== o.designationId || d.schoolId !== o.schoolId || (o.studentId && o.studentId !== d.studentId) || o.date < d.from || (d.to && o.date > d.to)) r.push("Sem designação vigente para esta escola/estudante na data.");
  if (o.date > ctx.today) r.push("Data futura não é registrada.");
  if (!o.type.trim()) r.push("Informe o tipo.");
  if (!o.place.trim()) r.push("Informe o local.");
  if (o.fact.trim().length < 10) r.push("Descreva o fato observado.");
  if (o.fact.length > 1000 || o.actions.length > 1000) r.push("Texto com mais de 1000 caracteres.");
  if (!o.recipients.length) r.push("Escolha ao menos um destinatário.");
  if (o.recipients.some((x) => x.schoolId !== null && x.schoolId !== o.schoolId)) r.push("Destinatário de escola fora da designação.");
  for (const t of [o.fact, o.actions]) { if (CLINICAL.test(t)) r.push("Sem diagnóstico, CID ou termo clínico."); if (JUDGEMENT.test(t)) advise.push("Descreva o que foi visto e ouvido, sem julgamento ou suposição."); }
  if (o.authorPersonId !== ctx.personId) r.push("Autoria deve ser de quem registra.");
  return { reasons: [...new Set(r)], advise: [...new Set(advise)] };
}

const NEXT: Record<Act, Status[]> = { registrar: [], complementar: ["registrada", "recebida", "em-providencia", "encaminhada"], receber: ["registrada"],
  providenciar: ["recebida", "em-providencia"], encaminhar: ["recebida", "em-providencia"], concluir: ["recebida", "em-providencia", "encaminhada"] };
const TO: Partial<Record<Act, Status>> = { registrar: "registrada", receber: "recebida", providenciar: "em-providencia", encaminhar: "encaminhada", concluir: "concluida" };

export function status(ev: OccEvent[], id: string): Status | null {
  let s: Status | null = null;
  for (const e of ev.filter((x) => x.occurrenceId === id).sort((a, b) => a.seq - b.seq)) s = TO[e.act] ?? s;
  return s;
}

export function act(ev: OccEvent[], occ: Occurrence, a: { act: Act; expectedSeq: number; text: string; referral?: string; at: string },
  actor: { personId: string | null; technical: boolean; recipientOf: Recipient["kind"][] }) {
  if (actor.technical || !actor.personId) return { ok: false as const, reasons: ["Ato exige pessoa natural."] };
  const r: string[] = [];
  const head = Math.max(0, ...ev.filter((e) => e.occurrenceId === occ.id).map((e) => e.seq));
  if (a.expectedSeq !== head) r.push("A ocorrência mudou desde a leitura.");
  const st = status(ev, occ.id);
  const isAuthor = actor.personId === occ.authorPersonId;
  const isRecipient = occ.recipients.some((x) => actor.recipientOf.includes(x.kind));
  if (a.act === "registrar") { if (st !== null) r.push("Já registrada."); if (!isAuthor) r.push("Só o autor registra."); }
  else if (!NEXT[a.act].includes(st as Status)) r.push(`Ato "${a.act}" não cabe na situação "${st ?? "inexistente"}".`);
  if (a.act === "complementar" && !isAuthor) r.push("Só o autor complementa.");
  if (["receber", "providenciar", "encaminhar", "concluir"].includes(a.act) && !isRecipient) r.push("Só setor destinatário pratica este ato.");
  if (a.act !== "registrar" && a.act !== "receber" && a.text.trim().length < 5) r.push("Descreva o ato.");
  if (a.act === "encaminhar" && !a.referral?.trim()) r.push("Encaminhamento exige destino/serviço.");
  if (CLINICAL.test(a.text)) r.push("Sem diagnóstico, CID ou termo clínico.");
  if (r.length) return { ok: false as const, reasons: r };
  return { ok: true as const, event: { seq: head + 1, occurrenceId: occ.id, act: a.act, by: actor.personId, byRole: isAuthor && !isRecipient ? "autor" as const : "destinatario" as const,
    at: a.at, text: a.text.trim(), referral: a.referral?.trim() ?? null, idem: `occ:${occ.id}:${head}:${a.act}:${actor.personId}` } };
}
