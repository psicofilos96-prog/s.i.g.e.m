import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpenText, CalendarCheck, ClipboardCheck, ClipboardList, NotebookPen, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { TEACHER_MENU, activeTeacherItem } from "./teacher-menu";
import { Button } from "@/components/ui/button";

const ICONS = { inicio: CalendarCheck, chamada: ClipboardCheck, registro: NotebookPen, planejamento: ClipboardList, notas: BookOpenText, turmas: UsersRound } as const;

export function TeacherMenuBar({ sidebar = false }: { sidebar?: boolean }) {
  const { pathname, search } = useRouterState({
    select: (s) => ({ pathname: s.location.pathname, search: s.location.search as Record<string, unknown> }),
  });
  const active = activeTeacherItem(pathname, typeof search['aba'] === "string" ? search['aba'] : undefined);
  const context = Object.fromEntries(["data", "unidade", "turma", "componente", "ano", "periodo"].flatMap((k) => typeof search[k] === "string" ? [[k, search[k]]] : []));
  return (
    <nav aria-label="Diário do professor" className={cn(sidebar ? "flex flex-col gap-2 px-3 py-4" : "mb-5 grid grid-cols-3 gap-1 rounded-xl border bg-card p-1.5 sm:flex sm:flex-wrap")}>
      {TEACHER_MENU.map((item) => {
        const Icon = ICONS[item.id as keyof typeof ICONS];
        const on = item.id === active;
        return (
          <Button asChild variant={on ? "default" : "ghost"} key={item.id} className={cn("min-h-11 h-auto whitespace-normal px-2 py-2 text-xs sm:px-4 sm:text-sm", sidebar && "justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground")}>
          <Link
            to={item.to}
            search={{ ...context, ...item.search }}
            aria-current={on ? "page" : undefined}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />{item.label}
          </Link>
          </Button>
        );
      })}
    </nav>
  );
}
