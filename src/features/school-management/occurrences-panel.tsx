import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { callRpc } from "@/lib/rpc-call";
import { userErrorText } from "@/lib/observability/governed-errors";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { downloadBlob } from "@/features/reports/report-engine";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/sigem/patterns";
import { DEFAULT_MEASURES, DEFAULT_SEVERITIES, draftProblems, occurrenceNumber, threads, type OccurrenceRow, type Party } from "./occurrences";
import { occurrencePdf } from "./occurrences-pdf";

const field = "mt-1 block w-full rounded-md border border-input bg-background p-2 text-sm";
const dt = (s: string) => new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

/** Histórico de Ocorrências ("Caderno Negro"): só a Direção da escola registra; nada se edita nem se exclui. */
export function OccurrencesPanel({ school, schoolName }: { school: string; schoolName: string }) {
  const auth = useSessionAuthority();
  const signed = auth.status === "signed-in" ? auth : null;
  const canWrite = signed?.principal?.station === "direcao_escolar" && signed.principal.schoolId === school;
  const key = ["school-occurrences", signed?.user.id, signed?.sessionRevision, school];
  const q = useQuery({ queryKey: key, enabled: !!signed, retry: false,
    queryFn: () => callRpc<OccurrenceRow[]>("school_occurrences_at", { _school: school }) });
  const [form, setForm] = useState<null | { addendumOf: string | null }>(null);
  if (!signed) return null;
  if (q.isError && /not-authorized/.test(String(q.error))) return null;
  return (
    <section aria-label="Histórico de ocorrências" className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div><h2 className="font-semibold">Histórico de ocorrências</h2>
          <p className="text-xs text-muted-foreground">Registro permanente: nada é editado nem excluído. Correções e fatos novos entram como adendo.</p></div>
        {canWrite && !form && <Button onClick={() => setForm({ addendumOf: null })}>Nova ocorrência</Button>}
      </div>
      {form && <OccurrenceForm school={school} addendumOf={form.addendumOf} onDone={() => setForm(null)} queryKey={key} />}
      {q.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : q.isError ? <StatePanel tone="danger" title="Não foi possível ler as ocorrências" description={userErrorText(q.error as Error)} />
        : (q.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum registro de ocorrência nesta escola.</p>
        : <ul className="space-y-3">{threads(q.data ?? []).map((t) => (
          <li key={t.original.id} className="rounded-md border p-3 text-sm space-y-1">
            <div className="flex flex-wrap justify-between gap-2"><strong>Nº {occurrenceNumber(t.original)} — {t.original.kind}</strong>
              <span className="text-xs">{t.original.severity} · {dt(t.original.occurred_at)}</span></div>
            <p className="text-xs">Envolvidos: {t.original.parties.filter((p) => p.role === "envolvido").map((p) => p.label).join(", ") || "—"}</p>
            <p className="whitespace-pre-wrap">{t.original.narrative}</p>
            {t.original.measures.length > 0 && <p className="text-xs">Providências: {t.original.measures.join("; ")}</p>}
            {t.addenda.map((a) => <div key={a.id} className="ml-3 border-l pl-3"><p className="text-xs font-semibold">Adendo {occurrenceNumber(a)} · {dt(a.created_at)}</p><p className="whitespace-pre-wrap">{a.narrative}</p></div>)}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => downloadBlob(`ocorrencia-${occurrenceNumber(t.original).replace("/", "-")}.pdf`, occurrencePdf(t, schoolName))}>PDF A4</Button>
              {canWrite && <Button size="sm" variant="outline" onClick={() => setForm({ addendumOf: t.original.id })}>Registrar adendo</Button>}
            </div>
          </li>))}</ul>}
    </section>
  );
}

