import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpenText, CalendarCheck, ClipboardCheck, ClipboardList, NotebookPen, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { TEACHER_MENU, activeTeacherItem } from "./teacher-menu";

const ICONS = { inicio: CalendarCheck, chamada: ClipboardCheck, registro: NotebookPen, planejamento: ClipboardList, notas: BookOpenText, turmas: UsersRound } as const;

export function TeacherMenuBar() {
  const { pathname, aba } = useRouterState({
    select: (s) => ({ pathname: s.location.pathname, aba: (s.location.search as Record<string, unknown>)["aba"] as string | undefined }),
  });
  const active = activeTeacherItem(pathname, aba);
  return (
    <nav aria-label="Diário do professor" className="mb-5 flex gap-2 overflow-x-auto rounded-xl border bg-card p-1.5">
      {TEACHER_MENU.map((item) => {
        const Icon = ICONS[item.id as keyof typeof ICONS];
        const on = item.id === active;
        return (
          <Link
            key={item.id}
            to={item.to as "/diario"}
            search={(item.search ?? {}) as never}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />{item.label}
          </Link>
        );
      })}
    </nav>
  );
}
