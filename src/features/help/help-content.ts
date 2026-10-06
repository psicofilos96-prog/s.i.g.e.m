/**
 * Camada de conteúdo da ajuda (versionável). Textos explicam CONCEITOS do sistema; nunca afirmam
 * norma escolar. Estrutura pronta para outros idiomas: cada texto é um mapa por locale; hoje só pt-BR.
 */
export type Locale = "pt-BR";
export type Text = Readonly<Partial<Record<Locale, string>> & { "pt-BR": string }>;

export type HelpTopic = Readonly<{
  id: string; version: number; updatedOn: string;
  /** Prefixos de rota onde o tópico é contextual (ex.: "/turmas"). */
  routes: readonly string[];
  title: Text; summary: Text; body: Text;
  /** Se presente, só aparece a quem tem ao menos uma dessas capacidades (evita confundir com ação impossível). */
  audienceCapabilities?: readonly string[];
  /** Conteúdo técnico (ex.: knownAt) só na documentação administrativa. */
  administrative?: boolean;
  links?: readonly { label: Text; to: string }[];
}>;

export type GlossaryTerm = Readonly<{ id: string; term: Text; definition: Text; see?: readonly string[] }>;
export type Flow = Readonly<{ id: string; title: Text; steps: readonly { text: Text; to?: string }[]; audienceCapabilities?: readonly string[] }>;
export type Tour = Readonly<{ id: string; title: Text; audienceCapabilities?: readonly string[]; steps: readonly { route: string; text: Text }[] }>;
export type Release = Readonly<{ version: string; date: string; items: readonly Text[] }>;

const t = (s: string): Text => ({ "pt-BR": s });

export const CONTENT_VERSION = 2;

