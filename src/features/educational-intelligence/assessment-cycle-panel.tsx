import { knownLabel } from "@/config/ui-vocabulary";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { governError } from "@/lib/observability/governed-errors";
import { CYCLE_LABEL, CYCLE_STATES, currentCycleState, expectedHead, nextCycleState, type CycleEvent, type CycleState } from "./assessment-cycle";

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);

export type CycleEdition = { logical_id: string; label: string; reference_date: string; event_kind: string };

/** Mensagem humana para recusas do banco; nunca o texto interno. */
export function cycleMessage(raw: string): string {
  if (raw.includes("cycle-head-changed")) return "Outra pessoa moveu esta avaliação agora. A lista foi recarregada.";
  if (raw.includes("cycle-transition-invalid")) return "Essa etapa não pode ser registrada a partir do estado atual.";
  if (raw.includes("capability") || raw.includes("grant")) return "Você não tem permissão para mover avaliações no ciclo.";
  return "Não foi possível registrar a etapa. Tente de novo.";
}

/** Contagem por estado; sem evento = "sem estado", nunca planejada presumida. */
export function countByState(states: (CycleState | null)[]): { key: CycleState | "sem-estado"; label: string; n: number }[] {
  const out = CYCLE_STATES.map((s) => ({ key: s as CycleState | "sem-estado", label: CYCLE_LABEL[s], n: states.filter((x) => x === s).length }));
  out.unshift({ key: "sem-estado", label: "Sem estado registrado", n: states.filter((x) => x === null).length });
  return out;
}

const VERB: Record<CycleState, string> = {
  planejada: "Registrar planejamento", preparada: "Marcar como preparada", "em-aplicacao": "Iniciar aplicação",
  recebida: "Registrar recebimento", validada: "Validar resultados", publicada: "Publicar", arquivada: "Arquivar",
};

export function AssessmentCyclePanel({ editions, onStates }: { editions: CycleEdition[]; onStates?: (s: (CycleState | null)[]) => void }) {
  const [events, setEvents] = useState<Record<string, CycleEvent[] | "erro">>({});
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    Promise.all(editions.map(async (e) => {
      const { data, error } = await rpc("assessment_edition_cycle_at", { _edition: e.logical_id, _known_at: new Date().toISOString() });
      return [e.logical_id, error ? "erro" : ((data ?? []) as CycleEvent[])] as const;
    })).then((pairs) => {
      if (!live) return;
      const m = Object.fromEntries(pairs);
      setEvents(m);
      onStates?.(pairs.map(([, v]) => (v === "erro" ? null : currentCycleState(v))));
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editions, tick]);
  if (editions.length === 0) return <EmptyState title="Nenhuma edição registrada" description="O ciclo começa quando um programa avaliativo tem uma edição cadastrada." />;
  return (
    <ul className="space-y-3">
      {editions.map((e) => <Row key={e.logical_id} edition={e} events={events[e.logical_id]} onChanged={() => setTick((t) => t + 1)} />)}
    </ul>
  );
}

function Row({ edition, events, onChanged }: { edition: CycleEdition; events: CycleEvent[] | "erro" | undefined; onChanged: () => void }) {
  const [note, setNote] = useState(""); const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (events === undefined) return <li className="rounded-md border border-border p-3 text-sm text-muted-foreground">Carregando {edition.label}…</li>;
  if (events === "erro") return <li><StatePanel tone="warning" title={edition.label} description="Ciclo indisponível para a sua sessão." /></li>;
  const cur = currentCycleState(events); const next = nextCycleState(cur);
  const sensitive = next === "publicada" || next === "arquivada";
  async function advance() {
    if (!next) return;
    setBusy(true); setMsg(null);
    const { error } = await rpc("record_assessment_edition_cycle_event", { _edition: edition.logical_id, _expected_seq: expectedHead(events as CycleEvent[]), _to_state: next, _note: note.trim() || null });
    setBusy(false); setConfirm(false);
    if (error) { setMsg(cycleMessage(error.message) || governError(error).userMessage); onChanged(); return; }
    setNote(""); setMsg(`${CYCLE_LABEL[next]}: registrado.`); onChanged();
  }
  return (
    <li className="space-y-2 rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0"><span className="font-medium">{edition.label}</span> · referência {edition.reference_date}</span>
        <StatusBadge tone={cur === "publicada" ? "success" : cur === null ? "neutral" : "info"}>{cur ? CYCLE_LABEL[cur] : "Sem estado"}</StatusBadge>
      </div>
      <ol aria-label="Etapas" className="flex flex-wrap gap-1 text-xs">
        {CYCLE_STATES.map((s) => {
          const done = events.some((ev) => ev.to_state === s);
          return <li key={s} className={done ? "rounded border border-primary px-1.5 py-0.5" : "rounded border border-border px-1.5 py-0.5 text-muted-foreground"}>{CYCLE_LABEL[s]}</li>;
        })}
      </ol>
      {next ? (
        <div className="flex flex-wrap items-end gap-2">
          <Input className="max-w-sm" aria-label="Observação" placeholder="Observação (opcional)" maxLength={500} value={note} onChange={(ev) => setNote(ev.target.value)} />
          {sensitive && !confirm
            ? <Button size="sm" onClick={() => setConfirm(true)}>{VERB[next]}</Button>
            : <Button size="sm" disabled={busy} onClick={advance}>{sensitive ? `Confirmar: ${VERB[next].toLowerCase()}` : VERB[next]}</Button>}
          {confirm ? <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Cancelar</Button> : null}
        </div>) : <p className="text-muted-foreground">Ciclo encerrado.</p>}
      {next === "publicada" ? <p className="text-xs text-muted-foreground">Validar e publicar são etapas separadas: publicar só é possível depois da validação.</p> : null}
      {msg ? <p role="status">{msg}</p> : null}
      <button type="button" className="text-xs underline" aria-expanded={open} onClick={() => setOpen(!open)}>Histórico ({events.length})</button>
      {open ? <ol className="text-xs text-muted-foreground">{events.map((ev) => <li key={ev.seq}>{ev.recorded_at.slice(0, 10)} · {knownLabel(CYCLE_LABEL, ev.to_state)}{ev.note ? ` — ${ev.note}` : ""}</li>)}</ol> : null}
    </li>
  );
}
