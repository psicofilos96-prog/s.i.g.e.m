import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { governError } from "@/lib/observability/governed-errors";
import { GRADES, PROGRAM_LABEL, bySkill, compatible, entryState, heads, isHomologated, itemScore, textResult, validateInstrumentDraft,
  type LcCriterion, type LcEntry, type LcFormula, type LcHomologation, type LcInstrument, type LcItem, type LcProgram, type LcReview, type ResultValue } from "./local-assessments";

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);
const field = "h-8 rounded-md border bg-background px-2 text-sm";
const area = "w-full rounded-md border bg-background p-2 text-sm";
const fmt = (x: number | null) => (x == null ? "não apurado" : `${x.toFixed(1)}%`);
type Roster = { student_id: string; class_id: string; school_id: string; class_label_snapshot: string | null };
type Data = { inst: LcInstrument[]; hom: LcHomologation[]; ent: LcEntry[]; rev: LcReview[]; roster: Roster[] };

export function LocalAssessmentsPanel() {
  const [data, setData] = useState<Data | { error: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [program, setProgram] = useState<LcProgram>("diagnostica");
  const [sel, setSel] = useState(""); const [cmp, setCmp] = useState(""); const [cls, setCls] = useState("");
  const [draft, setDraft] = useState({ year: 2026, round: "", grade: "5", area: "LP", matrix: "", source: "", items: "", criteria: "", weights: "", formulaSource: "" });

  const load = useCallback(async () => {
    const [a, b, c, d, r] = await Promise.all([
      supabase.from("lc_instrument_versions").select("*").limit(1000), supabase.from("lc_instrument_homologations").select("*").limit(1000),
      supabase.from("lc_entry_versions").select("*").limit(1000), supabase.from("lc_entry_reviews").select("*").limit(1000),
      supabase.from("class_enrollment_episodes").select("student_id, class_id, school_id, class_label_snapshot").limit(1000)]);
    const err = a.error ?? b.error ?? c.error ?? d.error;
    if (err) { setData({ error: governError(err).userMessage }); return; }
    setData({ inst: a.data as unknown as LcInstrument[], hom: b.data as unknown as LcHomologation[], ent: c.data as unknown as LcEntry[], rev: d.data as unknown as LcReview[], roster: (r.data ?? []) as Roster[] });
  }, []);
  useEffect(() => { void load(); }, [load]);
  const d = data && "inst" in data ? data : null;
  const list = useMemo(() => heads(d?.inst ?? []).filter((i) => i.program_key === program).sort((a, b) => a.edition_year - b.edition_year || a.round_label.localeCompare(b.round_label)), [d, program]);
  const inst = list.find((i) => i.id === sel) ?? null;
  const other = list.find((i) => i.id === cmp) ?? null;
  const classes = useMemo(() => [...new Map((d?.roster ?? []).map((r) => [r.class_id, r])).values()], [d]);

  async function save() {
    const pt = program === "producao-textual";
    const items: LcItem[] = pt ? [] : draft.items.split(/\n+/).filter(Boolean).map((l) => { const [n, kind, code, scoring, max] = l.split(";").map((x) => x.trim());
      return { n: Number(n), ref_kind: (kind === "bncc" ? "bncc" : "descritor") as LcItem["ref_kind"], ref_code: code ?? "", scoring: (scoring === "rubrica" ? "rubrica" : "binario") as LcItem["scoring"], ...(scoring === "rubrica" ? { max: Number(max) } : {}) }; });
    const criteria: LcCriterion[] = pt ? draft.criteria.split(/\n+/).filter(Boolean).map((l) => { const [key, label, max] = l.split(";").map((x) => x.trim()); return { key: key ?? "", label: label ?? "", max: Number(max) }; }) : [];
    const formula: LcFormula | null = pt && draft.weights.trim() ? { kind: "soma-ponderada", source: draft.formulaSource,
      weights: Object.fromEntries(draft.weights.split(/\n+/).filter(Boolean).map((l) => { const [k, w] = l.split(";").map((x) => x.trim()); return [k, Number(w)]; })) } : null;
    const errs = validateInstrumentDraft({ program, grade: draft.grade, area: draft.area, round: draft.round, matrix: draft.matrix, source: draft.source, items, criteria, formula });
    if (errs.length) { setMsg(errs.join(" ")); return; }
    const r = await rpc("lc_record_instrument", { _logical: null, _expected_version: 0, _program: program, _year: draft.year, _round: draft.round, _grade: draft.grade, _area: draft.area,
      _matrix: draft.matrix, _items: items, _criteria: criteria, _formula: formula, _source: draft.source, _reason: null });
    setMsg(r.error ? governError(r.error).userMessage : "Instrumento registrado. Outra pessoa precisa homologá-lo antes do lançamento."); if (!r.error) void load();
  }
  async function homologate(id: string, decision: "homologado" | "revogado") {
    const r = await rpc("lc_homologate_instrument", { _version: id, _decision: decision, _reason: decision === "homologado" ? "Instrumento conferido" : "Revogação registrada" });
    setMsg(r.error ? governError(r.error).userMessage : "Decisão registrada."); if (!r.error) void load();
  }

  if (!data) return <SkeletonState />;
  if ("error" in data) return <StatePanel tone="danger" title="Avaliações locais indisponíveis" description={data.error} />;
  const comparison = inst && other ? compatible(inst, other) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">{(Object.keys(PROGRAM_LABEL) as LcProgram[]).map((p) => (
        <Button key={p} size="sm" variant={p === program ? "default" : "outline"} onClick={() => { setProgram(p); setSel(""); setCmp(""); }}>{PROGRAM_LABEL[p]}</Button>))}</div>
      <p className="text-sm text-muted-foreground">Sem lançamento não há resultado; ausente nunca vira zero. Produção Textual mostra os três critérios separados e só calcula resultado geral com fórmula e pesos documentados.</p>
      {msg ? <p role="status" className="text-sm">{msg}</p> : null}

      <section className="rounded-md border p-3 space-y-2">
        <h3 className="font-medium">Instrumentos — {PROGRAM_LABEL[program]}</h3>
        {list.length === 0 ? <StatePanel tone="neutral" title="Nenhum instrumento cadastrado" description="Cadastre a partir do documento oficial do instrumento e da matriz." /> : (
          <table className="w-full text-sm"><caption className="sr-only">Instrumentos</caption><thead><tr><th scope="col">Ano</th><th scope="col">Rodada</th><th scope="col">Série</th><th scope="col">Área</th><th scope="col">Matriz</th><th scope="col">Situação</th><th scope="col">Ações</th></tr></thead>
            <tbody>{list.map((i) => { const ok = isHomologated(i.id, d!.hom); return (
              <tr key={i.id} className={sel === i.id ? "bg-muted" : ""}><td>{i.edition_year}</td><td>{i.round_label}</td><td>{i.grade === "TEC" ? "TEC" : `${i.grade}º`}</td><td>{i.area}</td><td>{i.matrix_ref}</td>
                <td><StatusBadge tone={ok ? "success" : "warning"}>{ok ? "Homologado" : "Não homologado"}</StatusBadge></td>
                <td className="space-x-1"><Button size="sm" variant="outline" onClick={() => setSel(i.id)}>Abrir</Button><Button size="sm" variant="ghost" onClick={() => setCmp(i.id)}>Comparar</Button>
                  <Button size="sm" variant="ghost" onClick={() => homologate(i.id, ok ? "revogado" : "homologado")}>{ok ? "Revogar" : "Homologar"}</Button></td></tr>); })}</tbody></table>)}
        <details><summary className="cursor-pointer text-sm">Cadastrar instrumento</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <label className="text-xs">Ano<input className={field} type="number" value={draft.year} onChange={(e) => setDraft({ ...draft, year: Number(e.target.value) })} /></label>
            <label className="text-xs">Edição/rodada<input className={field} value={draft.round} onChange={(e) => setDraft({ ...draft, round: e.target.value })} /></label>
            <label className="text-xs">Série<select className={field} value={draft.grade} onChange={(e) => setDraft({ ...draft, grade: e.target.value })}>{GRADES.map((g) => <option key={g} value={g}>{g === "TEC" ? "TEC" : `${g}º ano`}</option>)}</select></label>
            <label className="text-xs">Área<select className={field} value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })}><option value="LP">Língua Portuguesa</option><option value="MAT">Matemática</option></select></label>
            <label className="text-xs">Matriz (identificação e versão)<input className={field} value={draft.matrix} onChange={(e) => setDraft({ ...draft, matrix: e.target.value })} /></label>
            <label className="text-xs">Fonte<input className={field} value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} /></label>
            {program === "producao-textual" ? (<>
              <label className="text-xs">Três critérios (chave;nome;máximo por linha)<textarea className={area} rows={3} value={draft.criteria} onChange={(e) => setDraft({ ...draft, criteria: e.target.value })} /></label>
              <label className="text-xs">Pesos do resultado geral (chave;peso; vazio = não configurado)<textarea className={area} rows={3} value={draft.weights} onChange={(e) => setDraft({ ...draft, weights: e.target.value })} /></label>
              <label className="text-xs">Fonte da fórmula<input className={field} value={draft.formulaSource} onChange={(e) => setDraft({ ...draft, formulaSource: e.target.value })} /></label></>) : (
              <label className="text-xs sm:col-span-3">Itens (número;bncc|descritor;código;binario|rubrica;máximo por linha)<textarea className={area} rows={4} value={draft.items} onChange={(e) => setDraft({ ...draft, items: e.target.value })} /></label>)}
          </div>
          <Button className="mt-2" size="sm" onClick={save}>Registrar instrumento</Button>
        </details>
      </section>

      {comparison ? <p className="text-sm" role="status">{comparison.ok ? "Comparação permitida: instrumentos compatíveis." : `Comparação bloqueada: ${comparison.reason}`}</p> : null}

      {inst ? (
        <section className="rounded-md border p-3 space-y-3">
          <h3 className="font-medium">{PROGRAM_LABEL[inst.program_key]} {inst.round_label}/{inst.edition_year} — {inst.grade} · {inst.area}</h3>
          {inst.program_key !== "producao-textual" ? (
            <table className="text-xs"><caption className="text-left">Resultado por habilidade/descritor (faixas &lt;50, 50–&lt;60, 60–&lt;90, ≥90)</caption>
              <thead><tr><th scope="col">Código</th><th scope="col">Itens</th><th scope="col">n</th><th scope="col">Média</th><th scope="col">Faixa</th></tr></thead>
              <tbody>{bySkill(d!.ent, inst).map((s) => <tr key={s.code}><td>{s.code}</td><td>{s.items.join(", ")}</td><td>{s.n}</td><td>{fmt(s.mean)}</td><td>{s.band ?? "—"}</td></tr>)}</tbody></table>
          ) : <p className="text-xs">{inst.general_formula ? `Resultado geral: soma ponderada (fonte: ${inst.general_formula.source}).` : "Resultado geral não configurado: fórmula e pesos não documentados."}</p>}
          <label className="text-xs">Turma <select className={field} value={cls} onChange={(e) => setCls(e.target.value)}><option value="">Selecione…</option>
            {classes.map((c) => <option key={c.class_id} value={c.class_id}>{c.class_label_snapshot ?? c.class_id}</option>)}</select></label>
          {cls ? <EntryGrid inst={inst} students={d!.roster.filter((r) => r.class_id === cls)} entries={d!.ent} reviews={d!.rev} homologated={isHomologated(inst.id, d!.hom)} onDone={(m) => { setMsg(m); void load(); }} /> : null}
        </section>) : null}
    </div>
  );
}