export const TOPICS: readonly HelpTopic[] = [
  { id: "matricula-participacao-alocacao", version: 1, updatedOn: "2026-10-05", routes: ["/matriculas", "/enturmacoes", "/secretaria", "/alunos"],
    title: t("Matrícula, participação e alocação"),
    summary: t("Três fatos diferentes: vínculo com a escola no ano, participação educacional e lugar numa turma."),
    body: t("A matrícula registra que o estudante está vinculado a uma escola num ano letivo. A participação registra em que percurso educacional ele está nesse vínculo. A alocação registra em qual turma ele está a partir de uma data. Mudar de turma cria nova alocação; o histórico anterior permanece."),
    links: [{ label: t("Matrículas"), to: "/matriculas" }, { label: t("Enturmações"), to: "/enturmacoes" }] },
  { id: "matriz-posicao-correspondencia", version: 1, updatedOn: "2026-10-05", routes: ["/matrizes-curriculares", "/turmas"],
    title: t("Matriz, posição curricular e correspondência"),
    summary: t("A matriz organiza componentes; a posição diz onde o estudante está; a correspondência liga uma à outra."),
    body: t("A matriz curricular é o quadro de componentes e cargas, com versões. A posição curricular é um fato de cada estudante na sua alocação. A correspondência, configurada e homologada, indica qual matriz se aplica a cada posição. O sistema nunca deduz posição ou matriz pelo nome da turma."),
    links: [{ label: t("Matrizes curriculares"), to: "/matrizes-curriculares" }, { label: t("Correspondência"), to: "/matrizes-curriculares/correspondencia" }] },
  { id: "rascunho-versao-efetiva", version: 1, updatedOn: "2026-10-05", routes: ["/central-de-acessos", "/matrizes-curriculares", "/calendario-escolar", "/regras-avaliativas"],
    title: t("Rascunho e versão efetiva"),
    summary: t("Rascunho pode ser revisado; só a versão homologada vale."),
    body: t("Um rascunho não autoriza nada nem produz efeito. Ao homologar, a versão passa a valer a partir da data indicada. Versões homologadas não são editadas: uma mudança cria nova versão, e a anterior permanece no histórico.") },
  { id: "ausencia-nao-e-zero", version: 1, updatedOn: "2026-10-05", routes: ["/mapa-estatistico-rede", "/paineis", "/ciece", "/diario"],
    title: t("Informação ausente não é zero"),
    summary: t("Quando um dado não foi registrado, o sistema mostra \"não informado\"."),
    body: t("Totais só aparecem quando há registros de origem. Se a fonte não existe ou você não pode vê-la, o sistema diz isso por extenso, em vez de mostrar zero.") },
  { id: "capacidade-nao-e-cargo", version: 1, updatedOn: "2026-10-05", routes: ["/central-de-acessos", "/profissionais", "/administracao-geral"],
    title: t("Permissões vêm da atuação, não do cargo"),
    summary: t("O que cada pessoa pode fazer depende da atuação vigente e da política homologada."),
    body: t("Duas pessoas com o mesmo cargo podem ter permissões diferentes. Cargo é só um rótulo; as permissões vêm da política de capacidades homologada aplicada à atuação."),
    audienceCapabilities: ["manter-politica-de-capacidades", "manter-atuacoes"] },
  { id: "configuracao-inicial", version: 1, updatedOn: "2026-10-05", routes: ["/configuracao-inicial"],
    title: t("Configuração inicial da escola"),
    summary: t("Roteiro que confere fatos e leva à tela oficial de cada cadastro."),
    body: t("O roteiro não grava nada. Cada etapa mostra o que já existe e o que falta, com link para a tela onde aquilo é registrado. Uma turma fica pronta para o Diário quando todos os fatos obrigatórios estão presentes.") },
  { id: "data-de-conhecimento", version: 1, updatedOn: "2026-10-05", routes: ["/auditoria", "/secretaria"], administrative: true,
    title: t("Data de validade e data de conhecimento (validOn/knownAt)"),
    summary: t("Consultas temporais respondem \"o que valia em X, segundo o que se sabia em Y\"."),
    body: t("validOn é a data em que o fato vale; knownAt é o instante até o qual o sistema considera registros. Correções retroativas aparecem quando knownAt é posterior ao registro da correção.") },
  { id: "preparacao-2027", version: 1, updatedOn: "2026-10-06", routes: ["/preparacao-2027"],
    title: t("Preparação do ano letivo 2027"),
    summary: t("Lista o que já existe e o que falta para 2027; não grava nada."),
    body: t("Cada etapa aparece como Pronta, Pendente, Bloqueada, Não se aplica ou Desconhecida. Pendente quer dizer que nenhum registro está visível para a sua conta. Bloqueada indica uma dependência anterior ou uma fonte oficial ainda não recebida. Desconhecida quer dizer que sua conta não pode ler aquela informação. Abrir 2027 é um ato separado, feito por quem tem a permissão."),
    links: [{ label: t("Preparação 2027"), to: "/preparacao-2027" }] },
  { id: "central-relatorios", version: 1, updatedOn: "2026-10-06", routes: ["/relatorios"],
    title: t("Central de relatórios"),
    summary: t("Catálogo dos relatórios; a exportação acontece na tela dona de cada um."),
    body: t("A Central mostra definição, fonte e regra de acesso de cada relatório. Relatórios sem fonte ou regra aprovada aparecem como indisponíveis, com o motivo. Documento oficial depende de modelo aprovado, ainda pendente.") },
  { id: "ficha-da-unidade", version: 1, updatedOn: "2026-10-06", routes: ["/unidades"],
    title: t("Ficha da unidade escolar"),
    summary: t("Mostra o cadastro como valia numa data e como era conhecido até outra."),
    body: t("Mudar as datas só muda a leitura; o histórico nunca é reescrito. Campo sem informação aparece como pendência, e não como \"não possui\". Alterações criam nova versão do cadastro.") },
  { id: "diagnostico-tecnico", version: 1, updatedOn: "2026-10-06", routes: ["/diagnostico"], administrative: true,
    title: t("Diagnóstico técnico"),
    summary: t("Painel só de leitura para a administração geral."),
    body: t("Mostra o ambiente, as verificações de integridade e as falhas técnicas recentes desta sessão, cada uma com um código de correlação. Nada pode ser alterado por esta tela.") },
  { id: "por-que-bloqueado", version: 1, updatedOn: "2026-10-06", routes: ["/"],
    title: t("Por que uma ação aparece bloqueada"),
    summary: t("Quase sempre falta uma permissão atribuída, uma regra aprovada ou uma fonte oficial."),
    body: t("O sistema não conclui sem regra aprovada. Quando algo está bloqueado, a tela diz o que falta: sua atuação ainda não tem essa permissão, a regra ainda não foi homologada ou a fonte oficial ainda não chegou. Não é erro seu; procure quem é responsável pela etapa indicada.") },
];

