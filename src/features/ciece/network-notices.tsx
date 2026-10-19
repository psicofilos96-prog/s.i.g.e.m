/**
 * Avisos da rede (CIECE): publicação com imagem opcional e mural das escolas.
 * Gravação só por `publish_network_notice`/`withdraw_network_notice` (capacidade de rede do CIECE);
 * a imagem fica no armazenamento privado `avisos-rede` e é lida por link assinado curto.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatePanel } from "@/components/sigem/patterns";
import { askText } from "@/components/sigem/confirm-action";
import { SIGNED_URL_TTL_SECONDS } from "@/features/privacy/data-inventory";
import { classifySchool } from "@/features/statistical-map/declared-inconsistencies";
import { NETWORK_CATEGORIES, NETWORK_CATEGORY_LABEL, noticeReachesSchool, type NetworkCategory } from "./network-categories";

type Notice = { id: string; title: string; body: string; audience: NetworkCategory; image_path: string | null; published_at: string };
const IMG_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX = 10 * 1024 * 1024;
const ERR: Record<string, string> = {
  "aviso:sem-permissao": "Sua conta não pode publicar avisos da rede.",
  "aviso:imagem-invalida": "A imagem não pôde ser ligada ao aviso. Envie de novo.",
};
const friendly = (m: string) => { const k = Object.keys(ERR).find((x) => m.includes(x)); return k ? ERR[k]! : "Não foi possível concluir agora. Tente de novo."; };

function useNotices() {
  return useQuery({
    queryKey: ["avisos-rede"],
    staleTime: 60_000,
    queryFn: async () => {
      const [n, w] = await Promise.all([
        supabase.from("network_notices").select("id,title,body,audience,image_path,published_at").order("published_at", { ascending: false }).limit(50),
        supabase.from("network_notice_withdrawals").select("notice_id"),
      ]);
      if (n.error) throw new Error(n.error.message);
      const out = new Set((w.data ?? []).map((x) => x.notice_id));
      return ((n.data ?? []) as Notice[]).filter((x) => !out.has(x.id));
    },
  });
}

function NoticeImage({ path }: { path: string }) {
  const q = useQuery({
    queryKey: ["aviso-img", path], staleTime: (SIGNED_URL_TTL_SECONDS - 30) * 1000,
    queryFn: async () => { const r = await supabase.storage.from("avisos-rede").createSignedUrl(path, SIGNED_URL_TTL_SECONDS); if (r.error) throw r.error; return r.data.signedUrl; },
  });
  if (!q.data) return null;
  return <img src={q.data} alt="Imagem do aviso" className="mt-3 max-h-96 w-full rounded-lg border object-contain" loading="lazy" />;
}

function NoticeCard({ n, onWithdraw }: { n: Notice; onWithdraw?: (id: string) => void }) {
  return (
    <li className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">{n.title}</h3>
        <p className="text-xs text-muted-foreground">{new Date(n.published_at).toLocaleDateString("pt-BR")} · {NETWORK_CATEGORY_LABEL[n.audience]}</p>
      </div>
      <p className="mt-2 whitespace-pre-line text-sm">{n.body}</p>
      {n.image_path && <NoticeImage path={n.image_path} />}
      {onWithdraw && <Button size="sm" variant="ghost" className="mt-2" onClick={() => onWithdraw(n.id)}>Retirar do mural</Button>}
    </li>
  );
}

/** Mural da escola: só avisos cujo alcance inclui a escola pela classificação do cadastro. */
export function SchoolNoticeBoard({ schoolId }: { schoolId: string }) {
  const notices = useNotices();
  const cls = useQuery({
    queryKey: ["classificacao-escola", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("institutional_school_record_versions").select("location_kind,administrative_dependency,version_number").eq("school_id", schoolId).order("version_number", { ascending: false }).limit(1);
      return classifySchool(data?.[0]);
    },
  });
  if (!notices.data || !cls.data) return null;
  const mine = notices.data.filter((n) => noticeReachesSchool(n.audience, cls.data)).slice(0, 5);
  if (!mine.length) return null;
  return (
    <section aria-labelledby="mural" className="space-y-3">
      <h2 id="mural" className="font-display text-xl">Avisos da rede</h2>
      <ul className="space-y-3">{mine.map((n) => <NoticeCard key={n.id} n={n} />)}</ul>
    </section>
  );
}

