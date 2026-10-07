import { SkeletonState } from "@/components/sigem/guidance";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/sigem/patterns";
import { completenessLines, governanceMessage, readGovernance, recordConference, recordOfficialization, type GovernanceState } from "./assessment-governance";

/** AA.2 — painel de completude/conferência/oficialização/publicação. Só apresenta o estado do banco; nenhuma regra na tela. */
export function AssessmentGovernancePanel({ instrumentId, refreshKey }: { instrumentId: string; refreshKey?: unknown }) {
  const [state, setState] = useState<GovernanceState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => readGovernance(instrumentId).then(setState).catch((e) => setErr(governanceMessage((e as Error).message)));
  useEffect(() => { setState(null); setErr(null); void load(); }, [instrumentId, refreshKey]);
  if (err) return <StatePanel tone="danger" title="Conferência indisponível" description={err} />;
  if (!state) return <SkeletonState label="Carregando a conferência" />;
  if (!("completeness" in state)) return <StatePanel tone="neutral" title="Conferência indisponível" description="Sua atuação não acompanha este instrumento." />;
  const c = state.completeness;
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg(ok); } catch (e) { setMsg(governanceMessage((e as Error).message)); } finally { setBusy(false); void load(); }
  };
  return (
    <section aria-labelledby="gov" className="space-y-2 rounded-lg border border-border p-4 text-sm">
      <h2 id="gov" className="font-semibold">Completude e conferência</h2>
      <ul className="list-disc pl-5">{completenessLines(c).map((l) => <li key={l}>{l}</li>)}</ul>
      <p>Situação: <strong>{c.state === "completo" ? "completo" : c.state === "incompleto" ? "incompleto" : "indisponível"}</strong> ·
        Conferência: <strong>{state.conference_state === "vigente" ? "vigente" : state.conference_state === "requer-reconferencia" ? "requer reconferência (dados mudaram)" : "não realizada"}</strong></p>
      {msg && <p role="status">{msg}</p>}
      {c.state === "completo" && state.conference_state !== "vigente" && c.fingerprint && (
        <Button size="sm" disabled={busy} onClick={() => act(() => recordConference(instrumentId, state.conference_id, c.fingerprint!), "Conferência registrada como nova versão.")}>Conferir dados</Button>)}
      {state.conference_state === "vigente" && state.conference_id && (
        state.officialization_competence === "nao-homologada"
          ? <p className="text-muted-foreground">Oficialização indisponível: não há competência homologada para oficializar resultados.</p>
          : <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => recordOfficialization(instrumentId, state.conference_id!), "Oficialização registrada.")}>Oficializar</Button>)}
      <p className="text-muted-foreground">Cálculo de média/recuperação: bloqueado até haver regra homologada. Publicação para estudantes e famílias: aguardando regra homologada — nada é publicado automaticamente.</p>
    </section>
  );
}
