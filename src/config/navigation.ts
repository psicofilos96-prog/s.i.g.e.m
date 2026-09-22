import {
  BookOpenText,
  FileText,
  GraduationCap,
  LayoutDashboard,
  School,
  Settings,
  SlidersHorizontal,
  Table2,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type NavigationItem = {
  label: string;
  icon: LucideIcon;
  to?: "/" | "/design-system" | "/unidades" | "/matrizes-curriculares" | "/turmas" | "/alunos";
  badge?: string;
};

// Navegação estritamente provisória para validar o app shell nesta etapa.
// A taxonomia real será definida quando os módulos de negócio forem especificados.
export const provisionalNavigation: Array<{ label: string; items: NavigationItem[] }> = [
  {
    label: "Visão geral",
    items: [{ label: "Início", icon: LayoutDashboard, to: "/" }],
  },
  {
    label: "Gestão institucional",
    items: [
      { label: "Unidades escolares", icon: School, to: "/unidades" },
      { label: "Matrizes curriculares", icon: Table2, to: "/matrizes-curriculares" },
      { label: "Turmas", icon: UsersRound, to: "/turmas" },
      { label: "Alunos", icon: GraduationCap, to: "/alunos" },
    ],
  },
  {
    label: "Áreas demonstrativas",
    items: [
      { label: "Acadêmico", icon: BookOpenText },
      { label: "Pessoas", icon: UsersRound },
      { label: "Relatórios", icon: SlidersHorizontal },
      { label: "Documentos", icon: FileText },
    ],
  },
  {
    label: "Sistema",
    items: [
      { label: "Design system", icon: SlidersHorizontal, to: "/design-system" },
      { label: "Configurações", icon: Settings },
    ],
  },
];
