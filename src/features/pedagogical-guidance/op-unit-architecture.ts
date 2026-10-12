/**
 * ORIENTAÇÃO PEDAGÓGICA DE CADA ESCOLA — LOTE 01 (auditoria e arquitetura).
 *
 * 1) Matriz das 34 seções → tabelas/funções/rotas/fontes/capacidades/testes existentes ou lacuna.
 *    Títulos seguem a ordem da especificação do usuário; nada citado aqui é inventado: o teste
 *    exige que toda tabela/função/rota exista.
 * 2) Dois escopos separados: orientador da UNIDADE (atuação na escola, capacidade escopo "escola")
 *    e coordenação CENTRAL da rede (capacidade escopo "rede"). Um nunca herda o outro.
 * 3) Regimentos: nenhum regimento escolar/municipal está no acervo do projeto ⇒ atribuições
 *    do orientador ficam parametrizáveis e registradas como lacuna.
 */

export type Status = "existente" | "parcial" | "lacuna" | "bloqueado";
export interface OpSection {
  n: number; title: string; scope: "unidade" | "central" | "ambos";
  tables: string[]; functions: string[]; routes: string[]; capabilities: string[]; tests: string[];
  status: Status; note: string;
}
const S = (n: number, title: string, scope: OpSection["scope"], status: Status, note: string,
  o: Partial<Pick<OpSection, "tables" | "functions" | "routes" | "capabilities" | "tests">> = {}): OpSection =>
  ({ n, title, scope, status, note, tables: o.tables ?? [], functions: o.functions ?? [], routes: o.routes ?? [], capabilities: o.capabilities ?? [], tests: o.tests ?? [] });

const PG = "src/features/pedagogical-guidance";
const FOLLOW = { tables: ["school_pedagogical_records"], functions: ["record_school_pedagogical_record_v2", "school_pedagogical_records_at"], capabilities: ["registrar-acompanhamento-pedagogico", "consultar-acompanhamento-pedagogico"] };

