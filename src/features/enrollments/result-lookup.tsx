import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { consultResult, SITUATION_LABEL, STATUS_MESSAGE, type IndividualResult } from "./individual-result";

const fmtDateTime = (d: string) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

/** Consulta individual do resultado: só o próprio pedido; nenhuma lista é publicada. */
export function ResultLookup() {
  const cId = useId(); const kId = useId(); const hId = useId();
  const [code, setCode] = useState(""); const [check, setCheck] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<IndividualResult | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null); setRes(null); setBusy(true);
    try { setRes(await consultResult(code, check)); } catch { setErr("Consulta indisponível no momento. Tente novamente."); } finally { setBusy(false); }
  }
  return (
    <section id="resultado" aria-labelledby="h-resultado" className="mt-10 scroll-mt-4">
      <h2 id="h-resultado" className="text-lg font-semibold text-foreground">Consultar resultado</h2>
      <p className="mt-1 text-sm text-muted-foreground">O resultado é individual. Não publicamos listas com nomes de crianças e adolescentes.</p>
      <form onSubmit={submit} className="mt-3 grid gap-3 rounded-md border border-border bg-card p-4" noValidate>
        <div className="grid gap-1">
          <Label htmlFor={cId}>Código do pedido</Label>
          <Input id={cId} value={code} onChange={(e) => setCode(e.target.value)} placeholder="INS-…" autoComplete="off" aria-describedby={hId} required />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={kId}>Código de conferência</Label>
          <Input id={kId} value={check} onChange={(e) => setCheck(e.target.value)} placeholder="12 caracteres" autoComplete="off" aria-describedby={hId} required />
        </div>
        <p id={hId} className="text-sm text-muted-foreground">Os dois aparecem no comprovante do pedido.</p>
        <Button type="submit" disabled={busy} className="min-h-11 sm:w-fit">{busy ? "Consultando…" : "Consultar resultado"}</Button>
      </form>
      <div role="status" aria-live="polite" className="mt-3">
        {err && <p role="alert" className="rounded-md border border-border bg-muted p-3 text-sm text-foreground">{err}</p>}
        {res && (
          <div className="space-y-2 rounded-md border border-border bg-muted p-3 text-sm text-foreground">
            {res.situation ? <p className="font-medium">{SITUATION_LABEL[res.situation]}</p> : null}
            {res.deadline ? <p>Prazo: até {fmtDateTime(res.deadline)}</p> : null}
            {res.status === "ok" ? (
              <>
                <p><span className="font-medium">Motivo: </span>{res.justification}</p>
                <p><span className="font-medium">O que fazer: </span>{res.next_step}</p>
              </>
            ) : <p>{STATUS_MESSAGE[res.status]}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
