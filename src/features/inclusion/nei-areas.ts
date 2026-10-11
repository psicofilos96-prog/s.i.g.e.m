/**
 * NEI.1 — áreas do ambiente NEI. Cada área ou leva à tela que já existe (e que reaplica a própria
 * permissão), ou declara por extenso o que falta. Nunca é uma tela demonstrativa.
 * A lista segue o documento de pedidos e decisões do NEI entregue pelo usuário.
 */
export type NeiRole = "coordenador" | "tecnico" | "aee";
export type NeiAccess = {
  source: "estacao" | "papel" | "administracao";
  role: string;
  scope_kind: "rede" | "escola" | "caso";
  school_id: string | null;
  school_name: string | null;
  student_scoped: boolean;
  valid_until: string | null;
  can_manage_staff: boolean;
  can_manage_coordinators: boolean;
};

export type NeiArea = {
  id: string;
  title: string;
  summary: string;
  /** Tela existente que atende a área; ausente ⇒ `pending` explica o motivo. */
  path?: string;
  pending?: string;
  /** Quem vê a área no menu do NEI. Vazio ⇒ todos os papéis do NEI. */
  roles?: readonly ("coordenador" | "tecnico" | "aee" | "estacao-nei" | "admin-geral")[];
};

export const NEI_AREAS: readonly NeiArea[] = [
  { id: "painel", title: "Painel do NEI", summary: "Contagens por escola dentro do seu escopo.", path: "/inclusao/nei" },
  { id: "estudantes", title: "Estudantes acompanhados", summary: "Registros pedagógicos de apoio por estudante.", path: "/inclusao" },
  { id: "cadastro-nee", title: "Cadastro de NEE (3 dimensões)", summary: "Público da Educação Especial, transtornos de aprendizagem e condições associadas.", path: "/inclusao", roles: ["coordenador", "tecnico", "estacao-nei", "admin-geral"] },
  { id: "laudos", title: "Laudos e CID", summary: "Registro clínico restrito, com finalidade e trilha de cada leitura.", path: "/inclusao", roles: ["coordenador", "estacao-nei", "admin-geral"] },
  { id: "fila-termos", title: "Termos pendentes de validação", summary: "Termos não reconhecidos aguardando validação humana.", path: "/inclusao", roles: ["coordenador", "tecnico", "estacao-nei", "admin-geral"] },
  { id: "aee", title: "Atendimento Educacional Especializado", summary: "Serviços AEE, agenda e sessões com frequência própria.", path: "/inclusao" },
  { id: "mediacao", title: "Mediadores e vínculos", summary: "Vínculo mediador↔estudante com vigência; troca = encerrar e novo vínculo.", path: "/inclusao" },
  { id: "carencia", title: "Carência de mediador", summary: "Estudantes que precisam de mediação sem mediador vigente.", pending: "A necessidade de mediação ainda não é um dado registrado; contar carência agora seria inferência." },
  { id: "paee", title: "PAEE", summary: "Plano de Atendimento Educacional Especializado.", pending: "Modelo institucional do PAEE ainda não homologado no Construtor de Documentos." },
  { id: "pei", title: "PEI", summary: "Plano Educacional Individualizado.", pending: "Modelo institucional do PEI ainda não homologado no Construtor de Documentos." },
  { id: "evolutivo", title: "Relatório evolutivo", summary: "Registros pedagógicos em ordem, sem dado clínico, PDF A4.", path: "/inclusao" },
  { id: "relatorio-nei", title: "Relatório NEI (por nível/ano)", summary: "Aluno, ano, turma, turno, CID, mediador ou CARÊNCIA, situação.", pending: "Depende dos registros clínicos e dos vínculos de mediador, apagados na exclusão de 12/09/2026 e ainda não reimportados." },
  { id: "relatorio-mediadores", title: "Mediadores com seus estudantes", summary: "Cruzamento de mediação com turmas.", path: "/relatorios" },
  { id: "consultas", title: "Consultas e relatórios de NEE", summary: "Gerador de relatórios com a mesma permissão da tela.", path: "/relatorios", roles: ["coordenador", "tecnico", "estacao-nei", "admin-geral"] },
  { id: "censo", title: "Censo/GPE — dimensão A", summary: "Só a dimensão A vai ao Censo, por tradução explícita.", path: "/censo-escolar", roles: ["coordenador", "estacao-nei", "admin-geral"] },
  { id: "domiciliar", title: "Atendimento domiciliar/hospitalar", summary: "Sigilo altíssimo; o NEI não lê dado individual.", pending: "Decisão pendente: se o NEI recebe só contagem do atendimento domiciliar." },
  { id: "equipe", title: "Equipe e papéis do NEI", summary: "Conceder e revogar coordenador, técnico e AEE com escopo.", path: "/inclusao/nei", roles: ["coordenador", "estacao-nei", "admin-geral"] },
  { id: "auditoria", title: "Acessos registrados", summary: "Quem abriu o painel ou geriu papéis, permitido ou recusado.", path: "/inclusao/nei", roles: ["coordenador", "estacao-nei", "admin-geral"] },
];

