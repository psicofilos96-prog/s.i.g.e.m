import { humanizeForScreen } from "@/config/technical-codes";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { governError } from "@/lib/observability/governed-errors";
import { DEFAULT_WEEKS, axisLabel, bandOf, entryState, heads, isHomologated, roundSummary, score, trajectory, validateInstrumentDraft,
  type ItemResult, type SlEntry, type SlHomologation, type SlInstrument, type SlReview } from "./saber-ler";

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);
const field = "h-8 rounded-md border bg-background px-2 text-sm";
const RES: ItemResult[] = ["acerto", "erro", "em-branco", "nao-aplicado"];
const RES_LABEL: Record<ItemResult, string> = { acerto: "Acerto", erro: "Erro", "em-branco": "Em branco", "nao-aplicado": "Não aplicado" };
const fmt = (x: number | null) => (x == null ? "não apurado" : `${x.toFixed(1)}%`);
type Data = { inst: SlInstrument[]; hom: SlHomologation[]; ent: SlEntry[]; rev: SlReview[]; roster: { student_id: string; class_id: string; school_id: string; class_label_snapshot: string | null }[] };

export function SaberLerPanel() {
  const [data, setData] = useState<Data | { error: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [sel, setSel] = useState<string>("");
  const [cls, setCls] = useState<string>("");
  const [student, setStudent] = useState<string>("");
  const [draft, setDraft] = useState({ year: 2026, grade: 1, week: 4, items: "1:1\n2:1\n3:2", stages: "", bands: "", source: "" });

  const load = useCallback(async () => {
    const [a, b, c, d, r] = await Promise.all([
      supabase.from("sl_instrument_versions").select("*").limit(1000),
      supabase.from("sl_instrument_homologations").select("*").limit(1000),
      supabase.from("sl_entry_versions").select("*").limit(1000),
      supabase.from("sl_entry_reviews").select("*").limit(1000),
      supabase.from("class_enrollment_episodes").select("student_id, class_id, school_id, class_label_snapshot").limit(1000),
    ]);
    const err = a.error ?? b.error ?? c.error ?? d.error;
    if (err) { setData({ error: governError(err).userMessage }); return; }
    setData({ inst: a.data as unknown as SlInstrument[], hom: b.data as unknown as SlHomologation[], ent: c.data as unknown as SlEntry[], rev: d.data as unknown as SlReview[], roster: (r.data ?? []) as Data["roster"] });
  }, []);
  useEffect(() => { void load(); }, [load]);

  const d = data && "inst" in data ? data : null;
  const instHeads = useMemo(() => {
    if (!d) return [];
    const m = new Map<string, SlInstrument>(); for (const i of d.inst) { const c = m.get(i.logical_id); if (!c || c.version < i.version) m.set(i.logical_id, i); }
    return [...m.values()].sort((a, b) => a.edition_year - b.edition_year || a.grade - b.grade || a.week - b.week);
  }, [d]);
  const inst = instHeads.find((i) => i.id === sel) ?? null;
  const classes = useMemo(() => [...new Map((d?.roster ?? []).map((r) => [r.class_id, r])).values()], [d]);
  const students = useMemo(() => (d?.roster ?? []).filter((r) => r.class_id === cls), [d, cls]);

  async function saveInstrument() {
    const items = draft.items.split(/\n+/).filter(Boolean).map((l) => { const [n, a] = l.split(":"); return { n: Number(n), axis: a && a.trim() ? Number(a) : null }; });
    const errs = validateInstrumentDraft({ week: draft.week, grade: draft.grade, items, source: draft.source });
    if (errs.length) { setMsg(errs.join(" ")); return; }
    const stages = draft.stages.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    const bands = draft.bands.trim() ? draft.bands.split(/\n+/).filter(Boolean).map((l) => { const [label, min, max] = l.split(";"); return { label: label!.trim(), min: Number(min), max: max?.trim() ? Number(max) : null }; }) : null;
    const r = await rpc("sl_record_instrument", { _logical: null, _expected_version: 0, _year: draft.year, _grade: draft.grade, _week: draft.week, _items: items, _stages: stages, _bands: bands, _source: draft.source, _reason: null });
    setMsg(r.error ? governError(r.error).userMessage : "Rodada registrada. Precisa ser homologada por outra pessoa antes do lançamento."); if (!r.error) void load();
  }
  async function homologate(id: string, decision: "homologado" | "revogado") {
    const r = await rpc("sl_homologate_instrument", { _version: id, _decision: decision, _reason: decision === "homologado" ? "Instrumento conferido" : "Revogação registrada" });
    setMsg(r.error ? governError(r.error).userMessage : "Decisão registrada."); if (!r.error) void load();
  }

  if (!data) return <SkeletonState />;
  if ("error" in data) return <StatePanel tone="danger" title="Saber Ler indisponível" description={data.error} />;
  const summary = inst && d ? roundSummary(d.ent, inst, d.rev) : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Semanas previstas: {DEFAULT_WEEKS.join(", ")} (outras semanas podem ser cadastradas). Eixos aparecem só pelo número; estágio de escrita é classificação separada da faixa de percentual. Nenhum resultado é exibido sem lançamento.</p>
      {msg ? <p role="status" className="text-sm">{msg}</p> : null}

      <section className="rounded-md border p-3 space-y-2">
        <h3 className="font-medium">Rodadas</h3>
        {instHeads.length === 0 ? <StatePanel tone="neutral" title="Nenhuma rodada cadastrada" description="Cadastre a rodada a partir do instrumento oficial (itens e eixos)." /> : (
          <table className="w-full text-sm"><caption className="sr-only">Rodadas Saber Ler</caption><thead><tr><th scope="col">Ano</th><th scope="col">Série</th><th scope="col">Semana</th><th scope="col">Itens</th><th scope="col">Situação</th><th scope="col">Ações</th></tr></thead>
            <tbody>{instHeads.map((i) => { const ok = isHomologated(i.id, d!.hom); return (
              <tr key={i.id} className={sel === i.id ? "bg-muted" : ""}><td>{i.edition_year}</td><td>{i.grade}º</td><td>{i.week}</td><td>{i.items.length}</td>
                <td><StatusBadge tone={ok ? "success" : "warning"}>{ok ? "Homologada" : "Não homologada"}</StatusBadge></td>
                <td className="space-x-1"><Button size="sm" variant="outline" onClick={() => setSel(i.id)}>Abrir</Button>
                  {ok ? <Button size="sm" variant="ghost" onClick={() => homologate(i.id, "revogado")}>Revogar</Button> : <Button size="sm" variant="ghost" onClick={() => homologate(i.id, "homologado")}>Homologar</Button>}</td></tr>); })}</tbody></table>)}
        <details><summary className="cursor-pointer text-sm">Cadastrar rodada</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <label className="text-xs">Ano<input className={field} type="number" value={draft.year} onChange={(e) => setDraft({ ...draft, year: Number(e.target.value) })} /></label>
            <label className="text-xs">Série<select className={field} value={draft.grade} onChange={(e) => setDraft({ ...draft, grade: Number(e.target.value) })}><option value={1}>1º ano</option><option value={2}>2º ano</option></select></label>
            <label className="text-xs">Semana<input className={field} type="number" value={draft.week} onChange={(e) => setDraft({ ...draft, week: Number(e.target.value) })} /></label>
            <label className="text-xs sm:col-span-1">Itens (número:eixo por linha; eixo vazio = sem eixo)<textarea className="w-full rounded-md border bg-background p-2 text-sm" rows={4} value={draft.items} onChange={(e) => setDraft({ ...draft, items: e.target.value })} /></label>
            <label className="text-xs">Estágios de escrita do documento (um por linha; vazio = não documentado)<textarea className="w-full rounded-md border bg-background p-2 text-sm" rows={4} value={draft.stages} onChange={(e) => setDraft({ ...draft, stages: e.target.value })} /></label>
            <label className="text-xs">Faixas (rótulo;mín;máx por linha; vazio = sem faixa)<textarea className="w-full rounded-md border bg-background p-2 text-sm" rows={4} value={draft.bands} onChange={(e) => setDraft({ ...draft, bands: e.target.value })} /></label>
            <label className="text-xs sm:col-span-3">Fonte (documento oficial)<input className={field + " w-full"} value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} /></label>
          </div>
          <Button className="mt-2" size="sm" onClick={saveInstrument}>Registrar rodada</Button>
        </details>
      </section>

      {inst && summary ? (
        <section className="rounded-md border p-3 space-y-3">
          <h3 className="font-medium">{inst.grade}º ano — semana {inst.week}/{inst.edition_year}</h3>
          <div className="grid gap-2 text-sm sm:grid-cols-4">
            <div>Registrados: {summary.registered}</div><div>Presentes: {summary.present} · Ausentes: {summary.absent} · Sem registro: {summary.notRecorded}</div>
            <div>Participou: {summary.participated} · Parcial: {summary.partial} · Não participou: {summary.notParticipated}</div>
            <div>Média de acerto ({summary.scored} com itens): {fmt(summary.meanPct)}</div>
          </div>
          <figure aria-label="Média por eixo">
            <div className="space-y-1">{summary.axes.map((a) => (
              <div key={a.axis} className="flex items-center gap-2 text-xs"><span className="w-16">{axisLabel(a.axis)}</span>
                <div className="h-3 flex-1 rounded bg-muted">{a.mean != null ? <div className="h-3 rounded bg-primary" style={{ width: `${a.mean}%` }} /> : null}</div>
                <span className="w-28">{fmt(a.mean)} (n={a.n})</span></div>))}</div>
            <table className="mt-2 text-xs"><caption className="text-left">Tabela equivalente</caption><thead><tr><th scope="col">Eixo</th><th scope="col">n</th><th scope="col">Média</th></tr></thead>
              <tbody>{summary.axes.map((a) => <tr key={a.axis}><td>{a.axis}</td><td>{a.n}</td><td>{fmt(a.mean)}</td></tr>)}</tbody></table>
          </figure>
          <p className="text-xs">Estágios de escrita: {summary.stages.length ? summary.stages.map((s) => `${s.stage}: ${s.n}`).join(" · ") : inst.writing_stages.length ? "nenhum registrado" : "não documentados no instrumento"}</p>
          <p className="text-xs">Revisão: rascunho {summary.states.rascunho} · conferido {summary.states.conferido} · devolvido {summary.states.devolvido} · homologado {summary.states.homologado}</p>

          <label className="text-xs">Turma <select className={field} value={cls} onChange={(e) => setCls(e.target.value)}><option value="">Selecione…</option>
            {classes.map((c) => <option key={c.class_id} value={c.class_id}>{c.class_label_snapshot ?? c.class_id}</option>)}</select></label>
          {cls ? <EntryGrid inst={inst} students={students} entries={d!.ent} reviews={d!.rev} homologated={isHomologated(inst.id, d!.hom)} onDone={(m) => { setMsg(m); void load(); }} onPick={setStudent} /> : null}
        </section>) : null}

      {student && d ? (
        <section className="rounded-md border p-3">
          <h3 className="font-medium">Trajetória do estudante (só resultados homologados)</h3>
          {(() => { const t = trajectory(student, d.ent, d.inst, d.rev); return t.length === 0 ? <p className="text-sm">Sem resultado homologado.</p> : (
            <table className="text-sm"><thead><tr><th scope="col">Ano</th><th scope="col">Semana</th><th scope="col">Presença</th><th scope="col">Acerto</th><th scope="col">Faixa</th><th scope="col">Estágio</th></tr></thead>
              <tbody>{t.map((x, i) => <tr key={i}><td>{x.year}</td><td>{x.week}</td><td>{x.presence}</td><td>{fmt(x.pct)}</td><td>{x.band ?? "sem faixa configurada"}</td><td>{x.stage ?? "—"}</td></tr>)}</tbody></table>); })()}
          <p className="mt-2 text-xs text-muted-foreground">Plano de intervenção: registre na aba Intervenções com origem "Diagnóstico registrado" e a referência do lançamento.</p>
        </section>) : null}
    </div>
  );
}