export const GLOSSARY: readonly GlossaryTerm[] = [
  { id: "matricula", term: t("Matrícula"), definition: t("Vínculo do estudante com uma escola num ano letivo."), see: ["alocacao"] },
  { id: "participacao", term: t("Participação educacional"), definition: t("Percurso educacional do estudante dentro da matrícula.") },
  { id: "alocacao", term: t("Alocação"), definition: t("Lugar do estudante numa turma a partir de uma data."), see: ["matricula"] },
  { id: "posicao", term: t("Posição curricular"), definition: t("Onde o estudante está no percurso curricular, registrado na alocação.") },
  { id: "matriz", term: t("Matriz curricular"), definition: t("Quadro versionado de componentes e cargas.") },
  { id: "correspondencia", term: t("Correspondência"), definition: t("Ligação configurada entre posição curricular e matriz.") },
  { id: "homologacao", term: t("Homologação"), definition: t("Ato que torna uma versão efetiva; versões homologadas não são editadas.") },
  { id: "regencia", term: t("Regência"), definition: t("Atribuição de um componente de uma turma a uma atuação docente, com vigência.") },
  { id: "jornada", term: t("Jornada"), definition: t("Organização de tempo definida para a turma.") },
  { id: "grade", term: t("Grade"), definition: t("Blocos de horário da turma, versionados.") },
  { id: "atuacao", term: t("Atuação"), definition: t("Exercício de uma pessoa num escopo, base para as permissões.") },
  { id: "capacidade", term: t("Capacidade"), definition: t("Permissão concreta concedida pela política homologada a uma atuação.") },
  { id: "pessoa", term: t("Pessoa"), definition: t("Pessoa natural registrada uma única vez na rede; a mesma pessoa pode ser estudante, responsável ou profissional.") },
  { id: "vinculo", term: t("Vínculo"), definition: t("Relação registrada entre uma pessoa e a rede, a escola ou uma conta, com vigência.") },
  { id: "turma", term: t("Turma"), definition: t("Grupo da escola num ano letivo, com cadastro versionado; o nome nunca define etapa nem matriz.") },
  { id: "atribuicao", term: t("Atribuição"), definition: t("Designação de uma atuação para um componente de uma turma, com início e fim."), see: ["regencia"] },
  { id: "substituicao", term: t("Substituição"), definition: t("Nova atribuição com vigência própria; não herda a do titular nem apaga a anterior.") },
  { id: "aula-prevista", term: t("Aula prevista"), definition: t("Aula derivada da grade homologada da turma; sem grade, não há aula prevista."), see: ["grade"] },
  { id: "aula-ministrada", term: t("Aula ministrada"), definition: t("Registro feito pelo professor no Diário sobre a aula efetivamente dada.") },
  { id: "conferencia", term: t("Conferência"), definition: t("Revisão registrada por quem tem a permissão, que pode devolver com apontamentos.") },
  { id: "oficializacao", term: t("Oficialização"), definition: t("Ato que torna um registro o resultado oficial; correções seguem por nova versão.") },
  { id: "publicacao", term: t("Publicação"), definition: t("Ato que libera um registro para a família ou para o público; sem ele, nada aparece fora da escola.") },
  { id: "asof", term: t("Vigente em (asOf / validOn)"), definition: t("Data em que se quer saber o que valia.") },
  { id: "knownat", term: t("Conhecido até (knownAt)"), definition: t("Momento até o qual o sistema considera registros feitos.") },
  { id: "natureza", term: t("Natureza do dado"), definition: t("Observado (vindo de fonte), operacional (registro de trabalho), oficial (após ato) ou derivado (calculado de outros); nunca se confundem.") },
];

export const FLOWS: readonly Flow[] = [
  { id: "preparar-escola", title: t("Como preparar uma escola"), audienceCapabilities: ["manter-cadastro-de-turmas", "manter-cadastro-unidade-escolar"],
    steps: [{ text: t("Abra a configuração inicial e selecione a unidade."), to: "/configuracao-inicial" }, { text: t("Siga as pendências de cada turma até o Diário ficar pronto.") }] },
  { id: "chamada", title: t("Como fazer a chamada"),
    steps: [{ text: t("Abra o Diário e escolha a turma."), to: "/diario" }, { text: t("Marque a frequência e conclua; correções depois seguem o registro oficial.") }] },
  { id: "documento", title: t("Como emitir um documento escolar"),
    steps: [{ text: t("Abra Documentos escolares e localize o estudante."), to: "/documentos-escolares" }, { text: t("Confira a prévia; a emissão guarda uma cópia fiel dos dados do momento.") }] },
];

export const TOURS: readonly Tour[] = [
  { id: "docente", title: t("Primeiros passos no Diário"), audienceCapabilities: ["registrar-frequencia", "registrar-aula"],
    steps: [{ route: "/diario", text: t("Suas turmas aparecem conforme suas regências.") }, { route: "/planejamento", text: t("Planeje aulas ligadas à sua regência.") }] },
  { id: "geral", title: t("Conhecendo o SIGEM"),
    steps: [{ route: "/", text: t("O início mostra o que você pode fazer.") }, { route: "/ajuda", text: t("A ajuda explica conceitos e fluxos.") }] },
];

export const RELEASES: readonly Release[] = [
  { version: "2026.10.06", date: "2026-10-06", items: [t("Ajuda nas telas de preparação 2027, relatórios, unidades e diagnóstico; glossário ampliado; guias por perfil.")] },
  { version: "2026.10.05", date: "2026-10-05", items: [t("Central de ajuda com glossário, fluxos e busca."), t("Configuração inicial da escola com checklist do Diário.")] },
];
