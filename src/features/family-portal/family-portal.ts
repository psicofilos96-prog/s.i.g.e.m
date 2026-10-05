/**
 * Portal da Família — projeção read-only. O banco decide quem vê o quê (family_students / family_student_summary);
 * esta camada só apresenta. Nada aqui concede acesso, infere vínculo ou converte ausência em zero.
 */

export const FAMILY_SECTIONS = ["matricula", "frequencia", "avaliacao", "calendario", "documentos", "comunicados"] as const;
export type FamilySection = (typeof FAMILY_SECTIONS)[number];

export type FamilyStudent = Readonly<{ student_id: string; display_name: string | null; sections: readonly FamilySection[]; valid_until: string | null }>;
export type FamilySummary = Readonly<{
  sections: readonly FamilySection[];
  enrollments: readonly Readonly<{ school: string; opened_on: string | null; ended_on: string | null; classes: readonly Readonly<{ class: string; from: string; until: string | null }>[] }>[] | null;
  documents: readonly Readonly<{ kind: string; emission: string; emitted_at: string; number: string | null; verification_code: string }>[] | null;
}>;

export type SectionState =
  | { kind: "nao-autorizada" }
  | { kind: "sem-publicacao"; reason: string }
  | { kind: "vazia"; message: string }
  | { kind: "disponivel" };

/** Seções sem contrato de publicação à família: nada interno aparece antes de existir esse ato. */
const NO_PUBLICATION: Partial<Record<FamilySection, string>> = {
  frequencia: "A frequência só aparecerá depois que existir a publicação oficial para a família; nada é mostrado a partir de registros internos.",
  avaliacao: "Notas e boletim só aparecerão depois do fechamento e da publicação oficial para a família.",
  comunicados: "Ainda não há comunicados publicados para a família.",
};

export function sectionState(s: FamilySummary, section: FamilySection): SectionState {
  if (!s.sections.includes(section)) return { kind: "nao-autorizada" };
  const np = NO_PUBLICATION[section];
  if (np) return { kind: "sem-publicacao", reason: np };
  if (section === "matricula") return s.enrollments && s.enrollments.length ? { kind: "disponivel" } : { kind: "vazia", message: "Nenhuma matrícula registrada." };
  if (section === "documentos") return s.documents && s.documents.length ? { kind: "disponivel" } : { kind: "vazia", message: "Nenhum documento emitido." };
  return { kind: "disponivel" };
}

/** Educando da URL só é aceito se estiver na lista autorizada pelo banco; senão, nenhum outro é escolhido em silêncio. */
export function resolveSelected(list: readonly FamilyStudent[], requested: string | undefined): { id: string | null; rejected: boolean } {
  if (requested) return list.some((s) => s.student_id === requested) ? { id: requested, rejected: false } : { id: null, rejected: true };
  return { id: list.length === 1 ? list[0]!.student_id : null, rejected: false };
}

export const SECTION_LABEL: Record<FamilySection, string> = {
  matricula: "Vida escolar", frequencia: "Frequência", avaliacao: "Avaliações e boletim",
  calendario: "Calendário", documentos: "Documentos", comunicados: "Comunicados",
};

export const fmtDate = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "sem registro");

export function familyMessage(raw: string): string {
  if (raw.includes("session-required")) return "Sua sessão expirou. Entre novamente.";
  if (raw.includes("family:not-authorized")) return "Não há autorização vigente para você consultar este educando.";
  return raw;
}
