import {
  BookOpenText,
  FileText,
  LayoutDashboard,
  Settings,
  SlidersHorizontal,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type NavigationItem = {
  label: string;
  icon: LucideIcon;
  to?: "/" | "/design-system";
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
