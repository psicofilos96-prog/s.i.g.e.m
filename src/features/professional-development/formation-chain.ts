/**
 * SIGEM Desenvolvimento L02 — projeções puras da cadeia gravada pela migration 0431.
 * Banco é a garantia (writers DEFINER); aqui só se lê: versão utilizável, situação da inscrição,
 * vagas e mapeamento de erros. Estado nunca é gravado: deriva dos eventos.
 */
export type Approval = Readonly<{ subject: "plano" | "curso"; versionId: string; decision: "aprovada" | "recusada" }>;
export type VersionRef = Readonly<{ id: string; parentId: string; version: number; authorPerson: string }>;
export type ParticipationKind = "confirmacao" | "espera" | "desistencia" | "cancelamento" | "conclusao" | "nao-conclusao";
export type ParticipationEvent = Readonly<{ seq: number; kind: ParticipationKind; attendancePct: number | null }>;
export type EnrollmentStatus = "inscrita" | "confirmada" | "em-espera" | "desistente" | "cancelada" | "concluida" | "nao-concluida" | "cadeia-invalida";

export const TERMINAL: readonly ParticipationKind[] = ["desistencia", "cancelamento", "conclusao", "nao-conclusao"];

/** Utilizável = última versão do pai e aprovada (espelha `dev_version_usable`). */
export function usableVersion(subject: Approval["subject"], versions: readonly VersionRef[], approvals: readonly Approval[], parentId: string): VersionRef | null {
  const mine = versions.filter((v) => v.parentId === parentId);
  if (mine.length === 0) return null;
  const last = mine.reduce((a, b) => (b.version > a.version ? b : a));
  return approvals.some((a) => a.subject === subject && a.versionId === last.id && a.decision === "aprovada") ? last : null;
}

/** Situação = projeção dos eventos; seq com lacuna ou evento após terminal ⇒ cadeia inválida. */
export function enrollmentStatus(events: readonly ParticipationEvent[]): EnrollmentStatus {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i]!.seq !== i + 1) return "cadeia-invalida";
    if (i < sorted.length - 1 && TERMINAL.includes(sorted[i]!.kind)) return "cadeia-invalida";
  }
  const last = sorted.at(-1);
  if (!last) return "inscrita";
  const map: Record<ParticipationKind, EnrollmentStatus> = {
    confirmacao: "confirmada", espera: "em-espera", desistencia: "desistente", cancelamento: "cancelada", conclusao: "concluida", "nao-conclusao": "nao-concluida",
  };
  return map[last.kind];
}

/** Vagas: sem número configurado ⇒ null (nunca "ilimitado"). */
export function seatsLeft(seats: number | null, enrollments: readonly { events: readonly ParticipationEvent[] }[]): number | null {
  if (seats == null) return null;
  const taken = enrollments.filter((e) => !e.events.some((x) => x.kind === "desistencia" || x.kind === "cancelamento")).length;
  return Math.max(0, seats - taken);
}

/** Conclusão só com mínimo configurado e frequência conhecida ≥ mínimo (espelha o writer). */
export function conclusionAllowed(minPct: number | null, pct: number | null): { ok: boolean; reason: string | null } {
  if (minPct == null) return { ok: false, reason: "Frequência mínima não configurada no curso." };
  if (pct == null) return { ok: false, reason: "Frequência não informada." };
  return pct >= minPct ? { ok: true, reason: null } : { ok: false, reason: "Frequência abaixo do mínimo." };
}

/** Certificação: conclusão registrada, emissor ≠ quem concluiu e ≠ titular. */
export function certificationAllowed(a: { concludedBy: string | null; holder: string; issuer: string }): boolean {
  return a.concludedBy != null && a.issuer !== a.concludedBy && a.issuer !== a.holder;
}

const ERRORS: Record<string, string> = {
  "dev:no-person": "Sua conta não está ligada a uma pessoa institucional.",
  "dev:unavailable": "Ação indisponível para sua atuação.",
  "dev:stale": "Outra pessoa alterou antes; recarregue.",
  "dev:self-approval": "Quem elaborou a versão não pode aprová-la.",
  "dev:plan-not-approved": "O plano precisa estar aprovado na última versão.",
  "dev:course-not-approved": "O curso precisa estar aprovado na última versão.",
  "dev:seats-not-configured": "A turma não tem número de vagas configurado.",
  "dev:no-seats": "Não há vagas.",
  "dev:link-not-of-person": "O vínculo informado não pertence à pessoa.",
  "dev:already-enrolled": "Pessoa já inscrita nesta turma.",
  "dev:terminal": "A participação já foi encerrada.",
  "dev:min-attendance-not-configured": "Frequência mínima não configurada no curso.",
  "dev:attendance-below-min": "Frequência abaixo do mínimo.",
  "dev:not-concluded": "Sem conclusão registrada.",
  "dev:segregation": "Quem emite o certificado não pode ser o titular nem quem registrou a conclusão.",
  "dev:already-certified": "Certificado já emitido.",
};
export const devErrorMessage = (raw: string): string => {
  const k = Object.keys(ERRORS).find((key) => raw.includes(key));
  return k ? ERRORS[k]! : "Não foi possível concluir a operação.";
};
