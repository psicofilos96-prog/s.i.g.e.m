import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { callRpc } from "@/lib/rpc-call";
import { PageHeader } from "@/components/sigem/patterns";
import { AbsenceState, ErrorState, LoadingState } from "@/components/sigem/states";
import { buildPanel, type MediatedStudent } from "./mediator-panel";

function today() { return new Date().toISOString().slice(0, 10); }

/** Meu Painel do Mediador: lê só `inclusion_my_mediated_students` com a sessão. Demais fontes ainda não ligadas = não disponível. */
export function MediatorPanelPage() {
  const [date] = useState(today);
  const [state, setState] = useState<{ kind: "loading" } | { kind: "error"; message: string } | { kind: "ok"; students: MediatedStudent[] }>({ kind: "loading" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState({ kind: "loading" });
    callRpc<MediatedStudent[]>("inclusion_my_mediated_students", { _on: date })
      .then((s) => { if (alive) setState({ kind: "ok", students: s ?? [] }); })
      .catch((e: Error) => { if (alive) setState({ kind: "error", message: e.message }); });
    return () => { alive = false; };
  }, [date, tick]);

  if (state.kind === "loading") return <LoadingState label="Carregando seus estudantes acompanhados…" />;
  if (state.kind === "error") return <ErrorState description="Não foi possível ler suas designações." onRetry={() => setTick((t) => t + 1)} />;

  const p = buildPanel({ date, students: state.students, blocks: null, dayEffect: null, events: null, guidanceCount: null, pendingRecords: null, openRequests: null });
  const cnt = (c: typeof p.guidance) => (c.state === "disponivel" ? String(c.value) : "Não disponível");

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Mediador Escolar" title="Meu Painel" description={`Situação em ${date.split("-").reverse().join("/")}. Só estudantes com designação vigente.`} />
      <section aria-labelledby="h-est" className="space-y-3">
        <h2 id="h-est" className="text-lg font-semibold">Estudantes acompanhados</h2>
        {p.studentsState === "nenhum" ? (
          <AbsenceState kind="nenhum-registro" title="Nenhuma designação vigente" description="Quando o NEI registrar uma designação para você, o estudante aparecerá aqui." />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {p.students.map((s) => (
              <li key={`${s.schoolId}-${s.id}`} className="rounded-lg border border-border bg-card p-3">
                <Link to="/mediador/acompanhamento/$studentId" params={{ studentId: s.id }} className="font-medium text-foreground underline-offset-4 hover:underline">{s.name}</Link>
                <p className="text-sm text-muted-foreground">Turma {s.classId ?? "não registrada"} · Escola {s.schoolId}{s.until ? ` · até ${s.until.split("-").reverse().join("/")}` : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="h-ind" className="grid gap-3 sm:grid-cols-3">
        <h2 id="h-ind" className="sr-only">Pendências</h2>
        {[["Orientações vigentes", p.guidance], ["Registros pendentes", p.pendingRecords], ["Solicitações abertas", p.openRequests]].map(([l, c]) => (
          <div key={l as string} className="rounded-lg border border-border bg-card p-3">
            <p className="text-sm text-muted-foreground">{l as string}</p>
            <p className="text-lg font-semibold text-foreground">{cnt(c as typeof p.guidance)}</p>
          </div>
        ))}
      </section>
      <section aria-labelledby="h-acoes" className="space-y-2">
        <h2 id="h-acoes" className="text-lg font-semibold">Ações rápidas</h2>
        <div className="flex flex-wrap gap-2">
          {p.quickActions.map((a) => a.enabled ? (
            <Link key={a.id} to={a.href} className="inline-flex min-h-11 items-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-accent">{a.label}</Link>
          ) : (
            <span key={a.id} aria-disabled="true" className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm text-muted-foreground">{a.label}</span>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Agenda: aulas vêm só da grade publicada e do calendário oficial; eventos, dos setores responsáveis. Nada clínico é exibido aqui.</p>
      </section>
    </div>
  );
}
