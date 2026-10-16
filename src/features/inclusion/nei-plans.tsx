import { humanizeForScreen } from "@/config/technical-codes";
import { LoadingState } from "@/components/sigem/states";
import { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { EMPTY_PLAN, PLAN_FIELDS, PLAN_LABEL, STATUS_LABEL, canWritePlan, planProblem, type PlanContent, type PlanKind, type PlanStatus } from "./nei-aee";

import { DateInput } from "@/components/sigem/date-input";
const rpc = ((fn: string, args?: object) => (supabase as unknown as { rpc: (f: string, a?: object) => unknown }).rpc(fn, args)) as unknown as (f: string, a?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const human = (m: string) => m.includes("stale") ? "Outra pessoa salvou antes. Recarregue." : m.includes("not-authorized") ? "Seu papel não permite esta ação neste plano." : m.includes("plan-content") ? "Conteúdo do plano inválido." : "Não foi possível concluir.";
const input = "w-full rounded-md border border-input bg-background p-2 text-sm";

type Version = { id: string; version: number; status: PlanStatus; content: PlanContent; reason: string | null; recorded_at: string; mine: boolean; comments: { body: string; recorded_at: string; mine: boolean }[] };
type Plan = { id: string; kind: PlanKind; title: string; created_at: string; versions: Version[]; attachments: { id: string; file_name: string; recorded_at: string }[] };

export function planPdf(p: Plan, v: Version, studentName: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" }); const W = 210, M = 18, w = W - 2 * M; let y = 18;
  const line = (t: string, size = 10, bold = false) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size);
    for (const l of doc.splitTextToSize(t, w) as string[]) { if (y > 280) { doc.addPage(); y = 18; } doc.text(l, M, y, { align: "justify", maxWidth: w }); y += size * 0.45; } y += 1.5; };
  line("SECRETARIA MUNICIPAL DE EDUCAÇÃO — NÚCLEO DE EDUCAÇÃO INCLUSIVA", 9, true);
  line(`${PLAN_LABEL[p.kind]} — ${p.title}`, 13, true);
  line(`Estudante: ${studentName} · Versão ${v.version} · ${STATUS_LABEL[v.status]} · ${new Date(v.recorded_at).toLocaleDateString("pt-BR")}`, 9);
  if (v.status !== "concluido") line("DOCUMENTO EM ELABORAÇÃO — não concluído pela equipe.", 9, true);
  for (const f of PLAN_FIELDS) { line(f.label, 11, true); line(v.content[f.key] || "—"); }
  line("Metas", 11, true);
  if (!v.content.metas.length) line("—");
  v.content.metas.forEach((m, i) => line(`${i + 1}. ${m.texto}${m.prazo ? ` (prazo: ${m.prazo.split("-").reverse().join("/")})` : ""}`));
  y += 14; line("_______________________________          _______________________________", 9); line("Responsável pela elaboração                     Coordenação do NEI", 9);
  const n = doc.getNumberOfPages(); for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.text(`Documento restrito (LGPD) · página ${i}/${n}`, W / 2, 290, { align: "center" }); }
  doc.save(`${p.kind}-v${v.version}.pdf`);
}

export function PlansBox({ student, school, studentName }: { student: string; school: string; studentName: string }) {
  const [data, setData] = useState<{ role: "gestao" | "aee"; plans: Plan[] } | null | undefined>(undefined);
  const load = () => void rpc("nei_plans_for", { _student: student, _school: school }).then((r) => setData(r.error ? null : (r.data as typeof data)));
  useEffect(load, [student, school]);
  const [kind, setKind] = useState<PlanKind>("paee"); const [title, setTitle] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  if (data === undefined) return <LoadingState label="Carregando planos…" />;
  if (data === null) return <p className="text-sm text-muted-foreground">Sem acesso aos planos deste estudante.</p>;
  const create = () => void rpc("create_nei_plan", { _student: student, _school: school, _kind: kind, _title: title, _content: EMPTY_PLAN })
    .then((r) => { if (r.error) setMsg(human(r.error.message)); else { setTitle(""); load(); } });
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Planos (PAEE e PEI são documentos distintos)</h2>
      {data.plans.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum plano registrado.</p> : null}
      {data.plans.map((p) => <PlanCard key={p.id} p={p} role={data.role} onSaved={load} studentName={studentName} />)}
      <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3 text-sm">
        <select className={input + " w-auto"} value={kind} onChange={(e) => setKind(e.target.value as PlanKind)} aria-label="Tipo de plano">
          {(["paee", "pei"] as PlanKind[]).filter((k) => canWritePlan(data.role, k)).map((k) => <option key={k} value={k}>{PLAN_LABEL[k]}</option>)}
        </select>
        <input className={input + " w-64"} placeholder="Título (ex.: 2º semestre 2026)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Button size="sm" disabled={title.trim().length < 3} onClick={create}>Criar rascunho</Button>
        {msg ? <span className="text-xs text-destructive">{msg}</span> : null}
      </div>
    </section>
  );
}