/** Painel do CIECE: escrever, escolher alcance, anexar imagem e publicar. */
export function NetworkNoticeComposer() {
  const qc = useQueryClient();
  const notices = useNotices();
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const [audience, setAudience] = useState<NetworkCategory>("todas");
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [key] = useState(() => crypto.randomUUID());
  const [round, setRound] = useState(0);

  const pick = (f: File | null) => {
    setMsg(null);
    if (f && (!IMG_TYPES.includes(f.type) || f.size > MAX)) { setMsg("Use imagem PNG, JPG ou WEBP de até 10 MB."); return; }
    setFile(f); setPreview(f ? URL.createObjectURL(f) : null);
  };

  const publish = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("aviso:sessao");
      let path: string | null = null;
      if (file) {
        path = `${u.user.id}/${key}-${round}.${file.type.split("/")[1]}`;
        const up = await supabase.storage.from("avisos-rede").upload(path, file, { contentType: file.type, upsert: false });
        if (up.error && !/exists/i.test(up.error.message)) throw new Error(up.error.message);
      }
      const r = await supabase.rpc("publish_network_notice", { _title: title, _body: body, _audience: audience, _image_path: path as string, _key: `${key}-${round}` });
      if (r.error) throw new Error(r.error.message);
    },
    onSuccess: () => { setTitle(""); setBody(""); pick(null); setRound((x) => x + 1); setMsg("Aviso publicado no mural das escolas."); void qc.invalidateQueries({ queryKey: ["avisos-rede"] }); },
    onError: (e: Error) => setMsg(friendly(e.message)),
  });
  const withdraw = useMutation({
    mutationFn: async (id: string) => {
      const reason = await askText("Motivo para retirar o aviso do mural:");
      if (!reason || reason.trim().length < 3) throw new Error("cancelado");
      const r = await supabase.rpc("withdraw_network_notice", { _notice: id, _reason: reason });
      if (r.error) throw new Error(r.error.message);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["avisos-rede"] }),
    onError: (e: Error) => { if (e.message !== "cancelado") setMsg(friendly(e.message)); },
  });

  const ok = title.trim().length >= 3 && body.trim().length >= 3;
  return (
    <div className="space-y-6">
      <form className="space-y-3 rounded-2xl border bg-card p-4" onSubmit={(e) => { e.preventDefault(); if (ok) publish.mutate(); }}>
        <label className="block text-sm font-medium">Título<Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="block text-sm font-medium">Mensagem
          <textarea className="mt-1 min-h-32 w-full rounded-md border border-input bg-background p-2 text-sm" value={body} maxLength={8000} onChange={(e) => setBody(e.target.value)} />
        </label>
        <fieldset>
          <legend className="text-sm font-medium">Para quais escolas</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {NETWORK_CATEGORIES.map((c) => (
              <Button key={c} type="button" size="sm" variant={audience === c ? "default" : "outline"} aria-pressed={audience === c} onClick={() => setAudience(c)}>{NETWORK_CATEGORY_LABEL[c]}</Button>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-medium">Imagem (opcional)
          <input type="file" accept={IMG_TYPES.join(",")} className="mt-1 block text-sm" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        </label>
        {preview && <img src={preview} alt="Prévia da imagem" className="max-h-64 rounded-lg border object-contain" />}
        <Button type="submit" disabled={!ok || publish.isPending}>{publish.isPending ? "Publicando…" : "Publicar no mural das escolas"}</Button>
        {msg && <p role="status" className="text-sm">{msg}</p>}
      </form>
      <section aria-labelledby="publicados" className="space-y-3">
        <h3 id="publicados" className="font-semibold">Avisos publicados</h3>
        {notices.isError ? <StatePanel tone="danger" title="Avisos indisponíveis" description="Não foi possível ler os avisos agora." />
          : !notices.data ? null
          : notices.data.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum aviso publicado.</p>
          : <ul className="space-y-3">{notices.data.map((n) => <NoticeCard key={n.id} n={n} onWithdraw={(id) => withdraw.mutate(id)} />)}</ul>}
      </section>
    </div>
  );
}

/** Mural do professor: avisos que alcançam qualquer escola onde a pessoa tem atuação vigente. */
export function PersonNoticeBoard({ personId }: { personId: string }) {
  const notices = useNotices();
  const cls = useQuery({
    queryKey: ["classificacao-escolas-pessoa", personId],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data: eng } = await supabase.from("institutional_engagements").select("school_id,valid_from,valid_until").eq("person_id", personId).not("school_id", "is", null);
      const ids = [...new Set((eng ?? []).filter((e) => e.valid_from <= today && (!e.valid_until || e.valid_until >= today)).map((e) => e.school_id as string))];
      if (!ids.length) return [];
      const { data } = await supabase.from("institutional_school_record_versions").select("school_id,location_kind,administrative_dependency,version_number").in("school_id", ids).order("version_number", { ascending: false });
      const latest = new Map<string, (typeof data extends (infer R)[] | null ? R : never)>();
      for (const r of data ?? []) if (!latest.has(r.school_id)) latest.set(r.school_id, r);
      return [...latest.values()].map((r) => classifySchool(r));
    },
  });
  if (!notices.data || !cls.data || !cls.data.length) return null;
  const mine = notices.data.filter((n) => cls.data.some((c) => noticeReachesSchool(n.audience, c))).slice(0, 5);
  if (!mine.length) return null;
  return (
    <section aria-labelledby="mural-pessoa" className="space-y-3">
      <h2 id="mural-pessoa" className="font-display text-xl">Avisos da rede</h2>
      <ul className="space-y-3">{mine.map((n) => <NoticeCard key={n.id} n={n} />)}</ul>
    </section>
  );
}
