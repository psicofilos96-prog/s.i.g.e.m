import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { PublicLayout } from "@/features/public-portal/public-layout";
import { institution } from "@/config/institution";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  nextSteps, normalizeTrackingInput, trackApplication, UNAVAILABLE_TEXT, type Tracking,
} from "@/features/enrollments/family-application-tracking";
import { PROTOCOL_IS_NOT_VACANCY, SITUATION_LABEL as RECEIPT_LABEL } from "@/features/enrollments/application-protocol";
import { SITUATION_LABEL, STATUS_MESSAGE } from "@/features/enrollments/individual-result";
import { DOC_TYPES, fileProblem, NON_BLOCKING_NOTICE, SITUATION_TEXT, uploadApplicationDocument, type DocType } from "@/features/enrollments/application-documents";
import { acceptSeat, ACCEPT_MESSAGE } from "@/features/enrollments/seat-acceptance";
import { readableId } from "@/features/enrollments/ingress-public";

const TITLE = `Acompanhar pedido de matrícula — ${institution.departmentName}`;
const DESC = "Consulte a situação do seu pedido, envie documentos e confirme a vaga com o código do pedido.";

export const Route = createFileRoute("/publico/acompanhar-inscricao")({
  head: () => ({
    meta: [
      { title: TITLE }, { name: "description", content: DESC },
      { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
      { name: "robots", content: "noindex" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackPage,
});

const UPLOAD_TEXT: Record<string, string> = {
  ok: "Arquivo recebido. A escola vai conferir.",
  "ja-registrado": "Este arquivo já tinha sido recebido.",
  invalido: "Envie PDF, JPG ou PNG de até 10 MB.",
  limite: "Limite de envios atingido para este documento. Procure o atendimento.",
  "falha-envio": "O arquivo não chegou. Tente de novo.",
  indisponivel: "Envio indisponível agora. Tente mais tarde.",
};
const br = (d: string) => d.split("-").reverse().join("/");

function TrackPage() {
  // Códigos ficam só na memória da página: nunca na URL nem no armazenamento do navegador.
  const cId = useId(); const kId = useId(); const hId = useId();
  const [code, setCode] = useState(""); const [check, setCheck] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [t, setT] = useState<Tracking | null>(null);
  const creds = useRef<{ code: string; check: string } | null>(null);
  const outRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (t) outRef.current?.focus(); }, [t]);

  async function load() {
    if (!creds.current) return;
    setBusy(true); setErr(null);
    try { setT(await trackApplication(creds.current.code, creds.current.check)); }
    catch { setErr("Consulta indisponível no momento. Tente novamente."); }
    finally { setBusy(false); }
  }
  function submit(e: FormEvent) {
    e.preventDefault(); setT(null);
    creds.current = normalizeTrackingInput(code, check);
    void load();
  }

  return (
    <PublicLayout>
      <Link to="/publico/matriculas" className="inline-flex min-h-11 items-center text-sm text-primary hover:underline print:hidden">← Voltar para matrículas</Link>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">Acompanhar pedido de matrícula</h1>
      <form onSubmit={submit} className="mt-4 grid gap-3 rounded-md border border-border bg-card p-4 print:hidden" noValidate>
        <div className="grid gap-1">
          <Label htmlFor={cId}>Número da inscrição</Label>
          <Input id={cId} value={code} onChange={(e) => setCode(e.target.value)} placeholder="INS-…" autoComplete="off" aria-describedby={hId} className="min-h-11" required />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={kId}>Código de conferência</Label>
          <Input id={kId} value={check} onChange={(e) => setCheck(e.target.value)} placeholder="12 caracteres" autoComplete="off" aria-describedby={hId} className="min-h-11" required />
        </div>
        <p id={hId} className="text-sm text-muted-foreground">Os dois aparecem no comprovante recebido ao enviar o pedido.</p>
        <Button type="submit" disabled={busy} className="min-h-11 sm:w-fit">{busy ? "Consultando…" : "Consultar"}</Button>
      </form>

      <div ref={outRef} tabIndex={-1} role="status" aria-live="polite" className="mt-4 outline-none">
        {err && <p role="alert" className="rounded-md border border-border bg-muted p-3 text-sm text-foreground">{err}</p>}
        {t?.status === "indisponivel" && <p className="rounded-md border border-border bg-muted p-3 text-sm text-foreground">{UNAVAILABLE_TEXT}</p>}
        {t?.status === "ok" && creds.current && <Details t={t} creds={creds.current} reload={load} />}
      </div>
    </PublicLayout>
  );
}

function Details({ t, creds, reload }: { t: Extract<Tracking, { status: "ok" }>; creds: { code: string; check: string }; reload: () => Promise<void> }) {
  const steps = nextSteps(t);
  const r = t.result;
  return (
    <div className="grid gap-4">
      <section aria-labelledby="h-comp" className="rounded-md border border-border bg-card p-4">
        <h2 id="h-comp" className="text-lg font-semibold text-foreground">Comprovante</h2>
        <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-3">
          <dt className="text-muted-foreground">Inscrição</dt><dd className="font-mono text-foreground">{creds.code}</dd>
          <dt className="text-muted-foreground">Protocolo</dt><dd className="font-mono text-foreground">{t.receipt.protocolNumber ?? "Ainda não emitido"}</dd>
          <dt className="text-muted-foreground">Situação</dt><dd className="text-foreground">{RECEIPT_LABEL[t.receipt.situation]}</dd>
          <dt className="text-muted-foreground">Enviado em</dt><dd className="text-foreground">{br(t.receipt.submittedOn)}</dd>
          <dt className="text-muted-foreground">Campanha</dt><dd className="text-foreground">{readableId(t.receipt.campaignKind)} {t.receipt.campaignYear}</dd>
        </dl>
        <p className="mt-2 text-sm text-muted-foreground">{PROTOCOL_IS_NOT_VACANCY}</p>
        <Button variant="outline" className="mt-3 min-h-11 print:hidden" onClick={() => window.print()}>Imprimir comprovante</Button>
      </section>

      <section aria-labelledby="h-sit" className="rounded-md border border-border bg-card p-4">
        <h2 id="h-sit" className="text-lg font-semibold text-foreground">Situação do pedido</h2>
        <p className="mt-2 text-sm text-foreground">{r.status === "ok" && r.situation ? SITUATION_LABEL[r.situation] : r.status === "ok" ? "Em análise." : STATUS_MESSAGE[r.status]}</p>
        {r.status === "ok" && r.justification && <p className="mt-1 text-sm text-muted-foreground">{r.justification}</p>}
        {t.waitlist && <p className="mt-2 text-sm text-foreground">Lista de espera: posição {t.waitlist.position} de {t.waitlist.total}{t.waitlist.wasCalled ? " — você foi chamado" : ""}.</p>}
      </section>

      <section aria-labelledby="h-next" className="rounded-md border border-border bg-card p-4">
        <h2 id="h-next" className="text-lg font-semibold text-foreground">Próximos passos</h2>
        {steps.length ? <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-foreground">{steps.map((s) => <li key={s.id}>{s.text}</li>)}</ol>
          : <p className="mt-2 text-sm text-muted-foreground">Nenhuma ação sua é necessária agora.</p>}
        {steps.some((s) => s.action === "confirmar-vaga") && <Accept creds={creds} onDone={reload} />}
      </section>

      <Documents t={t} creds={creds} onDone={reload} />
    </div>
  );
}

function Accept({ creds, onDone }: { creds: { code: string; check: string }; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    try { const r = await acceptSeat(creds.code, creds.check); setMsg(ACCEPT_MESSAGE[r.status] + (r.receipt ? ` Comprovante: ${r.receipt}` : "")); await onDone(); }
    catch { setMsg(ACCEPT_MESSAGE.indisponivel); }
    finally { setBusy(false); }
  }
  return (
    <div className="mt-3 print:hidden">
      <Button className="min-h-11" disabled={busy} onClick={go}>{busy ? "Registrando…" : "Confirmar interesse na vaga"}</Button>
      <p className="mt-1 text-sm text-muted-foreground">Confirmar o interesse não é a matrícula: a escola confere e a Secretaria faz a matrícula.</p>
      {msg && <p role="status" className="mt-2 text-sm text-foreground">{msg}</p>}
    </div>
  );
}

function Documents({ t, creds, onDone }: { t: Extract<Tracking, { status: "ok" }>; creds: { code: string; check: string }; onDone: () => Promise<void> }) {
  const tId = useId(); const fId = useId();
  const [type, setType] = useState<DocType>("identificacao-estudante");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  const keyRef = useRef(crypto.randomUUID());
  async function send(e: FormEvent) {
    e.preventDefault(); setMsg(null);
    if (!file) { setMsg("Escolha um arquivo."); return; }
    const p = fileProblem(file); if (p) { setMsg(p); return; }
    setBusy(true);
    try {
      const r = await uploadApplicationDocument(creds.code, creds.check, type, file, keyRef.current);
      setMsg(UPLOAD_TEXT[r] ?? UPLOAD_TEXT["indisponivel"]!);
      if (r === "ok" || r === "ja-registrado") { keyRef.current = crypto.randomUUID(); setFile(null); await onDone(); }
    } catch { setMsg(UPLOAD_TEXT["indisponivel"]!); }
    finally { setBusy(false); }
  }
  return (
    <section aria-labelledby="h-docs" className="rounded-md border border-border bg-card p-4">
      <h2 id="h-docs" className="text-lg font-semibold text-foreground">Documentos</h2>
      <p className="mt-1 text-sm text-muted-foreground">{NON_BLOCKING_NOTICE}</p>
      {t.documents.length > 0 && (
        <ul className="mt-2 grid gap-1 text-sm">
          {t.documents.map((d) => <li key={d.docType} className="flex flex-wrap justify-between gap-2 text-foreground"><span>{DOC_TYPES[d.docType]}</span><span className="text-muted-foreground">{SITUATION_TEXT[d.situation]}</span></li>)}
        </ul>
      )}
      <form onSubmit={send} className="mt-3 grid gap-3 print:hidden" noValidate>
        <div className="grid gap-1">
          <Label htmlFor={tId}>Tipo de documento</Label>
          <select id={tId} className="min-h-11 rounded-md border border-input bg-background px-2 text-sm" value={type} onChange={(e) => setType(e.target.value as DocType)}>
            {(Object.keys(DOC_TYPES) as DocType[]).map((k) => <option key={k} value={k}>{DOC_TYPES[k]}</option>)}
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor={fId}>Arquivo (PDF, JPG ou PNG, até 10 MB)</Label>
          <Input id={fId} type="file" accept="application/pdf,image/jpeg,image/png" className="min-h-11" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <Button type="submit" disabled={busy} className="min-h-11 sm:w-fit">{busy ? "Enviando…" : "Enviar documento"}</Button>
        {msg && <p role="status" className="text-sm text-foreground">{msg}</p>}
      </form>
    </section>
  );
}
