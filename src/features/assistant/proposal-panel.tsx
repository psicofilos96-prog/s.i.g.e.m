import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { proposeAction, confirmProposal } from "./proposals.functions";

type Ready = { proposal: { kind: string; payload: Record<string, unknown>; rationale: string }; label: string; writer: string | null; fingerprint: string; preview: { label: string; value: string }[] };

const ERRORS: Record<string, string> = {
  proibida: "Esse tipo de alteração não pode ser preparado pelo assistente (notas, frequência, permissões, homologação, exclusão ou dado sensível).",
  "ia-indisponivel": "O assistente não está disponível agora.",
  "tipo-nao-permitido": "O assistente sugeriu algo fora das ações permitidas; nada foi preparado.",
  "payload-invalido": "A proposta veio incompleta ou com campos inesperados; nada foi preparado.",
  "envelope-invalido": "A proposta veio em formato inválido; nada foi preparado.",
  "sem-json": "O assistente não devolveu uma proposta.", "json-invalido": "O assistente não devolveu uma proposta válida.",
  "escopo-divergente": "A proposta mira outra escola que não a do contexto; recusada.",
  "sem-capability": "Sua conta não pode executar essa ação.",
  "previa-divergente": "A proposta mudou desde a prévia; gere de novo.",
  "writer-recusou": "O registro oficial recusou a ação; nada foi alterado.",
  "auditoria-falhou": "A ação foi feita, mas o registro de auditoria falhou.",
};

export function ProposalPanel({ schoolId }: { schoolId: string | null }) {
  const propose = useServerFn(proposeAction);
  const confirm = useServerFn(confirmProposal);
  const [req, setReq] = useState("");
  const [ready, setReady] = useState<Ready | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const route = "/assistente";

  async function run() {
    setBusy(true); setMsg(null); setReady(null);
    try {
      const r = await propose({ data: { request: req, route, schoolId } });
      if (r.ok) setReady(r as Ready); else setMsg(ERRORS[r.error] ?? "Não foi possível preparar.");
    } finally { setBusy(false); }
  }
  async function decide(decision: "confirmar" | "descartar") {
    if (!ready) return;
    setBusy(true);
    try {
      const r = await confirm({ data: { proposal: ready.proposal, fingerprint: ready.fingerprint, decision, route, schoolId } });
      if (!r.ok) setMsg(ERRORS[r.error] ?? "Recusado.");
      else setMsg(decision === "descartar" ? "Proposta descartada; nada foi alterado." : ready.writer ? "Ação registrada pelo caminho oficial, marcada como assistida por IA." : "Pronto. Nada foi gravado: use o conteúdo abaixo na tela correspondente.");
      if (decision === "descartar" || ready.writer) setReady(null);
    } finally { setBusy(false); }
  }

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4" aria-labelledby="prop-h">
      <h2 id="prop-h" className="text-lg font-semibold">Preparar uma ação</h2>
      <p className="text-sm text-muted-foreground">O assistente só prepara. Nada muda sem a sua confirmação, e a confirmação passa pelas mesmas permissões de sempre.</p>
      <Textarea aria-label="O que você quer preparar" value={req} onChange={(e) => setReq(e.target.value)} maxLength={800} placeholder="Ex.: rascunhe um comunicado sobre a reunião de pais" />
      <Button onClick={run} disabled={busy || req.trim().length < 3}>Preparar proposta</Button>
      {msg && <p role="status" className="text-sm">{msg}</p>}
      {ready && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="font-medium">{ready.label} <span className="text-xs text-muted-foreground">(sugerido por IA)</span></p>
          {ready.proposal.rationale && <p className="text-sm text-muted-foreground">{ready.proposal.rationale}</p>}
          <dl className="space-y-1 text-sm">{ready.preview.map((l) => (<div key={l.label}><dt className="font-medium">{l.label}</dt><dd className="whitespace-pre-wrap">{l.value}</dd></div>))}</dl>
          <p className="text-xs text-muted-foreground">{ready.writer ? "Ao confirmar, o registro oficial será gravado em seu nome." : "Esta proposta não grava nada."} Prévia {ready.fingerprint.slice(0, 12)}…</p>
          <div className="flex gap-2"><Button onClick={() => decide("confirmar")} disabled={busy}>Confirmar</Button><Button variant="outline" onClick={() => decide("descartar")} disabled={busy}>Descartar</Button></div>
        </div>
      )}
    </section>
  );
}
