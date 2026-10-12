/**
 * OP por escola — LOTE 05 (ficha de acompanhamento docente).
 * Ficha = ledger append-only por logicalId: abertura → devolutiva/providência/retificação/anulação/encerramento.
 * Caráter FORMATIVO: nenhuma saída é avaliação funcional, sanção ou nota de desempenho.
 * Autorização reaproveita decideOpAccess (Lote 02); a garantia continua no banco.
 */
import { decideOpAccess, type OpAccessRequest } from "./op-designations";

export const FOLLOWUP_TYPES = ["planejamento", "curriculo", "aula", "metodologia", "resultados", "intervencao", "individual", "coletivo"] as const;
export type FollowupType = (typeof FOLLOWUP_TYPES)[number];

/** Termos que transformariam observação formativa em avaliação/sanção — bloqueados no conteúdo e nos efeitos. */
const PUNITIVE = /\b(advert[êe]ncia|suspens[ãa]o|san[çc][ãa]o|puni[çc][ãa]o|processo administrativo|sindic[âa]ncia|nota de desempenho|avalia[çc][ãa]o funcional|est[áa]gio probat[óo]rio|exonera)/i;

export interface FollowupOpen {
  kind: "abrir"; type: FollowupType; teacherPersonIds: string[]; schoolId: string;
  classId: string | null; componentId: string | null; date: string; objective: string;
  aspects: string[]; guidance: string; actions: { text: string; dueDate: string | null }[];
}
export type FollowupEventBody =
  | FollowupOpen
  | { kind: "devolutiva"; text: string; byTeacher: boolean }
  | { kind: "providencia-concluida"; actionIndex: number; note: string }
  | { kind: "retificar"; reason: string; patch: Partial<Pick<FollowupOpen, "objective" | "aspects" | "guidance" | "actions">> }
  | { kind: "anular"; reason: string }
  | { kind: "encerrar"; reason: string };

export interface FollowupEvent {
  id: string; logicalId: string; seq: number; at: string; authorPersonId: string; idempotencyKey: string; body: FollowupEventBody;
}

export interface FollowupSheet {
  logicalId: string; type: FollowupType; teacherPersonIds: string[]; schoolId: string; classId: string | null;
  componentId: string | null; date: string; objective: string; aspects: string[]; guidance: string;
  actions: { text: string; dueDate: string | null; doneAt: string | null }[];
  feedback: { at: string; authorPersonId: string; text: string; byTeacher: boolean }[];
  state: "aberta" | "encerrada" | "anulada"; openedBy: string; history: FollowupEvent[];
  /** sempre false: ficha não produz efeito funcional/disciplinar */
  functionalEffect: false;
}

