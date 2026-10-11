import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, StatePanel, EmptyState } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { institution } from "@/config/institution";
import { supabase } from "@/integrations/supabase/client";
import { operationalToday } from "@/lib/academic-date";
import { readCurrentSchoolNames, sortedSchoolOptions } from "@/features/units/current-school-names";
import { downloadBlob } from "@/features/reports/report-engine";
import { TEXT_TEMPLATE_CAPABILITY, TEXT_TEMPLATE_DEFAULT, TEXT_TEMPLATE_FIELDS, TEXT_TEMPLATE_KINDS, TEXT_TEMPLATE_LABEL, fillTemplate, templateMessage, validateTextTemplate,
  type TextTemplateKind } from "./text-templates";
import { textDocumentPdf } from "./text-document-pdf";

type Rpc = (f: string, a: object) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (f, a) => (supabase.rpc as unknown as Rpc)(f, a);
async function call<T>(f: string, a: object): Promise<T> { const r = await rpc(f, a); if (r.error) throw new Error(r.error.message); return r.data as T; }
type Version = { id: string; version: number; title: string; body: string; signatures: string[]; reason: string | null; recorded_at: string; by_me: boolean };
type Hit = { enrollment_id: string; student_name: string | null; institutional_identifier: string | null; class_label: string | null };
const dateBr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

/** Editor versionado dos textos-padrão da escola e geração do documento em PDF. Permissão é do banco. */
export function TextTemplatesPage({ initialKind }: { initialKind?: TextTemplateKind }) {
  const [kind, setKind] = useState<TextTemplateKind>(initialKind ?? "atestado-de-escolaridade");
  const [schools, setSchools] = useState<{ id: string; name: string }[] | null>(null);
  const [school, setSchool] = useState("");
  useEffect(() => {
    setSchools(null); setSchool("");
    void call<unknown[]>("school_capability_schools", { _capability: TEXT_TEMPLATE_CAPABILITY[kind] }).then(async (ids) => {
      const allowed = new Set(ids.map((x) => (typeof x === "string" ? x : (Object.values(x as object)[0] as string))));
      const list = sortedSchoolOptions(await readCurrentSchoolNames()).filter((s) => allowed.has(s.id));
      setSchools(list); if (list.length === 1) setSchool(list[0]!.id);
    }, () => setSchools([]));
  }, [kind]);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Documentos da escola" title="Modelos de texto da escola" description="Texto-padrão do Atestado de Escolaridade (Secretaria) e da Ata do Conselho de Classe (Orientação Pedagógica e Direção). Cada gravação vira nova versão; as anteriores ficam no histórico." />
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">Documento<select className="mt-1 block rounded-md border border-input bg-background p-2" value={kind} onChange={(e) => setKind(e.target.value as TextTemplateKind)}>
          {TEXT_TEMPLATE_KINDS.map((k) => <option key={k} value={k}>{TEXT_TEMPLATE_LABEL[k]}</option>)}</select></label>
        {schools && schools.length > 1 && <label className="text-sm">Escola<select className="mt-1 block rounded-md border border-input bg-background p-2" value={school} onChange={(e) => setSchool(e.target.value)}>
          <option value="">Escolha…</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
      </div>
      {schools === null ? <SkeletonState label="Carregando" />
        : schools.length === 0 ? <StatePanel tone="warning" title="Sem permissão para este modelo" description={`Sua conta não tem, em nenhuma escola, a permissão exigida para o ${TEXT_TEMPLATE_LABEL[kind]}.`} />
        : !school ? <EmptyState title="Escolha a escola" description="O modelo é sempre de uma escola." />
        : <Editor key={`${kind}:${school}`} kind={kind} school={school} schoolName={schools.find((s) => s.id === school)?.name ?? ""} />}
    </div>
  );
}

function Editor({ kind, school, schoolName }: { kind: TextTemplateKind; school: string; schoolName: string }) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [err, setErr] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null);
  const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [sigs, setSigs] = useState(""); const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => call<Version[]>("school_text_templates", { _school: school, _kind: kind }).then((v) => {
    setVersions(v); const h = v[0]; const d = TEXT_TEMPLATE_DEFAULT[kind];
    setTitle(h?.title ?? d.title); setBody(h?.body ?? d.body); setSigs((h?.signatures ?? d.signatures).join("; ")); setReason("");
  }, (e: Error) => setErr(templateMessage(e.message)));
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const head = versions?.[0] ?? null;
  const signatures = sigs.split(";").map((s) => s.trim()).filter(Boolean);
  async function save() {
    const v = validateTextTemplate(kind, { title, body, signatures, reason }, !!head); if (v) { setErr(v); return; }
    setBusy(true); setErr(null); setNotice(null);
    try { const n = await call<number>("record_school_text_template", { _school: school, _kind: kind, _expected: head?.id ?? null, _title: title, _body: body, _signatures: signatures, _reason: reason || null });
      setNotice(`Versão ${n} salva.`); await load(); } catch (e) { setErr(templateMessage((e as Error).message)); }
    setBusy(false);
  }
  if (err && !versions) return <StatePanel tone="danger" title="Modelo indisponível" description={err} />;
  if (!versions) return <SkeletonState label="Carregando modelo" />;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label="Editar texto-padrão">
        <h2 className="font-semibold">{head ? `Versão vigente: ${head.version}` : "Ainda sem versão da escola (modelo-base)"}</h2>
        <label className="block text-sm">Título<Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="block text-sm">Texto
          <textarea className="mt-1 block min-h-64 w-full rounded-md border border-input bg-background p-2 font-serif text-sm" value={body} onChange={(e) => setBody(e.target.value)} /></label>
        <p className="text-xs text-muted-foreground">Campos preenchidos automaticamente: {TEXT_TEMPLATE_FIELDS[kind].map((f) => <button key={f.token} type="button" className="mr-1 rounded border px-1 hover:bg-accent" onClick={() => setBody(`${body}{{${f.token}}}`)}>{`{{${f.token}}}`}</button>)}</p>
        <label className="block text-sm">Assinaturas (separe por ponto e vírgula)<Input className="mt-1" value={sigs} onChange={(e) => setSigs(e.target.value)} /></label>
        {head && <label className="block text-sm">Motivo da alteração<Input className="mt-1" value={reason} onChange={(e) => setReason(e.target.value)} /></label>}
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}{notice && <p role="status" className="text-sm">{notice}</p>}
        <Button disabled={busy} onClick={() => void save()}>{head ? "Salvar nova versão" : "Salvar como versão 1"}</Button>
        {versions.length > 0 && <details><summary className="cursor-pointer text-sm">Histórico ({versions.length})</summary>
          <ul className="ml-4 list-disc text-xs">{versions.map((v) => <li key={v.id}>v{v.version} — {new Date(v.recorded_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} — {v.by_me ? "você" : "outra pessoa"}{v.reason ? ` — ${v.reason}` : ""}</li>)}</ul></details>}
      </section>
      <Generate kind={kind} school={school} schoolName={schoolName} head={head} />
    </div>
  );
}

