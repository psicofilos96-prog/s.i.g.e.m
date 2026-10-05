import {
  BookOpen,
  CalendarClock,
  CalendarDays,
  ContactRound,
  GraduationCap,
  Gavel,
  HeartHandshake,
  Inbox,
  Landmark,
  LayoutDashboard,
  NotebookTabs,
  Scale,
  School,
  SlidersHorizontal,
  Table2,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type NavigationRoute =
  | "/"
  | "/design-system"
  | "/unidades"
  | "/matrizes-curriculares"
  | "/turmas"
  | "/alunos"
  | "/profissionais"
  | "/atuacoes-pedagogicas"
  | "/horarios"
  | "/calendario-escolar"
  | "/regras-avaliativas"
  | "/regras-de-situacao"
  | "/diario"
  | "/secretaria"
  | "/orientacao"
  | "/direcao"
  | "/ciece"
  | "/mapa-estatistico"
  | "/identidade-institucional"
  | "/planejamento" | "/avaliacoes-do-professor" | "/inclusao" | "/alimentacao-escolar" | "/familia"
  | "/documentos-escolares" | "/importacoes" | "/departamento-pessoal" | "/referencias-curriculares"
  | "/avaliacao-desempenho" | "/paineis" | "/relatorios" | "/mapa-estatistico-rede" | "/auditoria"
  | "/central-de-acessos" | "/publicacoes" | "/configuracao-inicial" | "/prontidao-piloto" | "/qualidade-dos-dados" | "/quadro-docente" | "/pendencias" | "/ajuda" | "/avisos";

export type NavigationItem = {
  label: string;
  icon: LucideIcon;
  to: NavigationRoute;
  /** Texto de apoio usado na busca do sistema, nunca jargão técnico. */
  hint?: string;
  badge?: string;
};

/**
 * Menu por AMBIENTE DE TRABALHO, com linguagem de quem usa a escola.
 * A composição final continuará derivando do contexto institucional do agente
 * (capacidades, escopo e vigência) — nunca de um nome de cargo no código.
 */
export const provisionalNavigation: Array<{ label: string; items: NavigationItem[] }> = [
  {
    label: "Começar",
    items: [{ label: "Início", icon: LayoutDashboard, to: "/", hint: "Página inicial do SIGEM" }],
  },
  {
    label: "Meus ambientes de trabalho",
    items: [
      { label: "Secretaria", icon: Inbox, to: "/secretaria", hint: "Matrículas, turmas, documentos e pendências" },
      { label: "Sala de aula", icon: NotebookTabs, to: "/diario", hint: "Diário, chamada, notas e fechamentos" },
      { label: "Orientação", icon: HeartHandshake, to: "/orientacao", hint: "Acompanhamento de alunos e casos" },
      { label: "Direção", icon: Gavel, to: "/direcao", hint: "Decisões, atos e conformidade da unidade" },
      { label: "Informação e Estatística", icon: Table2, to: "/ciece", hint: "Indicadores autorizados do CIECE" },
      { label: "Mapa Estatístico", icon: Table2, to: "/mapa-estatistico", hint: "Mapa mensal da escola: conferir e oficializar" },
      { label: "Planejamento", icon: NotebookTabs, to: "/planejamento", hint: "Planos de ensino ligados à regência" },
      { label: "Avaliações do professor", icon: NotebookTabs, to: "/avaliacoes-do-professor", hint: "Provas e itens" },
      { label: "Inclusão", icon: HeartHandshake, to: "/inclusao", hint: "Apoio inclusivo, AEE e mediação" },
      { label: "Alimentação escolar", icon: Inbox, to: "/alimentacao-escolar", hint: "Cardápios, previsão e servido" },
      { label: "Família", icon: HeartHandshake, to: "/familia", hint: "Acompanhamento pelo responsável" },
      { label: "Avisos", icon: Inbox, to: "/avisos", hint: "Avisos recebidos" },
    ],
  },
  {
    label: "Escola e pessoas",
    items: [
      { label: "Alunos", icon: GraduationCap, to: "/alunos", hint: "Consultar e cadastrar alunos" },
      { label: "Turmas", icon: UsersRound, to: "/turmas", hint: "Turmas da unidade" },
      { label: "Profissionais", icon: ContactRound, to: "/profissionais", hint: "Servidores, vínculos e lotações" },
      { label: "Unidades escolares", icon: School, to: "/unidades", hint: "Escolas da rede" },
      { label: "Horários", icon: CalendarClock, to: "/horarios", hint: "Horário de turmas e professores" },
      { label: "Calendário", icon: CalendarDays, to: "/calendario-escolar", hint: "Calendário escolar da rede" },
      { label: "Documentos escolares", icon: BookOpen, to: "/documentos-escolares", hint: "Emissão e verificação" },
      { label: "Importações", icon: Inbox, to: "/importacoes", hint: "Importar com prévia e confirmação" },
      { label: "Departamento pessoal", icon: ContactRound, to: "/departamento-pessoal", hint: "Vida funcional" },
    ],
  },
  {
    label: "Normas da rede",
    items: [
      { label: "Matrizes curriculares", icon: Table2, to: "/matrizes-curriculares", hint: "Componentes e cargas horárias" },
      { label: "Regras de avaliação", icon: Scale, to: "/regras-avaliativas", hint: "Notas, pesos e recuperação" },
      { label: "Regras de resultado", icon: Gavel, to: "/regras-de-situacao", hint: "Aprovação, reprovação e conselho" },
      { label: "Identidade institucional", icon: Landmark, to: "/identidade-institucional", hint: "Brasão e logos" },
      { label: "Referências curriculares", icon: BookOpen, to: "/referencias-curriculares", hint: "BNCC e SAEB com proveniência" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { label: "Painéis", icon: LayoutDashboard, to: "/paineis", hint: "Indicadores por perfil" },
      { label: "Desempenho", icon: Table2, to: "/avaliacao-desempenho", hint: "Avaliações institucionais" },
      { label: "Relatórios", icon: Table2, to: "/relatorios", hint: "Relatórios e exportações" },
      { label: "Mapa da rede", icon: Table2, to: "/mapa-estatistico-rede", hint: "Projeção mensal por escola" },
      { label: "Auditoria", icon: Scale, to: "/auditoria", hint: "Trilha de ações" },
      { label: "Central de acessos", icon: SlidersHorizontal, to: "/central-de-acessos", hint: "Contas, atuações e políticas" },
      { label: "Publicações", icon: Landmark, to: "/publicacoes", hint: "Portal público" },
      { label: "Configuração inicial", icon: School, to: "/configuracao-inicial", hint: "Assistente da escola" },
      { label: "Prontidão para piloto", icon: Gavel, to: "/prontidao-piloto", hint: "Go/no-go" },
      { label: "Qualidade dos dados", icon: Gavel, to: "/qualidade-dos-dados", hint: "Inconsistências" },
      { label: "Quadro docente", icon: Scale, to: "/quadro-docente", hint: "Aulas, cobertura e necessidade" },
      { label: "Pendências", icon: Gavel, to: "/pendencias", hint: "Tramitação" },
      { label: "Ajuda", icon: BookOpen, to: "/ajuda", hint: "Central de ajuda" },
      { label: "Padrões visuais", icon: SlidersHorizontal, to: "/design-system", hint: "Referência de design do SIGEM" },
    ],
  },
];

export const navigationItems: NavigationItem[] = provisionalNavigation.flatMap(
  (group) => group.items,
);

/** Nome amigável da página atual, a partir do caminho. */
export function pageTitleForPath(pathname: string): string {
  const match = navigationItems
    .filter((item) => item.to !== "/")
    .find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
  if (match) return match.label;
  if (pathname === "/") return "Início";
  if (pathname.startsWith("/matriculas")) return "Matrículas";
  if (pathname.startsWith("/enturmacoes")) return "Enturmação";
  if (pathname.startsWith("/transferencias")) return "Transferências";
  if (pathname.startsWith("/vinculos-letivos")) return "Vínculos letivos";
  return "SIGEM";
}
