import { userErrorText } from "@/lib/observability/governed-errors";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DECISION_LABEL, fetchSignals, NO_AUTO_ACTION, resolutionProblems, resolveSignal, SIGNAL_LABEL, type Decision, type Signal } from "./application-signals";

export function SignalsSection({ appId }: { appId: string }) {
  const q = useQuery({ queryKey: ["enr-signals", appId], queryFn: () => fetchSignals(appId) });
  return (
    <section aria-label="Sinais" className="grid gap-2">
      <h3 className="text-sm font-medium text-foreground">Sinais para verificar</h3>
      <p className="text-xs text-muted-foreground">{NO_AUTO_ACTION}</p>
      {q.isPending && <p role="status" className="text-sm text-muted-foreground">Verificando…</p>}
      {q.isError && <p role="alert" className="text-sm text-destructive">{(q.error as Error).message}</p>}
      {q.isSuccess && q.data.length === 0 && <p className="text-sm text-muted-foreground">Nenhum sinal encontrado.</p>}
      {q.data?.map((s) => <SignalRow key={`${s.signal_kind}|${s.related_key}`} appId={appId} s={s} />)}
    </section>
  );
}

function SignalRow({ appId, s }: { appId: string; s: Signal }) {
  const qc = useQueryClient();
  const [decision, setDecision] = useState<Decision>("legitimo");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [key] = useState(() => crypto.randomUUID());
  async function save() {
    const p = resolutionProblems(reason);
    if (p.length) return setMsg(p.join(" "));
    try { await resolveSignal(appId, s, decision, reason, key); setMsg("Decisão registrada."); await qc.invalidateQueries({ queryKey: ["enr-signals", appId] }); }
    catch (e) { setMsg(userErrorText(e)); }
  }
  return (
    <div className="rounded-md border border-border p-2 text-sm">
      <p className="font-medium text-foreground">{SIGNAL_LABEL[s.signal_kind]} <span className="text-muted-foreground">({s.strength}{s.related_key !== "matricula" ? ` · ${s.related_key}` : ""})</span></p>
      <p className="text-muted-foreground">{s.evidence}</p>
      <p className="text-muted-foreground">Situação: {s.decision ? DECISION_LABEL[s.decision] : "sem decisão"}</p>
      <div className="mt-2 grid gap-2">
        <select aria-label="Decisão" className="h-10 rounded-md border border-input bg-background px-2" value={decision} onChange={(e) => setDecision(e.target.value as Decision)}>
          {Object.entries(DECISION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <textarea aria-label="Motivo da decisão" className="min-h-16 rounded-md border border-input bg-background p-2" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button size="sm" variant="outline" onClick={save}>Registrar decisão</Button>
        {msg && <p role="status" className="text-muted-foreground">{msg}</p>}
      </div>
    </div>
  );
}
