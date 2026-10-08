/**
 * Departamento Pessoal — projeção pura da vida funcional por escola, data de validade (validOn) e knownAt.
 * pessoa ≠ vínculo (cargo) ≠ lotação ≠ exercício (função exercida) ≠ atuação SIGEM (autorização) ≠ evento ≠ processo ≠ habilitação.
 * Nada aqui concede capacidade: atuação aparece só como fato lido de institutional_engagements.
 * Fora do escopo: folha, previdência, consignação e pagamento.
 */
import { currentVersions } from "@/features/student-life/institutional-enrollment";

type Versioned = { id: string; supersedes_id: string | null; recorded_at: string };
export type Link = Versioned & { logical_id: string; version: number; person_id: string; functional_registration: string | null; link_nature_id: string; position_id: string | null; valid_from: string | null; valid_until: string | null };
export type Posting = Versioned & { logical_id: string; version: number; functional_link_logical_id: string; school_id: string; functional_status_id: string | null; valid_from: string | null; valid_until: string | null };
export type Exercise = Versioned & { logical_id: string; version: number; functional_link_logical_id: string; posting_logical_id: string | null; school_id: string; function_id: string; valid_from: string; valid_until: string | null; revoked: boolean };
export type Qualification = Versioned & { logical_id: string; version: number; person_id: string; school_id: string; qualification_id: string; valid_from: string | null; valid_until: string | null; revoked: boolean };
export type FunctionalEvent = Versioned & { logical_id: string; version: number; functional_link_logical_id: string; school_id: string; event_kind_id: string; occurred_on: string | null };
export type FunctionalProcess = Versioned & { logical_id: string; version: number; functional_link_logical_id: string; school_id: string; process_kind_id: string; opened_on: string; closed_on: string | null; revoked: boolean };
export type Engagement = { id: string; person_id: string; engagement_kind_id: string; school_id: string | null; scope_level: string | null; valid_from: string; valid_until: string | null; created_at: string };

export type EngagementEnding = { engagement_id: string; ended_on: string; created_at: string };
/** engagementEndings null = encerramentos não legíveis: atuação não pode ser afirmada como vigente. */
export type Sources = { links: Link[]; postings: Posting[]; exercises: Exercise[]; qualifications: Qualification[]; events: FunctionalEvent[]; processes: FunctionalProcess[]; engagements: Engagement[]; engagementEndings?: EngagementEnding[] | null };

/** Cabeças conhecidas até knownAt: o que o SIGEM sabia naquele instante. */
export function headsKnownAt<T extends Versioned>(rows: readonly T[], knownAt: string | null): T[] {
  return currentVersions(knownAt ? rows.filter((r) => r.recorded_at <= knownAt) : rows);
}
type Validity = "vigente" | "fora-da-vigencia" | "inicio-nao-informado";
export const validity = (from: string | null, until: string | null, on: string): Validity =>
  !from ? "inicio-nao-informado" : from <= on && (until == null || until >= on) ? "vigente" : "fora-da-vigencia";

export type PersonPicture = {
  personId: string;
  links: { link: Link; validity: Validity; postings: { posting: Posting; validity: Validity }[]; exercises: Exercise[]; events: FunctionalEvent[]; processes: FunctionalProcess[] }[];
  qualifications: Qualification[];
  /** Atuações SIGEM vigentes nesta escola (ou de rede). Independentes de cargo, lotação e habilitação. */
  engagements: Engagement[];
  /** Exercício vigente sem lotação vigente do mesmo vínculo na escola: não é erro presumido, é divergência a ver. */
  exerciseWithoutPosting: string[];
};