function EntryGrid({ inst, students, entries, reviews, homologated, onDone, onPick }: { inst: SlInstrument; students: { student_id: string; class_id: string; school_id: string }[];
  entries: SlEntry[]; reviews: SlReview[]; homologated: boolean; onDone: (m: string) => void; onPick: (s: string) => void }) {
  const hs = heads(entries.filter((e) => e.instrument_version_id === inst.id));
  const [edit, setEdit] = useState<{ student: string; presence: SlEntry["presence"]; participation: string; items: Record<string, ItemResult>; stage: string; reason: string } | null>(null);
  if (!homologated) return <StatePanel tone="warning" title="Rodada não homologada" description="O lançamento só abre depois da homologação do instrumento." />;
  if (!students.length) return <p className="text-sm">Nenhum estudante enturmado visível para esta turma.</p>;
  async function save(s: { student_id: string; class_id: string; school_id: string }) {
    if (!edit) return;
    const head = hs.find((h) => h.student_id === s.student_id && h.class_id === s.class_id);
    const r = await rpc("sl_record_entry", { _logical: head?.logical_id ?? null, _expected_version: head?.version ?? 0, _instrument: inst.id, _school: s.school_id, _class: s.class_id, _student: s.student_id,
      _presence: edit.presence, _participation: edit.presence === "presente" ? edit.participation || null : null, _items: edit.items, _stage: edit.stage || null, _reason: head ? edit.reason : null });
    onDone(r.error ? governError(r.error).userMessage : head ? "Retificação registrada (nova versão; anterior preservada)." : "Lançamento registrado."); if (!r.error) setEdit(null);
  }
  async function review(id: string, decision: SlReview["decision"]) {
    const note = decision === "devolvido" ? "Devolvido para correção" : null;
    const r = await rpc("sl_review_entry", { _entry_version: id, _decision: decision, _note: note });
    onDone(r.error ? governError(r.error).userMessage : "Revisão registrada.");
  }
  return (
    <table className="w-full text-xs"><caption className="sr-only">Lançamento por estudante</caption>
      <thead><tr><th scope="col">Estudante</th><th scope="col">Presença</th><th scope="col">Acerto</th><th scope="col">Faixa</th><th scope="col">Estágio</th><th scope="col">Revisão</th><th scope="col">Ações</th></tr></thead>
      <tbody>{students.map((s) => { const h = hs.find((x) => x.student_id === s.student_id && x.class_id === s.class_id); const sc = h ? score(h, inst.items) : null;
        const editing = edit?.student === s.student_id;
        return (<Fragment key={s.student_id}>
          <tr><td><button className="underline" onClick={() => onPick(s.student_id)}>{s.student_id.slice(0, 8)}</button></td>
            <td>{h?.presence ?? "sem lançamento"}{h?.participation ? ` · ${h.participation}` : ""}</td><td>{sc ? fmt(sc.pct) : "—"}</td>
            <td>{sc ? bandOf(sc.pct, inst.percent_bands) ?? "sem faixa configurada" : "—"}</td><td>{h?.writing_stage ?? "—"}</td><td>{h ? entryState(h, reviews) : "—"}</td>
            <td className="space-x-1"><Button size="sm" variant="outline" onClick={() => setEdit({ student: s.student_id, presence: h?.presence ?? "presente", participation: h?.participation ?? "participou", items: { ...(h?.item_results ?? {}) }, stage: h?.writing_stage ?? "", reason: "" })}>{h ? "Retificar" : "Lançar"}</Button>
              {h ? <><Button size="sm" variant="ghost" onClick={() => review(h.id, "conferido")}>Conferir</Button><Button size="sm" variant="ghost" onClick={() => review(h.id, "devolvido")}>Devolver</Button><Button size="sm" variant="ghost" onClick={() => review(h.id, "homologado")}>Homologar</Button></> : null}</td></tr>
          {editing && edit ? (<tr><td colSpan={7} className="space-y-2 bg-muted/40 p-2">
            <div className="flex flex-wrap gap-2">
              <select aria-label="Presença" className={field} value={edit.presence} onChange={(e) => setEdit({ ...edit, presence: e.target.value as SlEntry["presence"] })}><option value="presente">Presente</option><option value="ausente">Ausente</option><option value="nao-registrado">Presença não registrada</option></select>
              {edit.presence === "presente" ? <select aria-label="Participação" className={field} value={edit.participation} onChange={(e) => setEdit({ ...edit, participation: e.target.value })}><option value="participou">Participou</option><option value="participou-parcialmente">Participou parcialmente</option><option value="nao-participou">Não participou</option></select> : null}
              {edit.presence === "presente" && inst.writing_stages.length ? <select aria-label="Estágio de escrita" className={field} value={edit.stage} onChange={(e) => setEdit({ ...edit, stage: e.target.value })}><option value="">Estágio não avaliado</option>{inst.writing_stages.map((x) => <option key={x}>{x}</option>)}</select> : null}
            </div>
            {edit.presence === "presente" ? <div className="flex flex-wrap gap-2">{inst.items.map((it) => (
              <label key={it.n} className="text-xs">Item {it.n} ({axisLabel(it.axis)})
                <select className={field} value={edit.items[String(it.n)] ?? ""} onChange={(e) => { const items = { ...edit.items }; if (e.target.value) items[String(it.n)] = e.target.value as ItemResult; else delete items[String(it.n)]; setEdit({ ...edit, items }); }}>
                  <option value="">Sem registro</option>{RES.map((r) => <option key={r} value={r}>{RES_LABEL[r]}</option>)}</select></label>))}</div> : null}
            {h ? <input aria-label="Motivo da retificação" placeholder="Motivo da retificação (mín. 5)" className={field + " w-full"} value={humanizeForScreen(edit.reason)} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} /> : null}
            <div className="space-x-1"><Button size="sm" onClick={() => save(s)}>Salvar</Button><Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button></div>
          </td></tr>) : null}
        </Fragment>); })}</tbody></table>
  );
}
