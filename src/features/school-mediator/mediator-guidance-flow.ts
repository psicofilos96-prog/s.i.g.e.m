/**
 * PERFIL MEDIADOR — LOTE 07 Orientações versionadas (núcleo puro).
 * Fluxo: elaboração → validação (profissional competente ≠ autor) → publicação por
 * estudante × função → ciência do mediador → revisão (nova versão encadeada).
 * Ledger append-only com seq esperado e chave idempotente; estado é projeção.
 * Executor técnico nunca é autor, validador, publicador nem signatário.
 */
export type Act = "elaborar" | "validar" | "devolver" | "publicar" | "ciencia" | "revisar" | "retirar";
export interface Actor { personId: string | null; technical: boolean; capabilities: string[] }
export interface GuidanceEvent {
  seq: number; guidanceId: string; version: number; act: Act; by: string; at: string; reason: string | null;
  studentId: string; functionId: string; validFrom: string | null; validTo: string | null; resources: string[]; text: string | null; idem: string;
}
export const CAP = { elaborar: "elaborar-orientacao-mediacao", validar: "validar-orientacao-mediacao", publicar: "publicar-orientacao-mediacao" } as const;
export type State = "rascunho" | "validada" | "devolvida" | "publicada" | "retirada" | "substituida";

const CLINICAL = /\b(cid|laudo|diagn[oó]stic|f\d{2}(\.\d)?|transtorno|medica[cç]|psiqui|neurol)/i;

export function versionState(events: GuidanceEvent[], id: string, version: number): State | null {
  const ev = events.filter((e) => e.guidanceId === id && e.version === version && e.act !== "ciencia").sort((a, b) => a.seq - b.seq);
  if (!ev.length) return null;
  if (events.some((e) => e.guidanceId === id && e.version > version && e.act === "publicar")) return "substituida";
  const last = ev[ev.length - 1]!.act;
  return ({ elaborar: "rascunho", revisar: "rascunho", validar: "validada", devolver: "devolvida", publicar: "publicada", retirar: "retirada" } as const)[last as Exclude<Act, "ciencia">];
}

export interface Req { act: Act; guidanceId: string; version: number; expectedSeq: number; reason?: string; studentId: string; functionId: string;
  validFrom?: string; validTo?: string | null; resources?: string[]; text?: string; at: string }
export interface MediatorScope { designations: { studentId: string; functionId: string; from: string; to: string | null }[] }