function EntryGrid({ inst, students, entries, reviews, homologated, onDone }: { inst: LcInstrument; students: Roster[]; entries: LcEntry[]; reviews: LcReview[]; homologated: boolean; onDone: (m: string) => void }) {
  const hs = heads(entries.filter((e) => e.instrument_version_id === inst.id));
  const [edit, setEdit] = useState<{ student: string; presence: LcEntry["presence"]; results: Record<string, ResultValue>; reason: string } | null>(null);
  if (!homologated) return <StatePanel tone="warning" title="Instrumento não homologado" description="O lançamento só abre depois da homologação." />;
  if (!students.length) return <p className="text-sm">Nenhum estudante enturmado visível para esta turma.</p>;
  const pt = inst.program_key === "producao-textual";
  const keys = pt ? inst.criteria.map((c) => ({ k: c.key, label: c.label, max: c.max, bin: false })) : inst.items.map((i) => ({ k: String(i.n), label: `Item ${i.n} (${i.ref_code})`, max: i.scoring === "binario" ? 1 : Number(i.max), bin: i.scoring === "binario" }));
  async function save(s: Roster) {
    if (!edit) return; const h = hs.find((x) => x.student_id === s.student_id && x.class_id === s.class_id);
    const r = await rpc("lc_record_entry", { _logical: h?.logical_id ?? null, _expected_version: h?.version ?? 0, _instrument: inst.id, _school: s.school_id, _class: s.class_id, _student: s.student_id,
      _presence: edit.presence, _results: edit.results, _reason: h ? edit.reason : null });
    onDone(r.error ? governError(r.error).userMessage : h ? "Retificação registrada; versão anterior preservada." : "Lançamento registrado."); if (!r.error) setEdit(null);
  }
  async function review(id: string, decision: LcReview["decision"]) {
    const r = await rpc("lc_review_entry", { _entry_version: id, _decision: decision, _note: decision === "devolvido" ? "Devolvido para correção" : null });
    onDone(r.error ? governError(r.error).userMessage : "Revisão registrada.");
  }
  return (
    <table className="w-full text-xs"><caption className="sr-only">Lançamento por estudante</caption>
      <thead><tr><th scope="col">Estudante</th><th scope="col">Presença</th><th scope="col">{pt ? "Critérios / geral" : "Pontos"}</th><th scope="col">Revisão</th><th scope="col">Ações</th></tr></thead>
      <tbody>{students.map((s) => { const h = hs.find((x) => x.student_id === s.student_id && x.class_id === s.class_id);
        const shown = !h ? "—" : pt ? (() => { const t = textResult(h, inst); return `${t.criteria.map((c) => `${c.label}: ${c.value ?? "—"}`).join(" · ")} · geral: ${t.general ?? "não calculado"}`; })() : fmt(itemScore(h, inst.items).pct);
        return (<Fragment key={s.student_id}>
          <tr><td>{s.student_id.slice(0, 8)}</td><td>{h?.presence ?? "sem lançamento"}</td><td>{shown}</td><td>{h ? entryState(h, reviews) : "—"}</td>
            <td className="space-x-1"><Button size="sm" variant="outline" onClick={() => setEdit({ student: s.student_id, presence: h?.presence ?? "presente", results: { ...(h?.results ?? {}) }, reason: "" })}>{h ? "Retificar" : "Lançar"}</Button>
              {h ? <><Button size="sm" variant="ghost" onClick={() => review(h.id, "conferido")}>Conferir</Button><Button size="sm" variant="ghost" onClick={() => review(h.id, "devolvido")}>Devolver</Button><Button size="sm" variant="ghost" onClick={() => review(h.id, "homologado")}>Homologar</Button></> : null}</td></tr>
          {edit?.student === s.student_id ? (<tr><td colSpan={5} className="space-y-2 bg-muted/40 p-2">
            <select aria-label="Presença" className={field} value={edit.presence} onChange={(e) => setEdit({ ...edit, presence: e.target.value as LcEntry["presence"] })}><option value="presente">Presente</option><option value="ausente">Ausente</option><option value="nao-registrado">Presença não registrada</option></select>
            {edit.presence === "presente" ? <div className="flex flex-wrap gap-2">{keys.map((k) => (
              <label key={k.k} className="text-xs">{k.label}
                <select className={field} value={edit.results[k.k] === undefined ? "" : String(edit.results[k.k])} onChange={(e) => { const r = { ...edit.results }; const v = e.target.value;
                  if (v === "") delete r[k.k]; else r[k.k] = v === "nao-aplicado" ? "nao-aplicado" : Number(v); setEdit({ ...edit, results: r }); }}>
                  <option value="">Sem registro</option><option value="nao-aplicado">Não aplicado</option>
                  {Array.from({ length: Math.floor(k.max) + 1 }, (_, i) => <option key={i} value={i}>{k.bin ? (i ? "1 (acerto)" : "0 (erro)") : i}</option>)}</select></label>))}</div> : null}
            {h ? <input aria-label="Motivo da retificação" placeholder="Motivo da retificação (mín. 5)" className={field + " w-full"} value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} /> : null}
            <div className="space-x-1"><Button size="sm" onClick={() => save(s)}>Salvar</Button><Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button></div>
          </td></tr>) : null}
        </Fragment>); })}</tbody></table>
  );
}
