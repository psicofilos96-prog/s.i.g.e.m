/**
 * Termos do cadastro (0556). Texto versionado: mudar o texto = nova versão; a manifestação guarda a versão lida.
 * Sem manifestação ⇒ "não manifestado", nunca aceite presumido. Recusa de imagem não impede matrícula.
 */
export type TermKey = "uso-de-imagem" | "ciencia-de-faltas" | "saida-desacompanhada";
export type ConsentDecision = "autoriza" | "nao-autoriza" | "ciente" | "revogado";

export type ConsentTerm = { key: TermKey; version: number; title: string; body: readonly string[]; decisions: readonly ConsentDecision[] };

export const CONSENT_TERMS: readonly ConsentTerm[] = [
  {
    key: "uso-de-imagem", version: 1, title: "Termo de autorização de uso de imagem e voz",
    decisions: ["autoriza", "nao-autoriza", "revogado"],
    body: [
      "O responsável legal pelo estudante identificado neste termo manifesta-se sobre o uso da imagem e da voz do estudante, captadas em atividades escolares.",
      "Finalidade: exclusivamente institucional e educativa — registro de atividades pedagógicas, eventos da escola e divulgação nos canais oficiais da Prefeitura e da Secretaria Municipal de Educação.",
      "É vedado qualquer uso comercial, bem como uso que exponha o estudante a situação vexatória ou constrangedora.",
      "A autorização é gratuita e pode ser revogada a qualquer momento na secretaria da escola, sem prejuízo ao estudante. A recusa não impede a matrícula nem a participação nas atividades.",
    ],
  },
  {
    key: "ciencia-de-faltas", version: 1, title: "Termo de ciência sobre frequência escolar",
    decisions: ["ciente"],
    body: [
      "O responsável legal declara estar ciente de que a frequência escolar é obrigatória e acompanhada pela escola.",
      "Faltas devem ser justificadas na secretaria, com documento quando houver (por exemplo, atestado médico).",
      "Faltas repetidas sem justificativa serão comunicadas ao responsável e, quando necessário, aos órgãos de proteção, conforme a legislação.",
    ],
  },
  {
    key: "saida-desacompanhada", version: 1, title: "Termo de autorização de saída desacompanhada",
    decisions: ["autoriza", "nao-autoriza", "revogado"],
    body: [
      "O responsável legal manifesta-se sobre a saída do estudante da escola, ao fim do horário, sem acompanhamento de adulto.",
      "Sem autorização registrada, o estudante só sai acompanhado do responsável ou de pessoa autorizada.",
      "A autorização pode ser revogada a qualquer momento na secretaria da escola.",
    ],
  },
];

export const DECISION_LABEL: Record<ConsentDecision, string> = {
  autoriza: "Autoriza", "nao-autoriza": "Não autoriza", ciente: "Ciente", revogado: "Revogado",
};

export type ConsentRow = { term_key: TermKey; term_version: number; sequence: number; decision: ConsentDecision; guardian_name: string; declared_on: string };

/** Situação atual por termo: última manifestação; ausente ⇒ null ("Não manifestado"). Versão antiga é sinalizada. */
export function currentConsents(rows: readonly ConsentRow[]) {
  const out = new Map<TermKey, { row: ConsentRow | null; outdated: boolean }>();
  for (const t of CONSENT_TERMS) {
    const last = rows.filter((r) => r.term_key === t.key).sort((a, b) => b.sequence - a.sequence)[0] ?? null;
    out.set(t.key, { row: last, outdated: !!last && last.term_version < t.version });
  }
  return out;
}

export const CONSENT_MESSAGES: Record<string, string> = {
  "consent:capability-missing": "Sua conta não pode registrar termos nesta escola.",
  "consent:decision-invalid": "Escolha uma resposta válida para este termo.",
  "consent:date-invalid": "Informe a data em que o responsável assinou (até hoje).",
  "consent:guardian-required": "Informe o nome do responsável que assinou.",
  "consent:stale-base": "O termo mudou enquanto você trabalhava. Recarregue e tente de novo.",
  "consent:not-a-student": "Este aluno não tem matrícula nesta escola.",
};