export function decide(events: GuidanceEvent[], r: Req, actor: Actor, scope?: MediatorScope): { ok: true; event: GuidanceEvent } | { ok: false; reasons: string[] } {
  const x: string[] = [];
  if (actor.technical || !actor.personId) return { ok: false, reasons: ["Executor técnico não pode praticar ato em orientação: exige pessoa natural."] };
  const head = Math.max(0, ...events.map((e) => e.seq));
  if (r.expectedSeq !== head) x.push("A orientação mudou desde a leitura: releia antes de continuar.");
  const st = versionState(events, r.guidanceId, r.version);
  const author = events.find((e) => e.guidanceId === r.guidanceId && e.version === r.version && (e.act === "elaborar" || e.act === "revisar"))?.by;
  const need = (c: string) => { if (!actor.capabilities.includes(c)) x.push(`Falta a capacidade ${c}.`); };
  const why = () => { if (!r.reason || r.reason.trim().length < 5) x.push("Justificativa obrigatória."); };
  switch (r.act) {
    case "elaborar": case "revisar":
      need(CAP.elaborar); why();
      if (r.act === "elaborar" && st !== null) x.push("Versão já existe.");
      if (r.act === "revisar" && (st !== null || versionState(events, r.guidanceId, r.version - 1) !== "publicada")) x.push("Revisão só cria a próxima versão de orientação publicada.");
      if (!r.validFrom) x.push("Vigência inicial obrigatória.");
      if (r.validTo && r.validFrom && r.validTo < r.validFrom) x.push("Vigência final anterior à inicial.");
      if (!r.text?.trim()) x.push("Texto da orientação obrigatório.");
      if (r.text && CLINICAL.test(r.text)) x.push("Orientação à mediação sem diagnóstico, CID ou termo clínico.");
      break;
    case "validar": case "devolver":
      need(CAP.validar); if (r.act === "devolver") why();
      if (st !== "rascunho") x.push("Só rascunho pode ser validado ou devolvido.");
      if (author === actor.personId) x.push("Validação técnica exige profissional diferente do autor.");
      break;
    case "publicar": need(CAP.publicar); if (st !== "validada") x.push("Só orientação validada é publicada."); break;
    case "retirar": need(CAP.publicar); why(); if (st !== "publicada") x.push("Só orientação publicada é retirada."); break;
    case "ciencia": {
      if (st !== "publicada") x.push("Ciência só de orientação publicada vigente.");
      const ok = scope?.designations.some((d) => d.studentId === r.studentId && d.functionId === r.functionId && d.from <= r.at.slice(0, 10) && (!d.to || r.at.slice(0, 10) <= d.to));
      if (!ok) x.push("Sem designação vigente para este estudante nesta função.");
      if (events.some((e) => e.act === "ciencia" && e.guidanceId === r.guidanceId && e.version === r.version && e.by === actor.personId)) x.push("Ciência já registrada.");
      break;
    }
  }
  const base = events.find((e) => e.guidanceId === r.guidanceId && e.version === r.version);
  if (base && (base.studentId !== r.studentId || base.functionId !== r.functionId)) x.push("Estudante/função não correspondem à orientação.");
  if (x.length) return { ok: false, reasons: x };
  const carry = r.act === "elaborar" || r.act === "revisar";
  return { ok: true, event: { seq: head + 1, guidanceId: r.guidanceId, version: r.version, act: r.act, by: actor.personId, at: r.at, reason: r.reason?.trim() ?? null,
    studentId: r.studentId, functionId: r.functionId, validFrom: carry ? r.validFrom! : base!.validFrom, validTo: carry ? (r.validTo ?? null) : base!.validTo,
    resources: carry ? (r.resources ?? []) : base!.resources, text: carry ? r.text!.trim() : null, idem: `${r.guidanceId}:${r.version}:${r.act}:${actor.personId}:${head}` } };
}

/** Visão contextual do mediador + alertas de mudança (publicada não-ciente; substituída/retirada após ciência). */
export function mediatorInbox(events: GuidanceEvent[], personId: string, scope: MediatorScope, date: string) {
  const ids = [...new Set(events.map((e) => e.guidanceId))];
  const items: { guidanceId: string; version: number; studentId: string; text: string | null; resources: string[]; validFrom: string | null; validTo: string | null; author: string; validatedBy: string | null; acknowledged: boolean }[] = [];
  const alerts: { guidanceId: string; kind: "nova" | "alterada" | "retirada" }[] = [];
  for (const id of ids) {
    const versions = [...new Set(events.filter((e) => e.guidanceId === id).map((e) => e.version))].sort((a, b) => b - a);
    const any = events.find((e) => e.guidanceId === id)!;
    if (!scope.designations.some((d) => d.studentId === any.studentId && d.functionId === any.functionId && d.from <= date && (!d.to || date <= d.to))) continue;
    const acked = (v: number) => events.some((e) => e.act === "ciencia" && e.guidanceId === id && e.version === v && e.by === personId);
    const pub = versions.find((v) => versionState(events, id, v) === "publicada");
    const everAcked = versions.some(acked);
    if (pub === undefined) { if (everAcked && versions.some((v) => versionState(events, id, v) === "retirada")) alerts.push({ guidanceId: id, kind: "retirada" }); continue; }
    const head = events.find((e) => e.guidanceId === id && e.version === pub && (e.act === "elaborar" || e.act === "revisar"))!;
    if (head.validFrom && head.validFrom > date || head.validTo && date > head.validTo) continue;
    items.push({ guidanceId: id, version: pub, studentId: head.studentId, text: head.text, resources: head.resources, validFrom: head.validFrom, validTo: head.validTo,
      author: head.by, validatedBy: events.find((e) => e.guidanceId === id && e.version === pub && e.act === "validar")?.by ?? null, acknowledged: acked(pub) });
    if (!acked(pub)) alerts.push({ guidanceId: id, kind: everAcked ? "alterada" : "nova" });
  }
  return { items, alerts };
}
