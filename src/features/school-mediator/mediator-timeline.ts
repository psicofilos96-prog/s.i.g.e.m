/**
 * PERFIL MEDIADOR — LOTE 14 Linha do tempo e continuidade (núcleo puro).
 * Compõe referências aos registros canônicos (registro diário, observações,
 * estratégias acordadas, orientações, revisões) — nunca ledger paralelo.
 * Histórico preservado em troca de profissional/escola/turma; acesso minimizado:
 *  - autor vê sempre os próprios registros (autoria independe da designação vigente);
 *  - designação vigente vê do estudante apenas o "necessário à continuidade":
 *    orientações/estratégias vigentes e itens de continuidade dentro da janela
 *    declarada, sem autoria nominal de terceiros e sem texto livre de outra escola;
 *  - nada após o fim da designação de quem consulta.
 * Sem diagnóstico/prognóstico: nenhuma síntese, tendência ou rótulo.
 */
export type Kind = "apoio" | "barreira" | "estrategia" | "orientacao" | "revisao" | "participacao";
export interface Item { id: string; kind: Kind; studentId: string; schoolId: string; classId: string | null; activity: string | null; date: string; authorPersonId: string; text: string; activeUntil: string | null; continuity: boolean; source: string }
export interface Viewer { personId: string; designations: { studentId: string; schoolId: string; from: string; to: string | null }[] }

const CLINICAL = /\b(cid|laudo|diagn[oó]stic|progn[oó]stic|transtorno|psiqui|neurol|vai (piorar|melhorar)|tende a)/i;

export function visibleTimeline(items: Item[] | null, viewer: Viewer, studentId: string, f: { from: string; to: string; activity?: string; kinds?: Kind[] }, policy: { continuityWindowDays: number | null }) {
  if (items === null) return { state: "nao-disponivel" as const };
  const mine = viewer.designations.filter((d) => d.studentId === studentId);
  const current = mine.find((d) => d.from <= f.to && (!d.to || d.to >= f.to)) ?? null;
  const out: { id: string; kind: Kind; date: string; schoolChanged: boolean; classId: string | null; activity: string | null; text: string | null; author: "voce" | "outro-profissional"; source: string }[] = [];
  const windowStart = current && policy.continuityWindowDays != null ? shift(current.from, -policy.continuityWindowDays) : null;
  for (const it of items) {
    if (it.studentId !== studentId || it.date < f.from || it.date > f.to) continue;
    if (f.activity && it.activity?.toLowerCase() !== f.activity.toLowerCase()) continue;
    if (f.kinds && !f.kinds.includes(it.kind)) continue;
    const own = it.authorPersonId === viewer.personId;
    let allowed = own;
    if (!own && current) {
      const end = current.to ?? f.to;
      const inOwnPeriod = it.date >= current.from && it.date <= end && it.schoolId === current.schoolId;
      const stillActive = (it.kind === "orientacao" || it.kind === "estrategia") && (!it.activeUntil || it.activeUntil >= current.from) && it.date <= end;
      const continuity = it.continuity && windowStart !== null && it.date >= windowStart && it.date < current.from;
      allowed = inOwnPeriod || stillActive || continuity;
    }
    if (!allowed) continue;
    const otherSchool = current ? it.schoolId !== current.schoolId : false;
    const hideText = (!own && otherSchool) || CLINICAL.test(it.text);
    out.push({ id: it.id, kind: it.kind, date: it.date, schoolChanged: otherSchool, classId: it.classId, activity: it.activity,
      text: hideText ? null : it.text, author: own ? "voce" : "outro-profissional", source: it.source });
  }
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { state: "ok" as const, items: out, scope: current ? "designacao-vigente" as const : "somente-proprios" as const,
    notice: "Linha do tempo de registros; não descreve diagnóstico, prognóstico ou evolução." };
}

/** Passagem a nova designação: só o necessário (orientações/estratégias vigentes + itens marcados de continuidade). */
export function handoverPackage(items: Item[], studentId: string, newFrom: string, windowDays: number | null) {
  if (windowDays === null) return { ok: false as const, reason: "Janela de continuidade não configurada: nenhuma passagem automática." };
  const start = shift(newFrom, -windowDays);
  const pick = items.filter((i) => i.studentId === studentId && i.date < newFrom && (
    ((i.kind === "orientacao" || i.kind === "estrategia") && (!i.activeUntil || i.activeUntil >= newFrom)) || (i.continuity && i.date >= start)));
  return { ok: true as const, items: pick.map((i) => ({ id: i.id, kind: i.kind, date: i.date, text: CLINICAL.test(i.text) ? null : i.text, source: i.source })) };
}

function shift(d: string, days: number) { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + days); return t.toISOString().slice(0, 10); }
