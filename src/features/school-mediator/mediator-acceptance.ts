/**
 * LOTE 20 — Aceite técnico do Perfil Mediador Escolar.
 * Matriz 30 seções → artefato → teste → status, e 14 critérios de aceitação.
 * Status técnico nunca é "homologado": homologação institucional exige avaliação humana competente.
 */
export type TechStatus = "tela+nucleo" | "nucleo-testado" | "bloqueado";
export interface AcceptanceRow { n: number; modules: string[]; tests: string[]; status: TechStatus; blocker: string | null }

const M = (f: string) => `src/features/school-mediator/${f}.ts`;
const T = (f: string) => `src/features/school-mediator/${f}.test.ts`;
/** `suites` = suítes só de teste (sem módulo próprio), ex.: mediator-functional. */
const row = (n: number, files: string[], status: TechStatus, blocker: string | null = null, suites: string[] = []): AcceptanceRow =>
  ({ n, modules: files.map(M), tests: [...files, ...suites].map(T), status, blocker });

const NO_WRITER = "Sem gravação oficial do mediador no banco.";
const NO_DATA = "0 designações e 0 concessões NEI no banco: sem teste com sessão real.";

export const ACCEPTANCE_MATRIX: readonly AcceptanceRow[] = [
  row(1, ["mediator-architecture"], "nucleo-testado"),
  row(2, ["mediator-architecture"], "nucleo-testado"),
  row(3, ["mediator-architecture"], "nucleo-testado"),
  row(4, ["mediator-architecture"], "bloqueado", "Atribuições municipais das três funções não verificadas; coluna de função da designação não decidida."),
  row(5, ["mediator-panel"], "bloqueado", "Permissão de menu /mediador não decidida."),
  row(6, ["mediator-panel"], "tela+nucleo", NO_DATA),
  row(7, ["mediator-panel"], "nucleo-testado", "Tela Minha Agenda não construída."),
  row(8, ["mediator-designations", "mediator-student-file"], "nucleo-testado", NO_DATA),
  row(9, ["mediator-central", "mediator-guidance-flow"], "tela+nucleo", NO_DATA),
  row(10, ["mediator-daily-record"], "nucleo-testado", NO_WRITER),
  row(11, ["mediator-support-categories"], "bloqueado", "Catálogo de categorias não homologado."),
  row(12, ["mediator-participation"], "nucleo-testado", NO_WRITER),
  row(13, ["mediator-participation"], "nucleo-testado", NO_WRITER),
  row(14, ["mediator-occurrences"], "nucleo-testado", "Protocolos de urgência não homologados; sem gravação."),
  row(15, ["mediator-communication"], "nucleo-testado"),
  row(16, ["mediator-support-plan", "mediator-communication"], "nucleo-testado"),
  row(17, ["mediator-requests"], "bloqueado", "Definição 'solicitacao-mediacao' não homologada."),
  row(18, ["mediator-timeline"], "nucleo-testado"),
  row(19, ["mediator-reports", "mediator-automation"], "nucleo-testado"),
  row(20, ["mediator-reports"], "nucleo-testado"),
  row(21, ["mediator-history-integration"], "nucleo-testado"),
  row(22, ["mediator-history-integration"], "nucleo-testado", "Nenhum destinatário detém as capacidades exigidas."),
  row(23, ["mediator-designations", "mediator-architecture"], "nucleo-testado"),
  row(24, ["mediator-access-policy"], "bloqueado", "Capacidades por função dependem de configuração homologada."),
  row(25, ["mediator-access-policy"], "nucleo-testado", null, ["mediator-functional"]),
  row(26, ["mediator-central", "mediator-automation"], "tela+nucleo"),
  row(27, ["mediator-automation"], "nucleo-testado", "Envio por notificações não ligado."),
  row(28, ["mediator-acceptance"], "nucleo-testado"),
  row(29, ["mediator-acceptance"], "nucleo-testado", NO_DATA, ["mediator-functional"]),
  row(30, ["mediator-acceptance"], "nucleo-testado", "Resultado institucional depende de avaliação humana competente."),
];

export type CriterionStatus = "comprovado-tecnico" | "parcial" | "bloqueado";
export interface Criterion { id: number; text: string; evidence: string[]; status: CriterionStatus; gap: string | null }
const C = (id: number, text: string, evidence: string[], status: CriterionStatus, gap: string | null = null): Criterion => ({ id, text, evidence, status, gap });

export const ACCEPTANCE_CRITERIA: readonly Criterion[] = [
  C(1, "Acesso só por designação vigente (escola×estudante×data)", [T("mediator-designations"), T("mediator-functional")], "comprovado-tecnico"),
  C(2, "Funções não herdam competência", [T("mediator-architecture"), T("mediator-functional")], "comprovado-tecnico"),
  C(3, "Revogação e mudança de turma preservam histórico", [T("mediator-designations")], "comprovado-tecnico"),
  C(4, "Ficha sem laudo/prontuário", [T("mediator-student-file"), T("mediator-access-policy")], "comprovado-tecnico"),
  C(5, "Orientação versionada com autoria real", [T("mediator-guidance-flow")], "comprovado-tecnico"),
  C(6, "Registro diário objetivo, idempotente, 'Salvo' só confirmado", [T("mediator-daily-record"), T("mediator-automation")], "parcial", NO_WRITER),
  C(7, "Plano do NEI não alterado pelo mediador", [T("mediator-support-plan")], "comprovado-tecnico"),
  C(8, "Ocorrência não substitui serviço competente", [T("mediator-occurrences")], "comprovado-tecnico"),
  C(9, "Sem canal/fluxo paralelo", [T("mediator-communication"), T("mediator-requests")], "comprovado-tecnico"),
  C(10, "Relatório/exportação auditados; ausência ≠ zero", [T("mediator-reports")], "comprovado-tecnico"),
  C(11, "Automação nunca diagnostica, avalia nem decide", [T("mediator-automation")], "comprovado-tecnico"),
  C(12, "Acesso restrito: anônimo sem leitura nem execução", [T("mediator-functional")], "parcial", "Prova no banco feita fora da suíte; sessão real ausente."),
  C(13, "Operação móvel em poucos toques", ["src/features/school-mediator/mediator-central-page.tsx"], "parcial", "Central conferida em 390×844 sem sessão; demais telas não construídas."),
  C(14, "Credencial técnica não concede permissão humana", [T("mediator-access-policy"), T("mediator-functional")], "comprovado-tecnico"),
];