export function functionalPicture(src: Sources, schoolId: string, on: string, knownAt: string | null): PersonPicture[] {
  const postings = headsKnownAt(src.postings, knownAt).filter((p) => p.school_id === schoolId);
  const linkIds = new Set(postings.map((p) => p.functional_link_logical_id));
  const links = headsKnownAt(src.links, knownAt).filter((l) => linkIds.has(l.logical_id));
  const exercises = headsKnownAt(src.exercises, knownAt).filter((e) => e.school_id === schoolId && !e.revoked && validity(e.valid_from, e.valid_until, on) === "vigente");
  const events = headsKnownAt(src.events, knownAt).filter((e) => e.school_id === schoolId);
  const processes = headsKnownAt(src.processes, knownAt).filter((p) => p.school_id === schoolId && !p.revoked);
  const quals = headsKnownAt(src.qualifications, knownAt).filter((q) => q.school_id === schoolId && !q.revoked && validity(q.valid_from, q.valid_until, on) !== "fora-da-vigencia");
  // NPROF.1: encerramento de atuação é fato próprio (engagement_endings); conhecido até knownAt e com fim até a data, a atuação deixa de ser vigente.
  const endings = src.engagementEndings ?? [];
  const endedBy = (id: string) => endings.some((x) => x.engagement_id === id && x.ended_on <= on && (!knownAt || x.created_at <= knownAt));
  const engagements = src.engagementEndings === null ? [] : src.engagements.filter((e) => (!knownAt || e.created_at <= knownAt) && validity(e.valid_from, e.valid_until, on) === "vigente" && !endedBy(e.id) && (e.school_id === schoolId || e.scope_level === "rede"));
  const persons = [...new Set(links.map((l) => l.person_id))].sort();
  return persons.map((personId) => {
    const mine = links.filter((l) => l.person_id === personId).sort((a, b) => (a.valid_from ?? "").localeCompare(b.valid_from ?? ""));
    const rows = mine.map((link) => {
      const ps = postings.filter((p) => p.functional_link_logical_id === link.logical_id).map((posting) => ({ posting, validity: validity(posting.valid_from, posting.valid_until, on) }));
      return {
        link, validity: validity(link.valid_from, link.valid_until, on), postings: ps,
        exercises: exercises.filter((e) => e.functional_link_logical_id === link.logical_id),
        events: events.filter((e) => e.functional_link_logical_id === link.logical_id).sort((a, b) => (a.occurred_on ?? "").localeCompare(b.occurred_on ?? "")),
        processes: processes.filter((p) => p.functional_link_logical_id === link.logical_id),
      };
    });
    return {
      personId, links: rows,
      qualifications: quals.filter((q) => q.person_id === personId),
      engagements: engagements.filter((e) => e.person_id === personId),
      exerciseWithoutPosting: rows.flatMap((r) => r.exercises.length && !r.postings.some((p) => p.validity === "vigente") ? [r.link.logical_id] : []),
    };
  });
}

export const VALIDITY_LABEL: Record<Validity, string> = { vigente: "Vigente", "fora-da-vigencia": "Fora da vigência", "inicio-nao-informado": "Início não informado" };

export function functionalMessage(raw: string): string {
  if (raw.includes("base-superseded") || raw.includes("Versão base superada")) return "O registro foi alterado por outra pessoa. Recarregue e tente de novo.";
  if (raw.includes("reason-required") || raw.includes("exige motivo")) return "A correção precisa de motivo.";
  if (raw.includes("não homologado")) return "O valor escolhido não está homologado no catálogo.";
  if (raw.includes("person-not-posted-in-school")) return "A pessoa não tem lotação registrada nesta escola.";
  if (raw.includes("manter-registro-funcional") || raw.includes("capability")) return "Sua atuação não tem permissão vigente para manter o registro funcional desta escola.";
  return "Não foi possível concluir. Tente de novo.";
}

/** N11.2.2 — linha do tempo funcional: fatos datados do quadro, em ordem; sem data ⇒ ao final, nunca data inventada. */
export type TimelineEntry = { date: string | null; kind: "vinculo" | "lotacao" | "exercicio" | "evento" | "processo"; label: string };
export function functionalTimeline(p: PersonPicture): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  for (const l of p.links) {
    out.push({ date: l.link.valid_from, kind: "vinculo", label: `Início do vínculo${l.link.functional_registration ? ` ${l.link.functional_registration}` : ""}` });
    if (l.link.valid_until) out.push({ date: l.link.valid_until, kind: "vinculo", label: "Fim do vínculo" });
    for (const x of l.postings) out.push({ date: x.posting.valid_from, kind: "lotacao", label: "Início da lotação na escola" });
    for (const e of l.exercises) out.push({ date: e.valid_from, kind: "exercicio", label: `Exercício: ${e.function_id}` });
    for (const e of l.events) out.push({ date: e.occurred_on, kind: "evento", label: `Evento: ${e.event_kind_id}` });
    for (const x of l.processes) {
      out.push({ date: x.opened_on, kind: "processo", label: `Processo aberto: ${x.process_kind_id}` });
      if (x.closed_on) out.push({ date: x.closed_on, kind: "processo", label: `Processo encerrado: ${x.process_kind_id}` });
    }
  }
  return out.sort((a, b) => (a.date == null ? 1 : b.date == null ? -1 : a.date.localeCompare(b.date)));
}
