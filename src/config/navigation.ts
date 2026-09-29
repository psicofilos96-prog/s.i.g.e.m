import {
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
  | "/identidade-institucional";

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
    ],
  },
  {
    label: "Normas da rede",
    items: [
      { label: "Matrizes curriculares", icon: Table2, to: "/matrizes-curriculares", hint: "Componentes e cargas horárias" },
      { label: "Regras de avaliação", icon: Scale, to: "/regras-avaliativas", hint: "Notas, pesos e recuperação" },
      { label: "Regras de resultado", icon: Gavel, to: "/regras-de-situacao", hint: "Aprovação, reprovação e conselho" },
      { label: "Identidade institucional", icon: Landmark, to: "/identidade-institucional", hint: "Brasão e logos" },
    ],
  },
  {
    label: "Sistema",
    items: [
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
