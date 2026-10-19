import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc-call";
import { userErrorText } from "@/lib/observability/governed-errors";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { Button } from "@/components/ui/button";
import {
  NOTICE_AUDIENCES, NOTICE_IMAGE_MIME, activeNotices, audienceLabel, noticeImageProblem, noticeProblems,
  type NoticeAudience, type NoticeRow,
} from "./school-notices";
import type { VacancyRow } from "./director-summary";

type ClassOption = { id: string; name: string };

/** Avisos da Direção no mural da escola: publicar (sem edição), retirar com motivo, imagem opcional. */
export function SchoolNoticesPanel({ school, year, on }: { school: string; year: string; on: string }) {
  const auth = useSessionAuthority();
  const s = auth.status === "signed-in" ? auth : null;
  const qc = useQueryClient();
  const img = useRef<HTMLInputElement>(null);
  const scope = [s?.user.id, s?.sessionRevision, school];
  const today = on;

  const notices = useQuery({ queryKey: ["school-notices", ...scope], enabled: !!s, retry: false,
    queryFn: () => callRpc<NoticeRow[]>("school_notices_at", { _school: school }) });
  const classes = useQuery({ queryKey: ["notice-classes", ...scope, year, on], enabled: !!s, retry: false,
    queryFn: async () => {
      const rows = await callRpc<(VacancyRow & { name?: string })[]>("secretariat_class_vacancies_at", { _school: school, _year: year, _on: on });
      return (rows ?? []).map((r) => ({ id: r.class_id, name: r.name ?? r.class_id })) as ClassOption[];
    } });

  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const [audience, setAudience] = useState<NoticeAudience>("escola"); const [classId, setClassId] = useState("");
  const [expiresOn, setExpiresOn] = useState(""); const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null); const [ok, setOk] = useState<string | null>(null);

  if (!s) return null;

  const publish = async () => {
    const problems = noticeProblems({ title, body, audience, classId: classId || null, expiresOn: expiresOn || null }, today);
    if (problems.length) { setErr(problems[0] ?? "Revise o aviso."); return; }
    setBusy(true); setErr(null); setOk(null);
    try {
      let imagePath: string | null = null;
      const f = img.current?.files?.[0];
      if (f) {
        const p = noticeImageProblem(f); if (p) throw new Error(p);
        imagePath = `${school}/${crypto.randomUUID()}.${f.type.split("/")[1]}`;
        const up = await supabase.storage.from("avisos-escola").upload(imagePath, f, { contentType: f.type, upsert: false });
        if (up.error) throw new Error(up.error.message);
      }
      await callRpc("direcao_publish_school_notice", {
        _school: school, _title: title, _body: body, _audience: audience,
        _class: audience === "turma" ? classId : null, _image_path: imagePath, _expires_on: expiresOn || null,
        _key: crypto.randomUUID(),
      });
      setTitle(""); setBody(""); setAudience("escola"); setClassId(""); setExpiresOn("");
      if (img.current) img.current.value = "";
      setOk("Aviso publicado no mural da escola.");
      await qc.invalidateQueries({ queryKey: ["school-notices", ...scope] });
    } catch (e) { setErr(userErrorText(e as Error)); } finally { setBusy(false); }
  };

  const withdraw = async (id: string) => {
    const reason = window.prompt("Motivo da retirada (obrigatório):")?.trim();
    if (!reason || reason.length < 3) return;
    setBusy(true); setErr(null);
    try {
      await callRpc("direcao_withdraw_school_notice", { _notice: id, _reason: reason });
      await qc.invalidateQueries({ queryKey: ["school-notices", ...scope] });
    } catch (e) { setErr(userErrorText(e as Error)); } finally { setBusy(false); }
  };

  const active = activeNotices(notices.isError ? null : notices.data ?? null, today);
  const withdrawn = (notices.data ?? []).filter((n) => n.withdrawn);

  return (
    <section aria-label="Avisos da Direção" className="rounded-lg border bg-card p-4 space-y-3">
      <h2 className="font-semibold">Avisos da Direção</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm space-y-1">Título
          <input className="w-full rounded border bg-background px-2 py-1" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></label>
        <label className="text-sm space-y-1">Público
          <select className="w-full rounded border bg-background px-2 py-1" value={audience}
            onChange={(e) => { setAudience(e.target.value as NoticeAudience); setClassId(""); }}>
            {NOTICE_AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select></label>
        {audience === "turma" && (
          <label className="text-sm space-y-1">Turma
            <select className="w-full rounded border bg-background px-2 py-1" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Escolha a turma…</option>
              {(classes.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>)}
        <label className="text-sm space-y-1">Válido até (opcional)
          <input type="date" className="w-full rounded border bg-background px-2 py-1" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} /></label>
      </div>
      <label className="text-sm space-y-1 block">Texto do aviso
        <textarea className="w-full rounded border bg-background px-2 py-1" rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={8000} /></label>
      <input ref={img} type="file" accept={NOTICE_IMAGE_MIME.join(",")} aria-label="Imagem do aviso (opcional)" className="text-sm" />
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={busy} onClick={() => void publish()}>{busy ? "Publicando…" : "Publicar aviso"}</Button>
        <p className="text-xs text-muted-foreground">Aviso publicado não pode ser editado; só retirado com motivo.</p>
      </div>
      {err && <p className="text-xs text-destructive">{err}</p>}
      {ok && <p className="text-xs text-primary">{ok}</p>}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">No mural agora</h3>
        {notices.isLoading ? <p className="text-sm text-muted-foreground">…</p>
          : notices.isError || active == null ? <p className="text-sm text-muted-foreground">Não foi possível ler os avisos.</p>
          : active.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum aviso ativo.</p>
          : active.map((n) => (
            <article key={n.id} className="rounded border p-2 text-sm space-y-1">
              <div className="flex items-center justify-between gap-2">
                <strong>{n.title}</strong>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void withdraw(n.id)}>Retirar</Button>
              </div>
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="text-xs text-muted-foreground">
                {audienceLabel(n.audience)} · publicado em {new Date(n.published_at).toLocaleDateString("pt-BR")}
                {n.expires_on ? ` · vale até ${new Date(n.expires_on + "T12:00:00").toLocaleDateString("pt-BR")}` : ""}
              </p>
            </article>))}
        {withdrawn.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary>Retirados ({withdrawn.length})</summary>
            <ul className="mt-1 space-y-1">
              {withdrawn.map((n) => <li key={n.id}>{n.title} — motivo: {n.withdrawal_reason}</li>)}
            </ul>
          </details>)}
      </div>
    </section>
  );
}