/** Papéis efetivos da conta no NEI. */
export function neiRoles(access: readonly NeiAccess[]): Set<string> {
  return new Set(access.map((a) => a.role));
}

/** Áreas visíveis: área sem `roles` é de todos com algum acesso; sem acesso, nada. */
export function visibleAreas(access: readonly NeiAccess[]): NeiArea[] {
  if (access.length === 0) return [];
  const r = neiRoles(access);
  return NEI_AREAS.filter((a) => !a.roles || a.roles.some((x) => r.has(x)));
}

/** Escopo legível: rede ou lista de escolas (caso = escola + estudantes específicos). */
export function scopeLabel(access: readonly NeiAccess[]): string {
  if (access.some((a) => a.scope_kind === "rede")) return "Rede inteira";
  const schools = [...new Set(access.map((a) => a.school_name ?? a.school_id ?? "escola"))];
  const cases = access.some((a) => a.scope_kind === "caso");
  return `${schools.join(", ")}${cases ? " (casos específicos)" : ""}`;
}

export type NeiDashRow = { school_id: string; school_name: string | null; students_with_record: number; aee_active: number; aee_sessions_30d: number; mediations_active: number; clinical_students: number | null; students_in_case_scope: number };

/** Totais do painel; contagem clínica só quando TODAS as linhas a trazem (senão "sem acesso"). */
export function dashTotals(rows: readonly NeiDashRow[]) {
  const sum = (k: "students_with_record" | "aee_active" | "aee_sessions_30d" | "mediations_active") => rows.reduce((s, r) => s + Number(r[k] ?? 0), 0);
  const clinical = rows.length > 0 && rows.every((r) => r.clinical_students !== null) ? rows.reduce((s, r) => s + Number(r.clinical_students), 0) : null;
  return { schools: rows.length, students: sum("students_with_record"), aee: sum("aee_active"), sessions: sum("aee_sessions_30d"), mediations: sum("mediations_active"), clinical };
}

export const NEI_ROLE_LABEL: Record<string, string> = {
  coordenador: "Coordenação do NEI", tecnico: "Técnico(a) do NEI", aee: "Professor(a) de AEE",
  "estacao-nei": "Conta da estação NEI", "admin-geral": "Administração geral",
};

/** Combinações aceitas pelo banco (espelho dos CHECKs da migration 0330). */
export function grantShapeProblem(role: NeiRole, scope: "rede" | "escola" | "caso", school: string, student: string, reason: string): string | null {
  if (role === "coordenador" && scope !== "rede") return "Coordenação é sempre da rede inteira.";
  if (role === "aee" && scope === "rede") return "AEE é por escola ou por caso.";
  if (scope !== "rede" && !school) return "Escolha a escola.";
  if (scope === "caso" && !student.trim()) return "Informe o identificador do estudante.";
  if (reason.trim().length < 5) return "Escreva o motivo (mínimo 5 caracteres).";
  return null;
}
