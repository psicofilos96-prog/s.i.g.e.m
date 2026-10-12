/**
 * OP por escola — LOTE 13 (educação inclusiva).
 * A OP não tem cadastro inclusivo próprio: lê orientações do NEI liberadas (`inclusion_records_at` /
 * `inclusion_teaching_support_flags`), estratégias e observações do Mediador partilhadas
 * (school-mediator L07/L10/L12) e adaptações do professor (Docente L14), sempre por allowlist.
 * Reuniões, solicitações e providências usam os canais existentes (protocolo NEI, solicitação da escola).
 * A orientação articula; não substitui AEE, NEI, professor nem profissional clínico.
 */
import { decideOpAccess, type OpAccessRequest } from "./op-designations";

export type InclusionSource = "nei-orientacao" | "mediador-estrategia" | "mediador-observacao" | "docente-adaptacao" | "acessibilidade";
export interface InclusionItem {
  id: string; source: InclusionSource; studentId: string; classId: string; schoolId: string;
  /** só itens marcados para partilha com a OP pela fonte dona */
  sharedWithOp: boolean; validFrom: string; validTo: string | null; text: string;
  /** campos que jamais podem chegar à OP */
  clinical?: unknown; cid?: unknown; reportFile?: unknown; authorName?: unknown;
  confirmedByCompetent: boolean; // estratégia do mediador só vale confirmada (L12)
}

const CLINICAL = /\b(CID|F\d{2}|laudo|TDAH|TEA|autis|transtorno|s[íi]ndrome|medica[çc]|diagn[óo]stic|progn[óo]stic|defici[êe]ncia intelectual|psiqui|neurol)/i;

export interface OpInclusionView { id: string; source: InclusionSource; text: string; validTo: string | null; retained: boolean }

/** Projeção mínima: allowlist de campos, só partilhado, vigente na data e da própria escola; texto clínico retido. */
export function projectInclusionForOp(items: InclusionItem[], ctx: { schoolId: string; studentId: string; date: string }): OpInclusionView[] {
  return items
    .filter((i) => i.schoolId === ctx.schoolId && i.studentId === ctx.studentId && i.sharedWithOp
      && i.validFrom <= ctx.date && (i.validTo === null || ctx.date <= i.validTo)
      && (i.source !== "mediador-estrategia" || i.confirmedByCompetent))
    .map((i) => {
      const retained = CLINICAL.test(i.text);
      return { id: i.id, source: i.source, text: retained ? "Conteúdo restrito ao NEI." : i.text, validTo: i.validTo, retained };
    });
}

/** Acesso contextual: designação × capacidade × finalidade; central nunca vê individual inclusivo. */
export function opInclusionAccess(a: Omit<OpAccessRequest, "action" | "granularity">): { ok: boolean; reason: string } {
  if (a.purpose !== "intervencao" && a.purpose !== "acompanhamento") return { ok: false, reason: "Finalidade não admite leitura inclusiva." };
  const r = decideOpAccess({ ...a, action: "consultar", granularity: "individual" });
  if (r.ok && r.via === "coordenacao-central-op") return { ok: false, reason: "Coordenação central não lê dado inclusivo individual." };
  return r.ok ? { ok: true, reason: "" } : { ok: false, reason: r.reason };
}

/** O que a OP pode registrar: só articulação; nunca plano especializado, AEE, laudo ou decisão docente. */
export type OpInclusionAct = "reuniao" | "solicitacao-ao-nei" | "providencia-escolar" | "orientar-professor" | "editar-pei" | "editar-paee" | "registrar-aee" | "definir-adaptacao-pelo-professor" | "registrar-diagnostico";
const OWNER: Partial<Record<OpInclusionAct, string>> = {
  "editar-pei": "NEI", "editar-paee": "AEE", "registrar-aee": "AEE", "definir-adaptacao-pelo-professor": "professor", "registrar-diagnostico": "profissional clínico",
};
export function opInclusionAct(kind: OpInclusionAct, text: string): { ok: true; channel: "protocolo-nei" | "solicitacao-escola" | "reuniao" } | { ok: false; reason: string } {
  const owner = OWNER[kind];
  if (owner) return { ok: false, reason: `A orientação articula; isto é atribuição de ${owner}.` };
  if (CLINICAL.test(text)) return { ok: false, reason: "Texto com conteúdo clínico não circula pela orientação; registre só a necessidade pedagógica." };
  if (!text.trim()) return { ok: false, reason: "Descreva o assunto." };
  return { ok: true, channel: kind === "solicitacao-ao-nei" ? "protocolo-nei" : kind === "reuniao" ? "reuniao" : "solicitacao-escola" };
}

export interface Meeting { id: string; on: string; participants: { personId: string; role: "orientacao" | "professor" | "nei" | "aee" | "mediador" | "direcao" | "familia" }[]; agenda: string; studentRefs: string[] }
/** Reunião: família só com autorização vigente; pauta sem clínico; estudante por referência. */
export function validateMeeting(m: Meeting, ctx: { familyAuthorized: boolean }): string[] {
  const e: string[] = [];
  if (m.participants.length < 2) e.push("Reunião exige ao menos dois participantes.");
  if (m.participants.some((p) => p.role === "familia") && !ctx.familyAuthorized) e.push("Família só com autorização vigente.");
  if (CLINICAL.test(m.agenda)) e.push("Pauta não registra conteúdo clínico.");
  return e;
}

/** Providência: só concluída pelo setor dono, com referência ao registro dele. */
export function concludeProvidence(p: { ownerSector: string; actorSector: string; ownerRecordRef: string | null }): { ok: boolean; reason: string } {
  if (p.actorSector !== p.ownerSector) return { ok: false, reason: "Só o setor responsável conclui a providência." };
  if (!p.ownerRecordRef) return { ok: false, reason: "Conclusão exige referência ao registro do setor." };
  return { ok: true, reason: "" };
}

/** Central: nada inclusivo individual; só contagens de articulações por escola com supressão. */
export function centralInclusion(counts: { meetings: number; requests: number }) {
  const s = (n: number) => (n > 0 && n < 5 ? "suprimido" : n);
  return { meetings: s(counts.meetings), requests: s(counts.requests) };
}
