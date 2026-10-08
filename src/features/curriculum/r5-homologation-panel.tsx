/**
 * R5 — Painel comum de homologação de versão (E1–E4).
 * Estado e histórico do ledger sempre visíveis; ação só com capacidade de rede
 * efetiva (UX — o banco revalida). Revogar é novo evento append-only.
 */
import { SkeletonState } from "@/components/sigem/guidance";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DateInput } from "@/components/sigem/date-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatAcademicDate, formatDateTime } from "@/lib/academic-date";
import { useSessionAuthority } from "@/features/authority/session-authority";
import {
  POLICY_PENDING_NOTE, canHomologate, decisionLabel, homologateCapabilityOf, humanR5Error, ledgerHead, loadLedger,
  reasonRequired, recordHomologation, validateHomologation, type R5Kind,
} from "@/features/curriculum/r5-source";

export function useR5Capabilities() {
  const a = useSessionAuthority();
  return a.status === "signed-in" ? a.capabilities : [];
}

export function HomologationPanel({ kind, versionId, title }: { kind: R5Kind; versionId: string; title: string }) {
  const caps = useR5Capabilities();
  const allowed = canHomologate(caps, kind);
  const qc = useQueryClient();
  const [knownAt, setKnownAt] = useState(() => new Date().toISOString());
  const ledger = useQuery({ queryKey: ["r5-ledger", kind, versionId, knownAt], queryFn: () => loadLedger(kind, versionId, knownAt) });
  const [decision, setDecision] = useState<"homologada" | "revogada" | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [actRef, setActRef] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  let head: ReturnType<typeof ledgerHead> | null = null;
  let headError: string | null = null;
  try { head = ledger.data ? ledgerHead(ledger.data) : null; } catch (e) { headError = humanR5Error((e as Error).message); }

  const submit = async () => {
    if (!head || !decision) return;
    const input = { versionId, expectedHeadId: head.headId, decision, effectiveFrom, actRef, reason: reason || null };
    const local = validateHomologation(input, head);
    if (local) { setErr(humanR5Error(`${kind}-homologation:${local}`)); return; }
    setBusy(true); setErr(null);
    try {
      const r = await recordHomologation(kind, input);
      setOk(`Decisão registrada (sequência ${r.sequence}). O histórico anterior foi preservado.`);
      setDecision(null); setActRef(""); setReason(""); setEffectiveFrom("");
      setKnownAt(new Date().toISOString());
      void qc.invalidateQueries();
    } catch (e) { setErr(humanR5Error((e as Error).message)); } finally { setBusy(false); }
  };

  const id = `r5-${kind}-${versionId}`;
  return (
    <section aria-labelledby={`${id}-t`} className="space-y-2 rounded-md border border-border p-3">
      <h3 id={`${id}-t`} className="text-sm font-semibold text-foreground">{title}</h3>
      {ledger.isLoading && <SkeletonState label="Carregando histórico de homologação" />}
      {ledger.error && <p role="alert" className="text-sm text-destructive">{humanR5Error((ledger.error as Error).message)}</p>}
      {headError && <p role="alert" className="text-sm text-destructive">{headError}</p>}
      {head && (
        <p className="text-sm text-foreground" data-testid={`${id}-state`}>Situação: <strong>{decisionLabel(head.state)}</strong></p>
      )}
      {ledger.data && ledger.data.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma decisão de homologação registrada para esta versão.</p>}
      {ledger.data && ledger.data.length > 0 && (
        <ol className="divide-y divide-border rounded-md border border-border text-xs" aria-label="Histórico de homologação">
          {ledger.data.map((h) => (
            <li key={h.id} className="p-2">
              <span className="font-medium text-foreground">{h.sequence}. {h.decision === "homologada" ? "Homologação" : "Revogação"}</span>
              <span className="text-muted-foreground"> · efeito desde {formatAcademicDate(h.effectiveFrom)} {h.actRef ? `· referência documental ${h.actRef}` : "· decisão interna (sem documento-fonte)"}
                {h.reason ? ` · motivo: ${h.reason}` : ""} · registrada em {formatDateTime(h.recordedAt)}</span>
            </li>
          ))}
        </ol>
      )}
      {ok && <p role="status" className="rounded-md border border-primary p-2 text-sm text-foreground">{ok}</p>}
      {!allowed ? (
        <p className="text-xs text-muted-foreground" data-testid={`${id}-blocked`}>
          Homologar ou revogar exige a capacidade “{homologateCapabilityOf(kind)}” com alcance de rede, que sua sessão não possui. {POLICY_PENDING_NOTE}
        </p>
      ) : head && !decision ? (
        <div className="flex flex-wrap gap-2">
          {head.state !== "homologada" && <Button size="sm" onClick={() => { setOk(null); setErr(null); setDecision("homologada"); }}>Homologar versão</Button>}
          {head.state === "homologada" && <Button size="sm" variant="outline" onClick={() => { setOk(null); setErr(null); setDecision("revogada"); }}>Revogar homologação</Button>}
        </div>
      ) : head && decision ? (
        <form className="grid gap-2 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void submit(); }} aria-label={decision === "homologada" ? "Homologar versão" : "Revogar homologação"}>
          <div className="space-y-1">
            <Label htmlFor={`${id}-from`}>Efeito a partir de</Label>
            <DateInput id={`${id}-from`} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-act`}>Referência documental/fonte (opcional)</Label>
            <Input id={`${id}-act`} value={actRef} onChange={(e) => setActRef(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={`${id}-reason`}>Motivo{reasonRequired(decision, head) ? " (obrigatório)" : " (opcional)"}</Label>
            <Textarea id={`${id}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            {decision === "revogada" ? "Revogar registra novo evento; a homologação anterior permanece no histórico." : "A decisão é registrada contra a última decisão conhecida; se outra chegar antes, nada é gravado."}
          </p>
          {err && <p role="alert" className="text-sm text-destructive sm:col-span-2">{err}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" size="sm" disabled={busy}>{busy ? "Registrando…" : "Registrar decisão"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setDecision(null); setErr(null); }}>Cancelar</Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
