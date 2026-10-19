import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { callRpc } from "@/lib/rpc-call";
import { userErrorText } from "@/lib/observability/governed-errors";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { Button } from "@/components/ui/button";
import { currentRiskLimit, expectedVersion, riskLimitProblems, type RiskLimitRow } from "./risk-limits";

/** Limites de risco da escola: a Direção define os patamares de alerta da unidade, com versões guardadas. */
export function RiskLimitsPanel({ school }: { school: string }) {
  const auth = useSessionAuthority();
  const s = auth.status === "signed-in" ? auth : null;
  const qc = useQueryClient();
  const key = ["school-risk-limits", s?.user.id, s?.sessionRevision, school];
  const q = useQuery({ queryKey: key, enabled: !!s, retry: false,
    queryFn: () => callRpc<RiskLimitRow[]>("school_risk_limits_at", { _school: school }) });

  const [frequencyPct, setFrequencyPct] = useState(""); const [gradeCutoff, setGradeCutoff] = useState("");
  const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null); const [ok, setOk] = useState<string | null>(null);

  if (!s) return null;
  const current = q.isError ? null : currentRiskLimit(q.data ?? null);

  const save = async () => {
    const problems = riskLimitProblems({ frequencyPct, gradeCutoff, reason });
    if (problems.length) { setErr(problems[0] ?? "Revise os limites."); return; }
    setBusy(true); setErr(null); setOk(null);
    try {
      await callRpc("direcao_set_risk_limits", {
        _school: school,
        _frequency_pct: frequencyPct.trim() === "" ? null : Number(frequencyPct),
        _grade_cutoff: gradeCutoff.trim() === "" ? null : Number(gradeCutoff),
        _reason: reason, _expected_version: expectedVersion(q.data ?? null), _key: crypto.randomUUID(),
      });
      setFrequencyPct(""); setGradeCutoff(""); setReason("");
      setOk("Limites gravados como nova versão.");
      await qc.invalidateQueries({ queryKey: key });
    } catch (e) { setErr(userErrorText(e as Error)); } finally { setBusy(false); }
  };

  return (
    <section aria-label="Limites de risco da escola" className="rounded-lg border bg-card p-4 space-y-3">
      <h2 className="font-semibold">Limites de risco da escola</h2>
      {q.isLoading ? <p className="text-sm text-muted-foreground">…</p>
        : q.isError ? <p className="text-sm text-muted-foreground">Não foi possível ler os limites.</p>
        : current ? (
          <p className="text-sm">
            Vigente (versão {current.version}):{current.frequency_pct != null ? ` frequência abaixo de ${current.frequency_pct}%` : ""}
            {current.grade_cutoff != null ? ` nota abaixo de ${current.grade_cutoff}` : ""}
            {" "}· definido em {new Date(current.set_at).toLocaleDateString("pt-BR")} · motivo: {current.reason}
          </p>)
        : <p className="text-sm text-muted-foreground">A escola ainda não definiu limites de risco.</p>}
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-sm space-y-1">Frequência de corte (%)
          <input type="number" min={0} max={100} step="0.5" className="w-full rounded border bg-background px-2 py-1"
            value={frequencyPct} onChange={(e) => setFrequencyPct(e.target.value)} placeholder="ex.: 75" /></label>
        <label className="text-sm space-y-1">Nota de corte
          <input type="number" min={0} max={10} step="0.5" className="w-full rounded border bg-background px-2 py-1"
            value={gradeCutoff} onChange={(e) => setGradeCutoff(e.target.value)} placeholder="ex.: 6" /></label>
        <label className="text-sm space-y-1">Motivo
          <input className="w-full rounded border bg-background px-2 py-1" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={busy} onClick={() => void save()}>{busy ? "Gravando…" : "Gravar nova versão"}</Button>
        <p className="text-xs text-muted-foreground">Cada alteração vira uma nova versão; as anteriores ficam guardadas.</p>
      </div>
      <p className="text-xs text-muted-foreground">
        O corte de nota só passa a gerar alertas quando a regra de médias da rede estiver definida.
      </p>
      {err && <p className="text-xs text-destructive">{err}</p>}
      {ok && <p className="text-xs text-primary">{ok}</p>}
    </section>
  );
}