export const OP_SECTIONS: readonly OpSection[] = [
  S(1, "Finalidade do perfil", "ambos", "parcial", "Estação /orientacao existe como workspace de acompanhamento (13H).", { routes: ["/orientacao"] }),
  S(2, "Princípios orientadores", "ambos", "existente", "Sinal não é diagnóstico nem decisão (13H AGENTS.md).", { tests: [`${PG}/pedagogical-guidance.test.ts`] }),
  S(3, "Distinção orientador da unidade × coordenação central", "ambos", "parcial", "Separação por escopo da capacidade (escola × rede) já usada pelo writer AB; política homologada ausente.", { capabilities: FOLLOW.capabilities }),
  S(4, "Atribuições conforme regimento", "ambos", "bloqueado", "Nenhum regimento no acervo: atribuições parametrizáveis, nada concedido."),
  S(5, "Arquitetura do perfil e menu", "unidade", "parcial", "Menu por pathAllowed; estação sem divisão unidade/central.", { routes: ["/orientacao"] }),
  S(6, "Painel da unidade", "unidade", "parcial", "Workspace projeta itens autorizados; sem painel por escola.", { routes: ["/orientacao"] }),
  S(7, "Agenda pedagógica", "unidade", "lacuna", "Usar calendário oficial e grade; sem agenda da OP."),
  S(8, "Turmas e docentes acompanhados", "unidade", "parcial", "Leitura por atuação da escola; sem tela própria.", { tables: ["institutional_engagements"] }),
  S(9, "Acompanhamento de planejamento", "unidade", "existente", "Planos compartilhados lidos por overview, sem ação.", { tables: ["teaching_plan_versions"], functions: ["teaching_plans_overview_at"], routes: ["/acompanhamento-planejamento"] }),
  S(10, "Devolutiva ao planejamento", "unidade", "parcial", "Devolutiva da OP é ledger que não altera o plano (Docente L07); writer no banco ausente."),
  S(11, "Acompanhamento de diários", "unidade", "parcial", "Tela de acompanhamento de diários existente.", { routes: ["/acompanhamento-diarios"] }),
  S(12, "Acompanhamento da avaliação", "unidade", "parcial", "Leitura da Pauta e acompanhamento de avaliação.", { routes: ["/acompanhamento-avaliacao"] }),
  S(13, "Registros de acompanhamento pedagógico", "unidade", "existente", "Writer DEFINER com capacidade escola e catálogo homologado.", FOLLOW),
  S(14, "Acompanhamento de estudantes", "unidade", "parcial", "Trajetória do estudante por reader AB2; sinais 13H.", { functions: ["school_pedagogical_records_at"] }),
  S(15, "Intervenções pedagógicas", "unidade", "existente", "Writer canônico A&A; OP não duplica.", { tables: ["aa_intervention_versions"], functions: ["aa_record_intervention"] }),
  S(16, "Recuperação e reforço", "unidade", "parcial", "Plano de recuperação via aa_record_intervention (Docente L11).", { functions: ["aa_record_intervention"] }),
  S(17, "Integração com NEI/inclusão", "unidade", "parcial", "Só orientação liberada; sem campo clínico.", { routes: ["/inclusao"] }),
  S(18, "Integração com Mediador", "unidade", "parcial", "Contrato fechado Orientação ↔ Mediador (Mediador L16)."),
  S(19, "Conselho de classe", "unidade", "existente", "Colegiado canônico; OP só participa conforme configuração.", { tables: ["collegial_deliberations"], functions: ["record_collegial_deliberation"] }),
  S(20, "Formação continuada", "ambos", "lacuna", "Sem registro de formação."),
  S(21, "Quadro permanente da rede", "central", "existente", "Orientação de rede versionada, capacidade não atribuída.", { tables: ["op_permanent_board_versions"], functions: ["record_op_permanent_board_version"], routes: ["/quadro-permanente-op"], capabilities: ["manter-quadro-permanente-op"] }),
  S(22, "Coordenação central: acompanhamento das unidades", "central", "parcial", "Consulta rede pela capacidade escopo rede; sem visão por unidade.", { capabilities: ["consultar-acompanhamento-pedagogico"] }),
  S(23, "Comunicação com docentes e Direção", "unidade", "parcial", "Canais existentes (solicitações, notificações).", { functions: ["emit_notification_event"] }),
  S(24, "Solicitações e protocolos", "ambos", "parcial", "Motor de tramitação sem definição homologada para OP.", { functions: ["apply_workflow_transition"], routes: ["/pendencias"] }),
  S(25, "Documentos", "ambos", "parcial", "Central de documentos existente.", { routes: ["/central-de-documentos"] }),
  S(26, "Relatórios", "ambos", "parcial", "Motor de relatórios existente; sem catálogo da OP.", { routes: ["/relatorios"] }),
  S(27, "Indicadores", "central", "parcial", "Indicadores pertencem ao CIECE; OP não publica taxa nem ranking."),
  S(28, "Meu histórico", "ambos", "lacuna", "Derivável dos registros autorados."),
  S(29, "Perfis e permissões", "ambos", "bloqueado", "Capacidades existem sem política homologada atribuída.", { capabilities: FOLLOW.capabilities }),
  S(30, "Segurança e LGPD", "ambos", "parcial", "RLS + writer DEFINER; visibilidade por registro.", { tables: ["school_pedagogical_records"] }),
  S(31, "Interface e mobilidade", "ambos", "parcial", "Primitivas FollowUpWorkspace (6B.3.2).", { tests: [`${PG}/guidance-presentation.test.ts`] }),
  S(32, "Automações", "ambos", "lacuna", "Só lembrete/aviso; nunca decisão."),
  S(33, "Plano de implementação e testes", "ambos", "existente", "Lotes do perfil; teste e2e AB2 em SQL com rollback.", { tests: ["supabase/tests/ab2_followup_e2e.sql"] }),
  S(34, "Critérios de aceitação", "ambos", "lacuna", "Sem sessão real: 0 registros pedagógicos no banco."),
];

/** Funções de orientação: identificador aberto; atribuições só por configuração homologada. */
export const OP_FUNCTION_IDS = ["orientador-da-unidade", "coordenacao-central-op"] as const;

export interface OpGrant { capability: string; scope: "escola" | "rede"; schoolId: string | null; from: string; to: string | null }
export interface OpContext { personNatural: boolean; grants: OpGrant[]; date: string }

const live = (g: OpGrant, d: string) => g.from <= d && (g.to === null || d <= g.to);

/**
 * Escopo efetivo de uma ação. Unidade: só grant escopo "escola" da mesma escola.
 * Central: só grant escopo "rede"; leitura de rede NÃO concede escrita na unidade.
 */
export function opScope(ctx: OpContext, action: "consultar" | "registrar", schoolId: string):
  { ok: boolean; via: "unidade" | "central" | null; reason: string } {
  if (!ctx.personNatural) return { ok: false, via: null, reason: "Executor técnico não pratica ato pedagógico." };
  const cap = action === "registrar" ? "registrar-acompanhamento-pedagogico" : "consultar-acompanhamento-pedagogico";
  const gs = ctx.grants.filter((g) => g.capability === cap && live(g, ctx.date));
  if (gs.some((g) => g.scope === "escola" && g.schoolId === schoolId)) return { ok: true, via: "unidade", reason: "" };
  if (action === "consultar" && gs.some((g) => g.scope === "rede")) return { ok: true, via: "central", reason: "" };
  if (action === "registrar" && gs.some((g) => g.scope === "rede"))
    return { ok: false, via: null, reason: "Coordenação central não registra pela unidade sem atuação na escola." };
  return { ok: false, via: null, reason: "Sem capacidade vigente para esta escola." };
}

export const REGIMENT_GAP = "Regimento escolar/municipal não está no acervo: atribuições do orientador e da coordenação não verificadas.";
