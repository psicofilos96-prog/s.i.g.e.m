import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc-call";
import { useOwnSchoolId } from "@/features/authority/own-school";
import { readCurrentSchoolNames } from "@/features/units/current-school-names";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/sigem/patterns";
import { LETTER_MESSAGES, officialLetterPdf, type OfficialLetter } from "./official-letter";

const msgOf = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  const k = Object.keys(LETTER_MESSAGES).find((x) => m.includes(x));
  return (k && LETTER_MESSAGES[k]) || "Não foi possível concluir. Tente de novo.";
};
const empty = { recipient: "", subject: "", body: "", signer: "", role: "" };

/** Ofícios da escola: número anual automático, PDF A4, cancelamento com motivo (nunca apagado). */
export function OfficialLettersPage() {
  const own = useOwnSchoolId();
  const nameQ = useQuery({ queryKey: ["own-school-name", own], queryFn: () => readCurrentSchoolNames([own!]), enabled: !!own, staleTime: 600_000 });
  const school = (own && nameQ.data?.get(own)) || "Escola";
  const [list, setList] = useState<OfficialLetter[] | null>(null);
  const [f, setF] = useState(empty);
  const [idem, setIdem] = useState(() => crypto.randomUUID());
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function load() {
    if (!own) return;
    const [l, c] = await Promise.all([
      supabase.from("school_official_letters").select("id,code,recipient,subject,body,signer,signer_role,recorded_at").eq("school_id", own).order("year", { ascending: false }).order("seq", { ascending: false }),
      supabase.from("school_official_letter_cancellations").select("letter_id,reason").eq("school_id", own),
    ]);
    const cx = new Map((c.data ?? []).map((x) => [x.letter_id, x.reason]));
    setList((l.data ?? []).map((x) => ({ ...x, cancelled: cx.get(x.id) ?? null })));
  }
  useEffect(() => { void load(); }, [own]); // eslint-disable-line react-hooks/exhaustive-deps
  const pdf = async (l: OfficialLetter) => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(await officialLetterPdf(l, school)); a.download = `${l.code.replace(/[^\w]+/g, "-")}.pdf`; a.click();
  };
  const issue = async () => {
    setMsg(null); setBusy(true);
    try {
      await callRpc("secretariat_issue_letter", { _recipient: f.recipient, _subject: f.subject, _body: f.body, _signer: f.signer, _signer_role: f.role || null, _idem: idem });
      setF(empty); setIdem(crypto.randomUUID()); setOpen(false); await load();
    } catch (e) { setMsg(msgOf(e)); } finally { setBusy(false); }
  };
  const cancel = async (l: OfficialLetter) => {
    const reason = window.prompt(`Por que cancelar o ${l.code}? (o número continua registrado)`);
    if (!reason) return;
    try { await callRpc("secretariat_cancel_letter", { _letter: l.id, _reason: reason }); await load(); } catch (e) { setMsg(msgOf(e)); }
  };
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const ready = f.recipient.trim().length >= 3 && f.subject.trim().length >= 3 && f.body.trim().length >= 10 && f.signer.trim().length >= 3;
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <PageHeader eyebrow="Secretaria" title="Ofícios" description="O número do ofício é dado pelo sistema, em ordem, a cada ano." />
      <Button onClick={() => setOpen((v) => !v)}>{open ? "Fechar" : "Novo ofício"}</Button>
      {open && (
        <div className="grid gap-3 rounded-md border border-border bg-card p-4 text-sm sm:grid-cols-2">
          <label className="sm:col-span-2">Destinatário<Input className="mt-1" maxLength={300} value={f.recipient} onChange={set("recipient")} placeholder="Ex.: Conselho Tutelar de Itaperuna" /></label>
          <label className="sm:col-span-2">Assunto<Input className="mt-1" maxLength={300} value={f.subject} onChange={set("subject")} /></label>
          <label className="sm:col-span-2">Texto<Textarea className="mt-1 min-h-48" maxLength={20000} value={f.body} onChange={set("body")} /></label>
          <label>Quem assina<Input className="mt-1" maxLength={200} value={f.signer} onChange={set("signer")} /></label>
          <label>Cargo<Input className="mt-1" maxLength={120} value={f.role} onChange={set("role")} placeholder="Ex.: Diretora" /></label>
          <div className="sm:col-span-2"><Button disabled={!ready || busy} onClick={() => void issue()}>Emitir ofício</Button></div>
        </div>)}
      {msg && <p role="status" className="text-sm text-destructive">{msg}</p>}
      {list === null ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : list.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum ofício emitido.</p>
        : <ul className="space-y-2">{list.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card p-3 text-sm">
            <span className={l.cancelled ? "text-muted-foreground" : ""}><b>{l.code}</b> · {l.subject} · {l.recipient}{l.cancelled ? ` · Cancelado: ${l.cancelled}` : ""}</span>
            <span className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => void pdf(l)}>PDF</Button>
              {!l.cancelled && <Button size="sm" variant="ghost" onClick={() => void cancel(l)}>Cancelar</Button>}
            </span>
          </li>))}</ul>}
    </div>
  );
}
