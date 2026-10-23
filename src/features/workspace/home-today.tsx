import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell, CalendarDays, CheckCircle2, ListChecks, RefreshCw } from "lucide-react";
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
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const up = () => setOnline(navigator.onLine);
    up(); window.addEventListener("online", up); window.addEventListener("offline", up);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", up); };
  }, []);
  const reads = [nRead, tRead];
  const okCount = reads.filter((r) => r.state === "ok").length;
  const loading = reads.some((r) => r.state === "loading");
  const allOk = online && okCount === reads.length;
  const card = "gradient-border lift rounded-2xl p-5";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section aria-labelledby="hoje">
        <h2 id="hoje" className="eyebrow mb-3">Para você hoje</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          <li className={`${card} tone-blue`}>
            <Link to="/avisos" className="flex items-center gap-2 font-medium hover:text-primary"><Bell className="size-4 text-[var(--tone)]" aria-hidden />Avisos não lidos</Link>
            <p className="mt-3 font-display text-5xl font-medium tabular-nums text-[var(--tone)]" aria-live="polite">{readingValue(nRead)}</p>
            {nRead.state === "error" && <button type="button" onClick={() => void notices.refetch()} className="mt-1 text-xs font-semibold text-primary underline">Tentar novamente</button>}
          </li>
          <li className={`${card} tone-amber`}>
            <Link to="/tarefas" className="flex items-center gap-2 font-medium hover:text-primary"><ListChecks className="size-4 text-[var(--tone)]" aria-hidden />Tarefas e pendências</Link>
            <p className="mt-3 font-display text-5xl font-medium tabular-nums" aria-live="polite">{readingValue(tRead)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{tRead.state === "ok" && tRead.value === 0 ? "Nada em aberto." : "abertas ou em andamento"}</p>
            {tRead.state === "error" && <button type="button" onClick={() => void tasks.refetch()} className="mt-1 text-xs font-semibold text-primary underline">Tentar novamente</button>}
            {tRead.state === "ok" && tRead.partial && <p className="text-xs text-muted-foreground">Leitura parcial: uma das fontes não respondeu.</p>}
          </li>
          <li className={`${card} tone-coral`}>
            <Link to="/calendario-escolar" className="flex items-center gap-2 font-medium hover:text-primary"><CalendarDays className="size-4 text-[var(--tone)]" aria-hidden />Calendário escolar</Link>
            <ol className="mt-3 space-y-2 border-l border-border pl-3 text-sm text-muted-foreground">
              <li>Dias letivos</li><li>Eventos</li><li>Conselhos de classe</li>
            </ol>
          </li>
        </ul>
      </section>
      <aside aria-labelledby="destaques" className="glass gradient-border tone-teal rounded-2xl p-5">
        <h2 id="destaques" className="eyebrow mb-3">Destaques e alertas</h2>
        <div className="flex items-center gap-3">
          <span className={`pulse-dot inline-block size-2.5 rounded-full ${allOk ? "bg-success text-success" : loading ? "bg-muted-foreground text-muted-foreground" : "bg-warning text-warning"}`} aria-hidden />
          <p className="font-medium" role="status">{loading ? "Conferindo conexão…" : allOk ? "Tudo sincronizado" : online ? "Algumas leituras não responderam" : "Sem internet"}</p>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2"><CheckCircle2 className={`size-4 ${online ? "text-success" : "text-warning"}`} aria-hidden />{online ? "Conectado à rede do SIGEM" : "Aguardando conexão"}</li>
          <li className="flex items-center gap-2"><RefreshCw className="size-4" aria-hidden />{okCount} de {reads.length} painéis atualizados agora</li>
        </ul>
      </aside>
    </div>
  );
}