function PlanCard({ p, role, onSaved, studentName }: { p: Plan; role: "gestao" | "aee"; onSaved: () => void; studentName: string }) {
  const head = p.versions[p.versions.length - 1]!;
  const [c, setC] = useState<PlanContent>({ ...EMPTY_PLAN, ...head.content });
  const [status, setStatus] = useState<PlanStatus>(head.status); const [reason, setReason] = useState(""); const [comment, setComment] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false); const [viewV, setViewV] = useState(head.version);
  useEffect(() => { setC({ ...EMPTY_PLAN, ...head.content }); setStatus(head.status); setViewV(head.version); }, [head.id]);
  const can = canWritePlan(role, p.kind);
  const problem = planProblem(c) ?? (reason.trim().length < 5 ? "Informe o motivo da nova versão (mín. 5)." : null);
  const save = () => void rpc("record_nei_plan_version", { _plan: p.id, _expected_version: head.version, _status: status, _content: c, _reason: reason })
    .then((r) => { if (r.error) setMsg(human(r.error.message)); else { setReason(""); setMsg(null); onSaved(); } });
  const addComment = () => void rpc("record_nei_plan_comment", { _version: head.id, _body: comment }).then((r) => { if (r.error) setMsg(human(r.error.message)); else { setComment(""); onSaved(); } });
  const upload = async (f: File) => {
    const path = `${p.id}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]+/g, "_").slice(0, 120)}`;
    const r = await rpc("record_nei_plan_attachment", { _plan: p.id, _path: path, _name: f.name.slice(0, 200) });
    if (r.error) { setMsg(human(r.error.message)); return; }
    const u = await supabase.storage.from("nei-planos").upload(path, f, { upsert: false });
    setMsg(u.error ? "Metadado gravado, mas o envio do arquivo falhou; tente enviar de novo." : null); onSaved();
  };
  const openAtt = async (id: string) => {
    const r = await rpc("nei_plan_attachment_open", { _attachment: id }); if (r.error || !r.data) { setMsg("Sem acesso ao anexo."); return; }
    const s = await supabase.storage.from("nei-planos").createSignedUrl(String(r.data), 60); if (s.data) window.open(s.data.signedUrl, "_blank", "noopener");
  };
  const shown = p.versions.find((v) => v.version === viewV) ?? head;
  return (
    <div className="rounded-md border border-border p-3 text-sm space-y-2">
      <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{PLAN_LABEL[p.kind]} — {p.title}</span>
        <StatusBadge tone={head.status === "concluido" ? "success" : head.status === "em-revisao" ? "warning" : "neutral"}>{STATUS_LABEL[head.status]}</StatusBadge>
        <span className="text-xs text-muted-foreground">v{head.version}</span>
        <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>{open ? "Fechar" : "Abrir"}</Button>
        <Button size="sm" variant="outline" onClick={() => planPdf(p, shown, studentName)}>PDF da v{shown.version}</Button></div>
      {open ? <div className="space-y-2">
        <label className="text-xs">Versão exibida no PDF/histórico <select className={input + " w-auto"} value={viewV} onChange={(e) => setViewV(Number(e.target.value))}>{p.versions.map((v) => <option key={v.id} value={v.version}>v{v.version} · {STATUS_LABEL[v.status]}{v.reason ? ` · ${humanizeForScreen(v.reason)}` : ""}</option>)}</select></label>
        {PLAN_FIELDS.map((f) => <label key={f.key} className="block text-xs font-medium">{f.label}<textarea className={input} rows={2} disabled={!can} value={c[f.key]} onChange={(e) => setC({ ...c, [f.key]: e.target.value })} /></label>)}
        <div className="space-y-1"><p className="text-xs font-medium">Metas</p>
          {c.metas.map((m, i) => <div key={i} className="flex gap-1">
            <input className={input} disabled={!can} value={m.texto} aria-label={`Meta ${i + 1}`} onChange={(e) => setC({ ...c, metas: c.metas.map((x, j) => j === i ? { ...x, texto: e.target.value } : x) })} />
            <DateInput className={input + " w-40"} disabled={!can} aria-label={`Prazo da meta ${i + 1}`} value={m.prazo ?? ""} onChange={(e) => setC({ ...c, metas: c.metas.map((x, j) => j === i ? { ...x, prazo: e.target.value || null } : x) })} />
            {can ? <Button size="sm" variant="ghost" onClick={() => setC({ ...c, metas: c.metas.filter((_, j) => j !== i) })}>Remover</Button> : null}</div>)}
          {can ? <Button size="sm" variant="outline" onClick={() => setC({ ...c, metas: [...c.metas, { texto: "", prazo: null }] })}>Adicionar meta</Button> : null}</div>
        {can ? <div className="grid gap-1 sm:grid-cols-3">
          <select className={input} value={status} onChange={(e) => setStatus(e.target.value as PlanStatus)} aria-label="Situação">{(["rascunho", "em-revisao", "concluido"] as PlanStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
          <input className={input} placeholder="Motivo da nova versão" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button size="sm" disabled={!!problem} onClick={save}>Salvar nova versão</Button></div> : null}
        {can && problem ? <p className="text-xs text-muted-foreground">{problem}</p> : null}
        <div className="space-y-1"><p className="text-xs font-medium">Revisão colaborativa (v{head.version})</p>
          {head.comments.map((x, i) => <p key={i} className="text-xs">{new Date(x.recorded_at).toLocaleString("pt-BR")}{x.mine ? " · você" : ""}: {x.body}</p>)}
          <div className="flex gap-1"><input className={input} placeholder="Comentário" value={comment} onChange={(e) => setComment(e.target.value)} /><Button size="sm" disabled={comment.trim().length < 2} onClick={addComment}>Comentar</Button></div></div>
        <div className="space-y-1"><p className="text-xs font-medium">Anexos privados</p>
          {p.attachments.map((a) => <button key={a.id} className="block text-xs underline" onClick={() => void openAtt(a.id)}>{a.file_name}</button>)}
          {can ? <input type="file" aria-label="Anexar arquivo ao plano" className="text-xs" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} /> : null}</div>
      </div> : null}
      {msg ? <p className="text-xs text-destructive">{msg}</p> : null}
    </div>
  );
}
