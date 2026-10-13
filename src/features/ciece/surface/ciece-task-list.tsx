import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CIECE_TASKS } from "./ciece-tasks";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { pathAllowed } from "@/features/authority/nav-capabilities";

/** NCIECE.UX — três tarefas da estação, antes de qualquer número. */
export function CieceTaskList() {
  const authority = useSessionAuthority();
  const ok = (to: string) => authority.status !== "signed-in" || pathAllowed(authority, to);
  const tasks = CIECE_TASKS.map((t) => ({ ...t, links: t.links.filter((l) => ok(l.to)) })).filter((t) => t.links.length);
  return (
      <section aria-labelledby="ciece-tasks-title">
        <h2 id="ciece-tasks-title" className="text-base font-semibold text-foreground">O que você quer fazer?</h2>
        <ol className="mt-2 grid gap-3 md:grid-cols-3">
          {tasks.map((t, i) => (
            <li key={t.id} className="flex min-w-0 flex-col gap-2 rounded-md border border-border/70 bg-card p-4">
              <p className="text-sm font-semibold text-foreground"><span aria-hidden="true" className="mr-1 text-primary">{i + 1}.</span>{t.title}</p>
              <p className="flex-1 text-xs text-muted-foreground">{t.description}</p>
              <div className="flex flex-wrap gap-2">
                {t.links.map((l, j) => (
                  <Button key={l.to} asChild size="sm" variant={j === 0 ? "default" : "outline"}>
                    <Link to={l.to}>{l.label}</Link>
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </section>
  );
}
