import { SkeletonState } from "@/components/sigem/guidance";
import { askText } from "@/components/sigem/confirm-action";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { ATTACHMENTS_PENDING, AUDIENCE_LABEL, EXTERNAL_DELIVERY_PROVIDER_PENDING, STATE_LABEL, allowedActions, availabilityLine, commMessage, type Audience, type CommState } from "./communication-model";

type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);
const call = async <T,>(fn: string, a: Record<string, unknown>) => { const r = await rpc(fn, a); if (r.error) throw new Error(r.error.message); return r.data as T; };
const db = supabase as unknown as { from: (t: string) => any };
const field = "mt-1 block w-full rounded border bg-background p-2";
const CAPS = ["publicar-comunicacao-escolar", "consultar-comunicacao-escolar", "comunicar-turma-atribuida"];

type Row = { communication_id: string; version: number; title: string; body: string; audience_kind: Audience; class_id: string | null; requires_acknowledgement: boolean; state: CommState; last_sequence: number | null; published_version: number | null; published_at: string | null; reads: number | null; acknowledgements: number | null };
type Hist = { entry_kind: string; number: number; detail: string | null; reason: string | null; recorded_at: string };

async function mySchools() {
  const caps = await call<{ capability_id: string; scope_level: string; school_id: string | null; policy_id: string | null }[]>("effective_scope_capabilities", {});
  const mine = (caps ?? []).filter((c) => c.policy_id && CAPS.includes(c.capability_id));
  if (mine.length === 0) return [];
  const { data } = await db.from("institutional_school_record_versions").select("school_id, official_name, version_number").order("version_number", { ascending: false });
  const names = new Map<string, string>(); for (const r of data ?? []) if (!names.has(r.school_id)) names.set(r.school_id, r.official_name);
  const ids = mine.some((c) => c.scope_level === "rede") ? [...names.keys()] : [...new Set(mine.map((c) => c.school_id!).filter(Boolean))];
  return ids.map((id) => ({ id, name: names.get(id) ?? id })).sort((a, b) => a.name.localeCompare(b.name));
}

export function CommunicationPage() {
  const [schools, setSchools] = useState<{ id: string; name: string }[] | null>(null);
  const [school, setSchool] = useState("");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { mySchools().then((s) => { setSchools(s); if (s.length === 1) setSchool(s[0]!.id); }, (e: Error) => setErr(commMessage(e.message))); }, []);
  return (
    <div className="space-y-6">
      <PageHeader title="Comunicação com as famílias" description="Comunicados da escola publicados dentro do SIGEM para responsáveis autorizados. Rascunho não é visto por ninguém; correções viram nova versão." />
      <StatePanel tone="info" title="Somente dentro do SIGEM" description={`${EXTERNAL_DELIVERY_PROVIDER_PENDING} ${ATTACHMENTS_PENDING}`} />
      {err ? <StatePanel tone="danger" title="Não foi possível abrir" description={err} />
        : !schools ? <SkeletonState label="Carregando" />
        : schools.length === 0 ? <EmptyState title="Sem permissão de comunicação" description="Sua atuação não tem permissão vigente para comunicar ou consultar comunicados." />
        : <>
            <label className="block max-w-md text-sm">Escola<select className={field} value={school} onChange={(e) => setSchool(e.target.value)}><option value="">Escolha…</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            {school && <School key={school} school={school} />}
          </>}
    </div>
  );
}