export function validateOpen(b: FollowupOpen): string[] {
  const e: string[] = [];
  if (!(FOLLOWUP_TYPES as readonly string[]).includes(b.type)) e.push("Tipo de acompanhamento não reconhecido.");
  if (b.teacherPersonIds.length === 0) e.push("Informe o(s) professor(es) acompanhado(s).");
  if (b.type === "individual" && b.teacherPersonIds.length !== 1) e.push("Acompanhamento individual tem exatamente um professor.");
  if (b.type === "coletivo" && b.teacherPersonIds.length < 2) e.push("Acompanhamento coletivo exige ao menos dois professores.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date)) e.push("Data inválida.");
  if (!b.objective.trim()) e.push("Objetivo é obrigatório.");
  if (!b.guidance.trim()) e.push("Orientação é obrigatória.");
  if (b.type === "aula" && !b.classId) e.push("Acompanhamento de aula exige turma.");
  for (const a of b.actions) if (a.dueDate && a.dueDate < b.date) e.push("Prazo da providência anterior à data da ficha.");
  const text = [b.objective, b.guidance, ...b.aspects, ...b.actions.map((a) => a.text)].join(" ");
  if (PUNITIVE.test(text)) e.push("Ficha formativa não registra avaliação funcional nem sanção disciplinar.");
  return e;
}

/** Projeção: cadeia inválida é recusada inteira (seq contínuo, autoria, temporalidade, estado terminal). */
export function projectFollowups(events: FollowupEvent[]): { list: FollowupSheet[]; rejected: { logicalId: string; reason: string }[] } {
  const by = new Map<string, FollowupEvent[]>();
  const seenKeys = new Set<string>();
  for (const e of events) {
    if (seenKeys.has(e.idempotencyKey)) continue; // reenvio idempotente
    seenKeys.add(e.idempotencyKey);
    by.set(e.logicalId, [...(by.get(e.logicalId) ?? []), e]);
  }
  const list: FollowupSheet[] = []; const rejected: { logicalId: string; reason: string }[] = [];
  outer: for (const [lid, ch] of by) {
    const s = [...ch].sort((a, b) => a.seq - b.seq);
    const bad = (reason: string) => rejected.push({ logicalId: lid, reason });
    if (!s.every((e, i) => e.seq === i + 1)) { bad("Sequência descontínua."); continue; }
    const head = s[0]!;
    if (head.body.kind !== "abrir") { bad("Cadeia não começa por abertura."); continue; }
    const o = head.body;
    const errs = validateOpen(o);
    if (errs.length) { bad(errs.join(" ")); continue; }
    if (o.teacherPersonIds.includes(head.authorPersonId)) { bad("Orientador não abre ficha sobre si mesmo."); continue; }
    const sh: FollowupSheet = {
      logicalId: lid, type: o.type, teacherPersonIds: o.teacherPersonIds, schoolId: o.schoolId, classId: o.classId,
      componentId: o.componentId, date: o.date, objective: o.objective, aspects: o.aspects, guidance: o.guidance,
      actions: o.actions.map((a) => ({ ...a, doneAt: null })), feedback: [], state: "aberta",
      openedBy: head.authorPersonId, history: s, functionalEffect: false,
    };
    for (const e of s.slice(1)) {
      if (e.at < s[e.seq - 2]!.at) { bad("Evento anterior ao predecessor."); continue outer; }
      if (sh.state !== "aberta") { bad("Evento após estado terminal."); continue outer; }
      const b = e.body;
      switch (b.kind) {
        case "abrir": bad("Abertura duplicada."); continue outer;
        case "devolutiva": {
          const isTeacher = sh.teacherPersonIds.includes(e.authorPersonId);
          if (b.byTeacher !== isTeacher) { bad("Autoria da devolutiva inconsistente."); continue outer; }
          if (!b.text.trim() || PUNITIVE.test(b.text)) { bad("Devolutiva vazia ou com conteúdo funcional/disciplinar."); continue outer; }
          sh.feedback.push({ at: e.at, authorPersonId: e.authorPersonId, text: b.text, byTeacher: b.byTeacher }); break;
        }
        case "providencia-concluida": {
          const a = sh.actions[b.actionIndex];
          if (!a || a.doneAt) { bad("Providência inexistente ou já concluída."); continue outer; }
          a.doneAt = e.at; break;
        }
        case "retificar": {
          if (e.authorPersonId !== sh.openedBy || !b.reason.trim()) { bad("Retificação só pelo autor, com motivo."); continue outer; }
          const next = { ...o, ...b.patch } as FollowupOpen;
          const er = validateOpen(next); if (er.length) { bad(er.join(" ")); continue outer; }
          if (b.patch.objective !== undefined) sh.objective = b.patch.objective;
          if (b.patch.aspects) sh.aspects = b.patch.aspects;
          if (b.patch.guidance !== undefined) sh.guidance = b.patch.guidance;
          if (b.patch.actions) sh.actions = b.patch.actions.map((a) => ({ ...a, doneAt: null }));
          break;
        }
        case "anular": case "encerrar":
          if (e.authorPersonId !== sh.openedBy || !b.reason.trim()) { bad("Anulação/encerramento só pelo autor, com motivo."); continue outer; }
          sh.state = b.kind === "anular" ? "anulada" : "encerrada"; break;
      }
    }
    list.push(sh);
  }
  return { list, rejected };
}

/** Situação das providências na data: prazo só se registrado; ausente nunca vira "atrasado". */
export function actionStatus(sh: FollowupSheet, today: string) {
  return sh.actions.map((a) => ({
    text: a.text,
    status: a.doneAt ? "concluida" : a.dueDate === null ? "sem prazo registrado" : a.dueDate < today ? "prazo vencido" : "no prazo",
  }));
}

/** Devolutiva pendente = derivada (sem devolutiva do professor), nunca campo persistido. */
export const awaitingTeacherFeedback = (sh: FollowupSheet) => sh.state === "aberta" && !sh.feedback.some((f) => f.byTeacher);

/** Plano de gravação do executor: autorizado por designação×capacidade, idempotente, fail-closed. */
export function planFollowupWrite(input: {
  access: Omit<OpAccessRequest, "action" | "granularity">; existing: FollowupEvent[]; event: FollowupEvent;
}): { ok: true; duplicate: boolean; event: FollowupEvent } | { ok: false; reason: string } {
  const { access, existing, event } = input;
  if (event.authorPersonId !== access.personId) return { ok: false, reason: "Autoria deve ser da pessoa da sessão." };
  if (existing.some((e) => e.idempotencyKey === event.idempotencyKey)) return { ok: true, duplicate: true, event };
  const chain = existing.filter((e) => e.logicalId === event.logicalId);
  const isTeacherFeedback = event.body.kind === "devolutiva" && event.body.byTeacher;
  if (!isTeacherFeedback) {
    const d = decideOpAccess({ ...access, action: "registrar", granularity: "individual" });
    if (!d.ok) return { ok: false, reason: d.reason };
  }
  if (event.seq !== chain.length + 1) return { ok: false, reason: "Base esperada divergente: recarregue a ficha." };
  const { list, rejected } = projectFollowups([...existing, event]);
  const r = rejected.find((x) => x.logicalId === event.logicalId);
  if (r) return { ok: false, reason: r.reason };
  const sh = list.find((x) => x.logicalId === event.logicalId)!;
  if (sh.schoolId !== access.schoolId) return { ok: false, reason: "Ficha de outra escola." };
  if (isTeacherFeedback && !sh.teacherPersonIds.includes(access.personId)) return { ok: false, reason: "Só o professor acompanhado responde." };
  return { ok: true, duplicate: false, event };
}

/** Visão do professor: vê só fichas em que é sujeito; nunca as de colegas (coletivo mostra só a própria inclusão). */
export function teacherView(list: FollowupSheet[], personId: string) {
  return list.filter((s) => s.state !== "anulada" && s.teacherPersonIds.includes(personId))
    .map((s) => ({ ...s, teacherPersonIds: [personId], history: [] as FollowupEvent[] }));
}

/** Central: só contagem por tipo/escola com supressão 1–4; nunca conteúdo nem nomes. */
export function centralFollowupCounts(list: FollowupSheet[]) {
  const c: Record<string, number> = {};
  for (const s of list) if (s.state !== "anulada") c[`${s.schoolId}:${s.type}`] = (c[`${s.schoolId}:${s.type}`] ?? 0) + 1;
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v < 5 ? "suprimido" : v]));
}
