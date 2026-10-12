/**
 * L11 Permanência — visitas e atendimentos (migration 0399).
 * Cadeia append-only por visita: planejada → realizada | não realizada | cancelada.
 * Visita só é planejada com segurança conferida; só o próprio profissional registra a
 * realização (capacidade `realizar-visitas-do-caso`/`realizar-atendimentos-do-caso`);
 * realização exige data não futura e decisão explícita sobre retorno. Endereço, CPF,
 * telefone, laudo/CID nunca são campos e são recusados no texto. RLS: leitura só com
 * `ler-visitas-do-caso` ou para o próprio profissional/acompanhante.
 * Móvel: visão compacta sem dado privado; rascunho só em memória (sem cache/offline).
 */
export type VisitKind = "visita" | "atendimento";
export type VisitStatus = "planejada" | "realizada" | "nao-realizada" | "cancelada";
export interface VisitRow { visitRef: string; seq: number; caseId: string; kind: VisitKind; status: VisitStatus; objective: string; scheduledOn: string; occurredOn: string | null;
  professionalPerson: string; companionPerson: string | null; safetyChecked: boolean; safetyNote: string | null; providences: string | null;
  returnNeeded: boolean | null; returnOn: string | null; justification: string | null }

const PRIVATE = /(endere[cç]o|\brua\b|\bcpf\b|telefone|laudo|\bcid\b)/i;

export function validateVisitStep(prev: VisitRow | null, d: Omit<VisitRow, "visitRef" | "seq">, session: { person: string; caps: ReadonlySet<string> }, today: string): string | null {
  if (!session.caps.has("planejar-visitas-do-caso")) return "Sem capacidade para planejar visitas.";
  if (d.objective.trim().length < 10) return "Descreva o objetivo.";
  if ([d.safetyNote, d.providences].some((t) => t && PRIVATE.test(t))) return "Não registre endereço, documentos ou dado clínico.";
  if (d.companionPerson && d.companionPerson === d.professionalPerson) return "Acompanhante deve ser outra pessoa.";
  if (!prev) {
    if (d.status !== "planejada") return "Comece planejando.";
    if (d.kind === "visita" && !d.safetyChecked) return "Confira as condições de segurança antes de planejar a visita.";
    return null;
  }
  if (prev.status !== "planejada") return "Visita já encerrada.";
  if (prev.caseId !== d.caseId || prev.kind !== d.kind) return "Caso ou tipo não podem mudar.";
  if (d.status === "realizada" || d.status === "nao-realizada") {
    if (d.professionalPerson !== session.person) return "Só o profissional responsável registra a realização.";
    if (!session.caps.has(`realizar-${d.kind}s-do-caso`)) return "Profissional sem competência para este registro.";
  }
  if (d.status === "realizada") {
    if (!d.occurredOn || d.occurredOn > today) return "Data de realização ausente ou futura.";
    if (d.returnNeeded === null) return "Informe se há necessidade de retorno.";
  }
  if (d.returnOn && !d.returnNeeded) return "Data de retorno só com retorno necessário.";
  if ((d.status === "nao-realizada" || d.status === "cancelada") && (d.justification ?? "").trim().length < 10) return "Justifique.";
  return null;
}

export interface VisitView { visitRef: string; current: VisitRow; history: VisitRow[]; overdue: boolean; returnPending: boolean }
export function projectVisits(rows: readonly VisitRow[], today: string): VisitView[] {
  const g = new Map<string, VisitRow[]>();
  for (const r of rows) g.set(r.visitRef, [...(g.get(r.visitRef) ?? []), r]);
  return [...g.entries()].map(([visitRef, xs]) => {
    const h = [...xs].sort((a, b) => a.seq - b.seq);
    if (h.some((r, i) => r.seq !== i + 1)) throw new Error("visits:broken-chain");
    const cur = h.at(-1)!;
    return { visitRef, current: cur, history: h, overdue: cur.status === "planejada" && cur.scheduledOn < today,
      returnPending: cur.status === "realizada" && cur.returnNeeded === true };
  }).sort((a, b) => a.current.scheduledOn.localeCompare(b.current.scheduledOn) || a.visitRef.localeCompare(b.visitRef));
}

/** Cartão móvel: só o necessário para executar a agenda; sem nota de segurança nem providências. */
export function mobileAgenda(vs: readonly VisitView[], person: string, today: string) {
  return vs.filter((v) => v.current.status === "planejada" && (v.current.professionalPerson === person || v.current.companionPerson === person))
    .map((v) => ({ visitRef: v.visitRef, caseId: v.current.caseId, kind: v.current.kind, scheduledOn: v.current.scheduledOn,
      objective: v.current.objective.slice(0, 120), withCompanion: v.current.companionPerson !== null, today: v.current.scheduledOn === today, overdue: v.overdue }));
}
