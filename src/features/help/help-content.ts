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

export const CONTENT_VERSION = 1;

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
  { version: "2026.10.05", date: "2026-10-05", items: [t("Central de ajuda com glossário, fluxos e busca."), t("Configuração inicial da escola com checklist do Diário.")] },
];