function Generate({ kind, school, schoolName, head }: { kind: TextTemplateKind; school: string; schoolName: string; head: Version | null }) {
  const [q, setQ] = useState(""); const [hits, setHits] = useState<Hit[] | null>(null); const [pick, setPick] = useState<Hit | null>(null);
  const [extra, setExtra] = useState<Record<string, string>>({ ano_letivo: "2026", data: dateBr(operationalToday()) });
  const [msg, setMsg] = useState<string | null>(null);
  const tpl = head ?? { ...TEXT_TEMPLATE_DEFAULT[kind], version: 0 };
  const facts: Record<string, string | null> = { escola: schoolName, ...extra,
    ...(pick ? { "aluno.nome": pick.student_name, "aluno.identificador": pick.institutional_identifier, turma: pick.class_label } : {}) };
  const filled = fillTemplate(tpl.body, facts);
  async function search() {
    setMsg(null); if (q.trim().length < 3) { setMsg("Digite ao menos 3 letras ou o identificador."); return; }
    try { setHits(await call<Hit[]>("secretariat_enrollment_lookup", { _school: school, _query: q.trim(), _on: operationalToday() })); } catch (e) { setMsg(templateMessage((e as Error).message)); }
  }
  async function pdf() {
    const blob = await textDocumentPdf({ headerLines: [institution.governmentName, institution.departmentName, schoolName], title: tpl.title, text: filled.text,
      place: `Itaperuna, ${dateBr(operationalToday())}.`, signatures: tpl.signatures, draft: !head,
      footer: `${TEXT_TEMPLATE_LABEL[kind]} — modelo da escola ${head ? `versão ${head.version}` : "base (rascunho)"}` });
    downloadBlob(`${kind}${pick?.institutional_identifier ? `-${pick.institutional_identifier}` : ""}.pdf`, blob);
  }
  const otherFields = TEXT_TEMPLATE_FIELDS[kind].filter((f) => !["escola", "aluno.nome", "aluno.identificador", ...(kind === "atestado-de-escolaridade" ? ["turma"] : [])].includes(f.token));
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label="Gerar documento">
      <h2 className="font-semibold">Gerar documento em PDF</h2>
      {kind === "atestado-de-escolaridade" && (<>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">Estudante (nome ou identificador)<Input className="mt-1" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} /></label>
          <Button variant="outline" onClick={() => void search()}>Buscar</Button>
        </div>
        {hits && hits.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma matrícula vigente encontrada nesta escola.</p>}
        {hits && hits.length > 0 && <ul className="divide-y rounded border text-sm">{hits.map((h) => (
          <li key={h.enrollment_id} className="flex items-center gap-2 p-2"><span>{h.student_name ?? "Nome não registrado"} · {h.class_label ?? "turma não registrada"}{h.institutional_identifier ? ` · ${h.institutional_identifier}` : ""}</span>
            <Button size="sm" variant={pick?.enrollment_id === h.enrollment_id ? "default" : "ghost"} className="ml-auto" onClick={() => setPick(h)}>Usar</Button></li>))}</ul>}
      </>)}
      <div className="grid gap-2 sm:grid-cols-2">{otherFields.map((f) => (
        <label key={f.token} className="text-sm">{f.label}<Input className="mt-1" value={extra[f.token] ?? ""} onChange={(e) => setExtra({ ...extra, [f.token]: e.target.value })} /></label>))}</div>
      {msg && <p role="alert" className="text-sm text-destructive">{msg}</p>}
      <article aria-label="Prévia" className="rounded border bg-background p-4 font-serif text-sm">
        <p className="text-center font-bold">{tpl.title}</p>
        {filled.text.split(/\n\s*\n/).map((p, i) => <p key={i} className="mt-2 text-justify">{p}</p>)}
      </article>
      {filled.missing.length > 0 && <p className="text-xs text-muted-foreground">Sem dado: {filled.missing.join(", ")} — sai como "[não registrado]".</p>}
      {!head && <p className="text-xs text-muted-foreground">Sem versão salva pela escola, o PDF sai marcado como RASCUNHO.</p>}
      <Button disabled={kind === "atestado-de-escolaridade" && !pick} onClick={() => void pdf()}>Baixar PDF</Button>
    </section>
  );
}
