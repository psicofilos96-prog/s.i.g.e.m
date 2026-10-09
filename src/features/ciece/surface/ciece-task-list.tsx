import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CIECE_TASKS } from "./ciece-tasks";

/** NCIECE.UX — três tarefas da estação, antes de qualquer número. */
export function CieceTaskList() {
  return (
      <section aria-labelledby="ciece-tasks-title">
        <h2 id="ciece-tasks-title" className="text-base font-semibold text-foreground">O que você quer fazer?</h2>
        <ol className="mt-2 grid gap-3 md:grid-cols-3">
          {CIECE_TASKS.map((t, i) => (
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
