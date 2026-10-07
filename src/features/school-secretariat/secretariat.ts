// AF — Secretaria Escolar: tipos e projeções puras sobre os readers canônicos.
// Nada aqui grava nem calcula fato; ausência nunca vira zero.

export interface SecretariatOverview {
  status: "ok"; school_id: string; year_id: string; on: string;
  year: { label: string | null; starts_on: string | null; ends_on: string | null; state: string | null; state_sequence: number | null };
  enrollments: { total: number; active: number; not_started: number; start_unknown: number; ended: number };
  allocations: { active_episodes: number; classes_with_students: number; enrollments_without_class: number };
  movements: Record<string, number>;
  transition_decisions: Record<string, number>;
}

export interface PendingRow { student_id: string; display_name: string; enrollment_id: string; issue: string }

export interface LifeEvent {
  kind: string; ref_id: string; occurred_on: string | null; school_id: string | null; label: string;
  detail: Record<string, unknown>; recorded_at: string; superseded: boolean;
}

const ISSUES: Record<string, string> = {
  "inicio-efetivo-nao-declarado": "Início efetivo do vínculo não declarado",
  "sem-turma-vigente": "Vínculo ativo sem turma vigente",
};
export const issueLabel = (i: string) => ISSUES[i] ?? i;

const KINDS: Record<string, string> = {
  identidade: "Identidade permanente", "vinculo-anual": "Vínculo escolar anual", "encerramento-vinculo": "Encerramento do vínculo",
  turma: "Enturmação", "saida-turma": "Saída da turma", movimentacao: "Movimentação",
};
export const lifeKindLabel = (k: string) => KINDS[k] ?? k;

/** Ordena a vida escolar: identidade primeiro, depois por data (sem data = desconhecida, ao fim do grupo), depois registro. */
export function orderLife(rows: LifeEvent[]): LifeEvent[] {
  return [...rows].sort((a, b) => {
    if (a.kind === "identidade" !== (b.kind === "identidade")) return a.kind === "identidade" ? -1 : 1;
    const da = a.occurred_on ?? "9999-12-31", db = b.occurred_on ?? "9999-12-31";
    return da === db ? a.recorded_at.localeCompare(b.recorded_at) : da.localeCompare(db);
  });
}

export const YEAR_STATE_LABEL: Record<string, string> = {
  historico: "Histórico (somente leitura)", preparacao: "Em preparação", aberto: "Aberto", encerramento: "Em encerramento", encerrado: "Encerrado",
};
export const yearStateLabel = (s: string | null) => (s ? YEAR_STATE_LABEL[s] ?? s : "Sem estado operacional registrado");

const MSG: [RegExp, string][] = [
  [/session-required/, "Entre com sua conta institucional."],
  [/not-authorized|not-found/, "Sem permissão nesta escola ou registro não encontrado."],
  [/natural-person-required/, "A operação exige conta ligada a uma pessoa natural."],
  [/year-not-open/, "O ano letivo não está aberto para operação; 2026 é histórico e 2027 depende do ato de abertura."],
  [/base-superseded/, "O registro mudou desde que foi aberto. Recarregue e tente de novo."],
  [/type-not-current/, "Tipo de movimentação não homologado; nada foi registrado."],
  [/active-class-exists/, "O estudante já tem enturmação vigente nessa data."],
  [/enrollment-start-unknown/, "O vínculo não tem início efetivo declarado; declare-o antes de enturmar."],
  [/enrollment-ended/, "O vínculo já foi encerrado."],
  [/before-enrollment|outside-year|date-invalid|date-required/, "Data fora do vínculo ou do ano letivo."],
  [/class-invalid/, "Turma inexistente, de outra escola ou de outro ano."],
  [/destination-invalid/, "Escola de destino inválida."],
  [/correction-reason-required/, "Informe o motivo."],
];
export function secretariatMessage(raw: string): string {
  return MSG.find(([r]) => r.test(raw))?.[1] ?? "Não foi possível concluir. Nada foi gravado.";
}

/** N5.2: turmas escolhíveis para enturmar — escola e ano do contexto, cadastro único e ativo na data; nunca por identificador digitado. */
export type ClassOption = { id: string; name: string };
export function eligibleClassOptions(
  list: { classId: string; schoolId: string; academicYearId: string; record: { kind: string; value?: { name: string; administrativeStatus: string } } }[],
  school: string, year: string,
): ClassOption[] {
  return list
    .filter((c) => c.schoolId === school && c.academicYearId === year && c.record.kind === "one" && c.record.value?.administrativeStatus === "ativa")
    .map((c) => ({ id: c.classId, name: c.record.value!.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
