import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { callRpc } from "@/lib/rpc-call";
import { userErrorText } from "@/lib/observability/governed-errors";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { Button } from "@/components/ui/button";
import { processes, STEP_LABEL, stepProblems, type ReclassStep, type StepRow } from "./reclassification";

/** Processos de reclassificação/avanço da escola. Só a Direção registra; a mudança de turma continua com a Secretaria. */
export function ReclassificationPanel({ school }: { school: string }) {
  const auth = useSessionAuthority();
  const s = auth.status === "signed-in" ? auth : null;
  const q = useQuery({ queryKey: ["reclassifications", s?.user.id, s?.sessionRevision, school], enabled: !!s, retry: false,
    queryFn: () => callRpc<StepRow[]>("school_reclassifications_at", { _school: school }) });
  const [search, setSearch] = useState(""); const [hits, setHits] = useState<{ student_id: string; name: string }[]>([]);
  const [student, setStudent] = useState<{ student_id: string; name: string } | null>(null);
  const [kind, setKind] = useState("reclassificacao");
  const [open, setOpen] = useState<{ process: string; step: ReclassStep } | null>(null);
  const [content, setContent] = useState(""); const [outcome, setOutcome] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  if (!s) return null;
  const find = async () => { try { setHits(await callRpc("direcao_occurrence_students", { _school: school, _q: search }) ?? []); } catch (e) { setErr(userErrorText(e as Error)); } };
  const save = async () => {
    if (!open) return;
    const p = stepProblems(open.step, content, outcome); if (p.length) { setErr(p.join(" ")); return; }
    setBusy(true); setErr(null);
    try {
      await callRpc("direcao_record_reclassification_step", { _school: school, _process: open.process, _step: open.step,
        _student: student?.student_id ?? "", _kind: kind, _content: content, _outcome: outcome, _key: crypto.randomUUID() });
      setOpen(null); setContent(""); setOutcome(null); setStudent(null); setHits([]); await q.refetch();
    } catch (e) { setErr(userErrorText(e as Error)); } finally { setBusy(false); }
  };
  const form = open && (
    <div className="space-y-2 rounded border p-3">
      <p className="text-sm font-medium">{STEP_LABEL[open.step]}</p>
      <textarea className="w-full rounded border bg-background p-2 text-sm" rows={4} value={content} onChange={(e) => setContent(e.target.value)}
        placeholder={open.step === "comissao" ? "Membros da comissão e portaria" : "Registro desta etapa"} />
      {open.step === "despacho" && <div className="flex gap-3 text-sm">
        {["deferido", "indeferido"].map((o) => <label key={o}><input type="radio" checked={outcome === o} onChange={() => setOutcome(o)} /> {o === "deferido" ? "Deferido" : "Indeferido"}</label>)}</div>}
      <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={() => void save()}>Gravar etapa</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(null)}>Cancelar</Button></div>
    </div>);
  const list = q.data ? processes(q.data) : [];
  return (
    <section aria-label="Reclassificação e avanço" className="rounded-lg border bg-card p-4 space-y-3">
      <h2 className="font-semibold">Reclassificação e avanço escolar</h2>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2 text-sm">
          <input className="rounded border bg-background px-2 py-1" placeholder="Nome do estudante" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => void find()}>Buscar</Button>
          <select className="rounded border bg-background px-2 py-1" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="reclassificacao">Reclassificação</option><option value="avanco">Avanço</option></select>
        </div>
        {hits.length > 0 && <ul className="text-sm">{hits.map((h) => <li key={h.student_id}>
          <button type="button" className="text-primary underline" onClick={() => { setStudent(h); setOpen({ process: crypto.randomUUID(), step: "abertura" }); }}>{h.name}</button></li>)}</ul>}
        {open?.step === "abertura" && student && <p className="text-sm">Estudante: {student.name}</p>}
        {open?.step === "abertura" && form}
      </div>
      {q.isLoading ? <p className="text-sm text-muted-foreground">…</p>
        : q.isError ? <p className="text-sm text-muted-foreground">Não foi possível ler os processos.</p>
        : !list.length ? <p className="text-sm text-muted-foreground">Nenhum processo registrado.</p>
        : <ul className="divide-y text-sm">{list.map((p) => (
          <li key={p.id} className="py-2 space-y-1">
            <p className="font-medium">{p.studentName} · {p.kind === "avanco" ? "Avanço" : "Reclassificação"}</p>
            <ol className="text-muted-foreground">{p.steps.map((x) => <li key={x.seq}>{STEP_LABEL[x.step]}{x.outcome ? ` — ${x.outcome}` : ""}: {x.content}</li>)}</ol>
            {p.next ? (open?.process === p.id ? form
              : <Button size="sm" variant="outline" onClick={() => { setOpen({ process: p.id, step: p.next! }); setContent(""); setOutcome(null); }}>Registrar: {STEP_LABEL[p.next]}</Button>)
              : <p className="text-xs">Processo encerrado. A mudança de turma ou etapa é feita pela Secretaria.</p>}
          </li>))}</ul>}
    </section>
  );
}