function OccurrenceForm({ school, addendumOf, onDone, queryKey }: { school: string; addendumOf: string | null; onDone: () => void; queryKey: unknown[] }) {
  const qc = useQueryClient();
  const [idem] = useState(() => crypto.randomUUID());
  const [d, setD] = useState({ occurredAt: "", severity: DEFAULT_SEVERITIES[0] as string, kind: addendumOf ? "Adendo" : "", narrative: "", witnesses: "", measures: [] as string[] });
  const [parties, setParties] = useState<Party[]>([]);
  const [search, setSearch] = useState(""); const [hits, setHits] = useState<{ student_id: string; name: string }[]>([]);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const problems = draftProblems({ ...d, parties, addendumOf });
  const find = async () => { try { setHits(await callRpc("direcao_occurrence_students", { _school: school, _q: search }) ?? []); } catch (e) { setErr(userErrorText(e as Error)); } };
  const add = (p: Party) => setParties((x) => x.some((y) => y.label === p.label && y.role === p.role) ? x : [...x, p]);
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await callRpc("direcao_record_occurrence", { _school: school, _occurred_at: new Date(d.occurredAt).toISOString(), _severity: d.severity, _kind: d.kind,
        _narrative: d.narrative, _measures: d.measures, _witnesses: d.witnesses, _parties: parties, _addendum_of: addendumOf, _idempotency_key: idem });
      await qc.invalidateQueries({ queryKey }); onDone();
    } catch (e) { setErr(userErrorText(e as Error)); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3 rounded-md border p-3">
      <h3 className="text-sm font-semibold">{addendumOf ? "Adendo à ocorrência" : "Nova ocorrência"}</h3>
      <p className="text-xs text-muted-foreground">Depois de gravado, o registro não pode ser alterado nem excluído.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">Data e hora do fato<input type="datetime-local" className={field} value={d.occurredAt} onChange={(e) => setD({ ...d, occurredAt: e.target.value })} /></label>
        <label className="text-sm">Gravidade<select className={field} value={d.severity} onChange={(e) => setD({ ...d, severity: e.target.value })}>{DEFAULT_SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="text-sm">Tipo<input className={field} value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value })} placeholder="Ex.: agressão, dano ao patrimônio" /></label>
      </div>
      <label className="block text-sm">Relato circunstanciado<textarea className={field} rows={5} value={d.narrative} onChange={(e) => setD({ ...d, narrative: e.target.value })} /></label>
      <fieldset className="text-sm"><legend className="font-medium">Providências adotadas</legend>
        <div className="mt-1 grid gap-1 sm:grid-cols-2">{DEFAULT_MEASURES.map((m) => <label key={m} className="flex gap-2"><input type="checkbox" checked={d.measures.includes(m)}
          onChange={(e) => setD({ ...d, measures: e.target.checked ? [...d.measures, m] : d.measures.filter((x) => x !== m) })} />{m}</label>)}</div></fieldset>
      <div className="space-y-2 text-sm">
        <p className="font-medium">Envolvidos e testemunhas</p>
        <div className="flex gap-2"><input className={field} placeholder="Nome do estudante (mín. 3 letras)" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button type="button" variant="outline" className="mt-1" onClick={find} disabled={search.trim().length < 3}>Buscar</Button></div>
        {hits.length > 0 && <ul className="space-y-1">{hits.map((h) => <li key={h.student_id} className="flex gap-2 items-center">{h.name}
          <Button size="sm" variant="ghost" onClick={() => add({ kind: "estudante", ref: h.student_id, label: h.name, role: "envolvido" })}>Envolvido</Button>
          <Button size="sm" variant="ghost" onClick={() => add({ kind: "estudante", ref: h.student_id, label: h.name, role: "testemunha" })}>Testemunha</Button></li>)}</ul>}
        <div className="flex gap-2"><input className={field} placeholder="Servidor ou outra pessoa (nome)" value={other} onChange={(e) => setOther(e.target.value)} />
          <Button type="button" variant="outline" className="mt-1" disabled={!other.trim()} onClick={() => { add({ kind: "outro", ref: null, label: other.trim(), role: "envolvido" }); setOther(""); }}>Envolvido</Button>
          <Button type="button" variant="outline" className="mt-1" disabled={!other.trim()} onClick={() => { add({ kind: "outro", ref: null, label: other.trim(), role: "testemunha" }); setOther(""); }}>Testemunha</Button></div>
        {parties.length > 0 && <ul className="text-xs">{parties.map((p, i) => <li key={i}>{p.label} — {p.role} <button className="underline" onClick={() => setParties(parties.filter((_, j) => j !== i))}>remover</button></li>)}</ul>}
      </div>
      {problems.length > 0 && <ul className="text-xs text-muted-foreground">{problems.map((p) => <li key={p}>• {p}</li>)}</ul>}
      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="flex gap-2"><Button onClick={save} disabled={busy || problems.length > 0}>{busy ? "Gravando…" : "Gravar registro"}</Button>
        <Button variant="outline" onClick={onDone} disabled={busy}>Cancelar</Button></div>
    </div>
  );
}