function School({ school }: { school: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const load = useCallback(async () => { try { setRows(await call<Row[]>("school_communications_at", { _school: school })); } catch (e) { setMsg(commMessage((e as Error).message)); setRows([]); } }, [school]);
  useEffect(() => { void load(); void db.from("institutional_classes").select("id, name").eq("school_id", school).order("name").then((r: any) => setClasses(r.data ?? [])); }, [load, school]);
  const act = async (r: Row, a: "publicacao" | "cancelamento") => {
    const reason = a === "cancelamento" ? await askText("Motivo do cancelamento:") : null;
    if (a === "cancelamento" && !reason?.trim()) return;
    setMsg(null);
    try { await call("record_school_communication_act", { _communication: r.communication_id, _expected_sequence: r.last_sequence ?? 0, _act: a, _reason: reason }); await load(); setMsg(a === "publicacao" ? "Publicado no SIGEM." : "Cancelado."); }
    catch (e) { setMsg(commMessage((e as Error).message)); }
  };
  if (!rows) return <SkeletonState label="Carregando" />;
  const cls = (id: string | null) => classes.find((c) => c.id === id)?.name ?? "turma";
  return (
    <div className="space-y-4">
      <Button onClick={() => setEditing("new")}>Novo comunicado</Button>
      {editing && <Editor school={school} classes={classes} base={editing === "new" ? null : editing} onDone={async (m) => { setEditing(null); setMsg(m); await load(); }} />}
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum comunicado desta escola visível para você.</p> : (
        <ul className="space-y-3">{rows.map((r) => { const can = allowedActions(r.state); return (
          <li key={r.communication_id} className="rounded border p-3 text-sm space-y-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><strong>{r.title}</strong><span className="text-xs">{STATE_LABEL[r.state]}</span></div>
            <p className="text-xs text-muted-foreground">{AUDIENCE_LABEL[r.audience_kind]}{r.audience_kind === "familias-da-turma" ? ` — ${cls(r.class_id)}` : ""} · versão {r.version}{r.published_version ? ` (publicada: ${r.published_version})` : ""}</p>
            <p className="text-xs">{availabilityLine(r.published_at, r.reads, r.acknowledgements, r.requires_acknowledgement)}</p>
            <div className="flex flex-wrap gap-2">
              {can.edit && <Button size="sm" variant="outline" onClick={() => setEditing(r)}>{r.state === "rascunho" ? "Editar" : "Corrigir"}</Button>}
              {can.publish && <Button size="sm" onClick={() => void act(r, "publicacao")}>{r.published_version ? "Publicar correção" : "Publicar"}</Button>}
              {can.cancel && <Button size="sm" variant="ghost" onClick={() => void act(r, "cancelamento")}>Cancelar</Button>}
              <History id={r.communication_id} />
            </div>
          </li>); })}</ul>)}
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </div>
  );
}

function Editor({ school, classes, base, onDone }: { school: string; classes: { id: string; name: string }[]; base: Row | null; onDone: (msg: string) => void }) {
  const [f, setF] = useState({ title: base?.title ?? "", body: base?.body ?? "", audience: (base?.audience_kind ?? "familias-da-escola") as Audience, cls: base?.class_id ?? "", ack: base?.requires_acknowledgement ?? false, reason: "" });
  const [err, setErr] = useState<string | null>(null);
  const correcting = !!base && base.state !== "rascunho";
  const save = async () => {
    setErr(null);
    try {
      await call("record_school_communication_version", { _communication: base?.communication_id ?? null, _expected_version: base?.version ?? null, _school: school,
        _title: f.title, _body: f.body, _audience: f.audience, _class: f.audience === "familias-da-turma" ? f.cls : null, _requires_ack: f.ack, _reason: base ? f.reason : null });
      onDone(correcting ? "Correção salva como rascunho. Publique para que as famílias vejam." : "Rascunho salvo.");
    } catch (e) { setErr(commMessage((e as Error).message)); }
  };
  return (
    <section className="rounded border p-3 text-sm space-y-2" aria-label="Editor de comunicado">
      <label className="block">Título<input className={field} maxLength={200} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <label className="block">Texto<textarea className={field} rows={6} maxLength={8000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label>Para quem<select className={field} value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value as Audience })}>{(Object.keys(AUDIENCE_LABEL) as Audience[]).map((a) => <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>)}</select></label>
        {f.audience === "familias-da-turma" && <label>Turma<select className={field} value={f.cls} onChange={(e) => setF({ ...f, cls: e.target.value })}><option value="">Escolha…</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={f.ack} onChange={(e) => setF({ ...f, ack: e.target.checked })} /> Pedir que o responsável declare ciência</label>
      {base && <label className="block">Motivo da alteração (obrigatório)<input className={field} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></label>}
      <p className="text-xs text-muted-foreground">Os destinatários são calculados na leitura: responsáveis com autorização vigente para comunicados e, na turma, educandos enturmados na data da publicação.</p>
      <Button disabled={!f.title.trim() || !f.body.trim() || (f.audience === "familias-da-turma" && !f.cls) || (!!base && !f.reason.trim())} onClick={() => void save()}>Salvar rascunho</Button>
      {err && <p role="alert">{err}</p>}
    </section>
  );
}

function History({ id }: { id: string }) {
  const [h, setH] = useState<Hist[] | null>(null);
  return (
    <details onToggle={(e) => { if ((e.target as HTMLDetailsElement).open && !h) void call<Hist[]>("school_communication_history", { _communication: id }).then(setH, () => setH([])); }}>
      <summary className="cursor-pointer text-xs underline">Histórico</summary>
      {h && <ul className="mt-1 text-xs">{h.map((x, i) => <li key={i}>{new Date(x.recorded_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {x.entry_kind === "versao" ? `versão ${x.number}: ${x.detail}` : `${x.entry_kind} (${x.detail})`}{x.reason ? ` — ${x.reason}` : ""}</li>)}</ul>}
    </details>
  );
}
