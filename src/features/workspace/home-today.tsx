import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { unreadCount } from "@/features/notifications/notifications-source";
import { loadTasks } from "@/features/tasks/task-source";
import { readingValue, type Reading } from "./home-today-model";

/** "Para você hoje": avisos e tarefas lidos com a sessão (RLS); falha de leitura nunca vira zero. */
export function HomeTodayPanel({ userId }: { userId: string }) {
  const notices = useQuery({ queryKey: ["home-unread", userId], retry: 1, staleTime: 60_000, queryFn: async () => {
    const r = await unreadCount();
    return typeof r === "number" ? r : null;
  } });
  const tasks = useQuery({ queryKey: ["home-tasks", userId], retry: 1, staleTime: 60_000, queryFn: async () => {
    const t = await loadTasks(userId);
    if (t.manualError && t.workflowError) throw new Error("tarefas");
    return { open: t.items.filter((i) => i.status === "aberta" || i.status === "em-andamento" || i.origin === "workflow").length, partial: t.manualError || t.workflowError };
  } });
  const nRead: Reading = notices.isLoading ? { state: "loading" } : notices.isError ? { state: "error" } : { state: "ok", value: notices.data ?? null };
  const tRead: Reading = tasks.isLoading ? { state: "loading" } : tasks.isError ? { state: "error" } : { state: "ok", value: tasks.data?.open ?? null, partial: tasks.data?.partial };
  const today = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());
  const items = [
    { to: "/avisos" as const, label: "Avisos não lidos", r: nRead, retry: () => void notices.refetch() },
    { to: "/tarefas" as const, label: "Tarefas e pendências abertas", r: tRead, retry: () => void tasks.refetch() },
  ];
  return (
    <section aria-labelledby="hoje" className="border-t border-border py-8">
      <p className="eyebrow">Para você hoje</p>
      <h2 id="hoje" className="mt-2 font-display text-2xl first-letter:uppercase">{today}</h2>
      <ul className="mt-5 grid gap-4 sm:grid-cols-3">
        {items.map((i) => (
          <li key={i.to} className="border-l border-border pl-4">
            <Link to={i.to} className="block font-medium hover:text-primary">{i.label}</Link>
            <p className="mt-1 font-display text-3xl tabular-nums" aria-live="polite">{readingValue(i.r)}</p>
            {i.r.state === "error" && <button type="button" onClick={i.retry} className="text-xs font-semibold text-primary underline">Tentar novamente</button>}
            {i.r.state === "ok" && i.r.partial && <p className="text-xs text-muted-foreground">Leitura parcial: uma das fontes não respondeu.</p>}
          </li>
        ))}
        <li className="border-l border-border pl-4">
          <Link to="/calendario-escolar" className="block font-medium hover:text-primary">Calendário escolar</Link>
          <p className="mt-1 text-sm text-muted-foreground">Dias letivos, eventos e conselhos do calendário homologado.</p>
        </li>
      </ul>
    </section>
  );
}
