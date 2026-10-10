/**
 * NUX.4.1 — Orientação por rota principal: onde estou / o que fazer / próximo passo.
 * Só apresentação: não concede acesso, não decide regra e não afirma estado de dado.
 * Correspondência EXATA do caminho; subpáginas (detalhe, edição) usam o próprio título.
 */
export type RouteGuide = { where: string; todo: string; next?: string; primary?: { label: string; to: string } };
/** NHOME.1: `primary` é a ação principal da home quando a própria tela não a destaca; sempre rota existente, nunca afirma dado. */

export const ROUTE_GUIDES: Readonly<Record<string, RouteGuide>> = {
  "/": { where: "Início", todo: "Veja suas pendências e entre na área em que vai trabalhar.", next: "escolha uma área no menu ao lado." },
  "/tarefas": { where: "Tarefas", todo: "Confira o que está aguardando você.", next: "abra uma tarefa para ver o que falta." },
  "/avisos": { where: "Avisos", todo: "Leia os comunicados recebidos.", next: "abra um aviso para ver o texto completo." },
  "/ajuda": { where: "Ajuda", todo: "Procure orientação sobre como usar o sistema." },
  "/calendario-escolar": { where: "Calendário escolar", todo: "Consulte o calendário que vale para a sua escola.", next: "abra um calendário para ver os dias letivos." },
  "/ciece": { where: "CIECE — Informação e Estatística", todo: "Acompanhe a qualidade e a consolidação dos dados da rede.", next: "confira os mapas enviados pelas escolas.", primary: { label: "Conferir mapas da rede", to: "/mapa-estatistico-rede" } },
  "/mapa-estatistico": { where: "Mapa estatístico", todo: "Confira os números da escola antes de enviar.", next: "revise as turmas e envie o mapa." },
  "/mapa-censo-2026": { where: "Mapa Estatístico 2026", todo: "Escolha a escola e confira turmas, etapas e totais do Censo 2026.", next: "imprima a grade ou exporte em PDF/Excel." },
  "/consolidado-2026": { where: "Consolidado 2026 da rede", todo: "Confira os totais da rede e a conferência com o recibo do Censo.", next: "abra o mapa de uma escola para ver o detalhe." },
  "/mapa-estatistico-rede": { where: "Mapa estatístico da rede", todo: "Acompanhe os mapas enviados pelas escolas.", next: "abra um mapa enviado para aprovar ou devolver." },
  "/qualidade-dos-dados": { where: "Qualidade dos dados", todo: "Veja os registros que precisam de correção." },
  "/revisao-de-anomalias": { where: "Revisão de anomalias", todo: "Analise os casos fora do padrão apontados pelo sistema." },
  "/paineis": { where: "Painéis", todo: "Consulte os indicadores disponíveis para a sua conta." },
  "/relatorios": { where: "Relatórios", todo: "Escolha um relatório para gerar ou consultar." },
  "/unidades": { where: "Unidades escolares", todo: "Encontre uma escola e veja seus dados de cadastro.", next: "pesquise pelo nome da escola." },
  "/supervisao-escolar": { where: "Supervisão Escolar", todo: "Acompanhe as escolas e as normas da rede.", next: "abra a escola ou o calendário que deseja revisar." },
  "/alimentacao-escolar": { where: "Alimentação Escolar", todo: "Registre e acompanhe a alimentação servida nas escolas.", next: "registre a refeição servida hoje.", primary: { label: "Registrar refeição de hoje", to: "/alimentacao-escolar/cozinha" } },
  "/avaliacao-desempenho": { where: "Avaliação e Desempenho", todo: "Consulte resultados das avaliações aplicadas.", next: "escolha a avaliação que deseja ver.", primary: { label: "Ver painéis", to: "/paineis" } },
  "/secretaria": { where: "Secretaria Escolar", todo: "Cuide de matrículas, documentos e vagas da escola.", next: "escolha o serviço que vai realizar." },
  "/alunos": { where: "Estudantes", todo: "Encontre um estudante para ver ou atualizar o cadastro.", next: "pesquise pelo nome do estudante." },
  "/turmas": { where: "Turmas", todo: "Veja as turmas da escola e seus estudantes.", next: "abra uma turma para ver os detalhes." },
  "/enturmacoes": { where: "Enturmações", todo: "Coloque estudantes em turmas ou faça movimentações." },
  "/documentos-escolares": { where: "Documentos escolares", todo: "Emita ou consulte documentos dos estudantes." },
  "/horarios": { where: "Horários", todo: "Monte e publique o quadro de horários das turmas.", next: "escolha uma turma para montar o horário." },
  "/direcao": { where: "Direção Escolar", todo: "Veja o que aguarda decisão da direção.", next: "abra um item para decidir." },
  "/gestao-escolar": { where: "Gestão escolar", todo: "Acompanhe a organização geral da escola." },
  "/profissionais": { where: "Profissionais", todo: "Encontre um profissional para ver vínculos e lotações.", next: "pesquise pelo nome do profissional." },
  "/orientacao": { where: "Orientação Pedagógica", todo: "Acompanhe os estudantes que precisam de atenção.", next: "abra um acompanhamento para registrar o que foi feito." },
  "/administracao": { where: "Administração", todo: "Cuide de pessoas, contas e atuações da rede.", next: "confira quem tem acesso e a quê.", primary: { label: "Abrir central de acessos", to: "/central-de-acessos" } },
  "/inclusao": { where: "Inclusão", todo: "Acompanhe o apoio inclusivo, o AEE e a mediação dos estudantes." },
  "/familia": { where: "Família", todo: "Acompanhe a vida escolar do estudante pelo qual você é responsável." },
  "/acompanhamento-diarios": { where: "Acompanhamento de diários", todo: "Veja como estão os diários das turmas da escola." },
  "/autorizacoes-familia": { where: "Autorizações da família", todo: "Conceda ou encerre o acesso dos responsáveis ao Portal da Família." },
  "/carteirinhas": { where: "Carteirinhas", todo: "Emita e consulte as carteirinhas dos estudantes." },
  "/preparacao-2027": { where: "Preparação do próximo ano letivo", todo: "Veja o que já está pronto e o que ainda falta.", next: "abra a ferramenta de um item ausente." },
  "/planejamento": { where: "Planejamento", todo: "Registre e revise o planejamento das aulas." },
};

export function guideForPath(pathname: string): RouteGuide | null {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return ROUTE_GUIDES[p] ?? null;
}
