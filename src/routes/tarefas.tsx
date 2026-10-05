import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { filterTasks, operationalAgenda, sortTasks, type TaskView } from "@/features/tasks/task-model";
import { loadTasks, recordTaskEvent, type TaskLoad } from "@/features/tasks/task-source";

export const Route = createFileRoute("/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas e agenda operacional — SIGEM" },
      { name: "description", content: "Suas tarefas e as do setor, incluindo pendências de processos, com prazo só quando declarado." },
      { property: "og:title", content: "Tarefas e agenda operacional — SIGEM" },
      { property: "og:description", content: "Tarefas manuais e pendências de processos em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const ERR: Record<string, string> = { forbidden: "Sua conta não pode alterar esta tarefa.", stale: "A tarefa mudou; recarregue.", "reassign-forbidden": "Só quem gere tarefas pode reatribuir.", "assignee-inactive": "A atuação escolhida não está vigente." };

function Page() {
  const [data, setData] = useState<TaskLoad | null>(null);
  const [view, setView] = useState<"minhas" | "setor" | "concluidas" | "agenda">("minhas");
  const [msg, setMsg] = useState<string | null>(null);
  const reload = async () => { const u = await supabase.auth.getUser(); setData(await loadTasks(u.data.user?.id ?? "")); };
  useEffect(() => { void reload(); }, []);

  async function act(t: TaskView, kind: "status" | "comentario", value: string) {
    const r = await recordTaskEvent({ taskId: t.id, kind, expectedSeq: t.seq, ...(kind === "status" ? { status: value } : { comment: value }) });
    setMsg(r.ok ? "Registrado." : ERR[r.error] ?? "Não foi possível registrar.");
    await reload();
  }

  const list = data ? sortTasks(view === "agenda" ? data.items : filterTasks(data.items, { view, myEngagements: data.myEngagements })) : [];
  return (
    <section className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Tarefas e agenda operacional</h1>
      <p className="text-sm text-muted-foreground">Pendências de processos aparecem aqui e só se encerram quando o processo avança. A agenda mostra prazos de tarefas; dias letivos e eventos escolares ficam no <Link to="/calendario-escolar" className="underline">Calendário Escolar</Link>.</p>
      <div role="tablist" className="flex flex-wrap gap-2">
        {(["minhas", "setor", "concluidas", "agenda"] as const).map((v) => (
          <Button key={v} role="tab" aria-selected={view === v} variant={view === v ? "default" : "outline"} size="sm" onClick={() => setView(v)}>
            {{ minhas: "Minhas", setor: "Do setor", concluidas: "Concluídas", agenda: "Agenda" }[v]}
          </Button>
        ))}
      </div>
      {msg && <p role="status" className="text-sm">{msg}</p>}
      {!data && <p role="status">Carregando…</p>}
      {data?.manualError && <p className="text-sm text-muted-foreground">Tarefas manuais não puderam ser lidas agora.</p>}
      {data?.workflowError && <p className="text-sm text-muted-foreground">Pendências de processos não puderam ser lidas agora.</p>}
      {view === "agenda" ? (
        operationalAgenda(list).length === 0 ? <p>Nenhuma tarefa aberta com prazo declarado.</p> :
        operationalAgenda(list).map((d) => (<section key={d.date}><h2 className="font-semibold">{d.date}</h2><ul className="list-disc pl-5 text-sm">{d.tasks.map((t) => <li key={t.key}>{t.title}</li>)}</ul></section>))
      ) : list.length === 0 && data ? <p>Nada aqui.</p> : list.map((t) => <TaskCard key={t.key} t={t} onAct={act} />)}
    </section>
  );
}

function TaskCard({ t, onAct }: { t: TaskView; onAct: (t: TaskView, k: "status" | "comentario", v: string) => void }) {
  const [c, setC] = useState("");
  return (
    <article className="space-y-2 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">{t.title}</h2>
        <span className="text-xs text-muted-foreground">{t.origin === "workflow" ? "Processo" : "Tarefa"} · {t.status}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Prazo: {t.dueOn ?? "não definido"}{t.priority ? ` · Prioridade: ${t.priority.label}` : ""}{t.recurrence ? ` · Repete: ${t.recurrence}` : ""}{t.source && t.origin === "manual" ? ` · Origem: ${t.source.kind}` : ""}
      </p>
      {t.orphan && <p className="text-sm">Sem responsável vigente — precisa ser reatribuída por quem gere as tarefas.</p>}
      {t.origin === "workflow" ? (
        <Link to="/pendencias" className="text-sm underline">Abrir o processo para avançar</Link>
      ) : t.open && (
        <div className="space-y-2">
          <div className="flex gap-2">
            {t.status === "aberta" && <Button size="sm" variant="outline" onClick={() => onAct(t, "status", "em-andamento")}>Iniciar</Button>}
            <Button size="sm" onClick={() => onAct(t, "status", "concluida")}>Concluir</Button>
          </div>
          <Textarea aria-label="Comentário" value={c} onChange={(e) => setC(e.target.value)} maxLength={2000} />
          <Button size="sm" variant="outline" disabled={!c.trim()} onClick={() => { onAct(t, "comentario", c); setC(""); }}>Comentar</Button>
        </div>
      )}
      {t.history.length > 0 && <details className="text-xs"><summary className="cursor-pointer">Histórico ({t.history.length})</summary><ol className="mt-1 list-decimal pl-5">{t.history.map((h) => <li key={h.seq}>{h.recordedAt.slice(0, 16).replace("T", " ")} — {h.kind}{h.status ? `: ${h.status}` : ""}{h.comment ? `: ${h.comment}` : ""}</li>)}</ol></details>}
    </article>
  );
}
