import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AbsenceState } from "@/components/sigem/states";
import { buildBoard, filterBoard, makeIntent, submitState, totals, type Candidate, type Cell, type ProposalIntent, type ProposalSummary } from "./assignment-board-model";
import type { NeedLine } from "./teacher-need-engine";

const STATUS_LABEL: Record<Cell["status"], string> = { coberta: "Coberta", descoberta: "Descoberta", indeterminada: "Não calculável" };
const REFUSAL_TEXT: Record<string, string> = {
  "celula-indeterminada": "Esta linha não pode ser calculada: falta carga, grade ou regra.",
  "celula-sem-blocos-abertos": "Não há horários sem professor nesta linha.",
  "candidato-inelegivel": "Esta pessoa não está elegível para estas aulas.",
  "bloco-nao-aberto": "Escolha ao menos um horário ainda sem professor.",
};
const n = (v: number | null) => (v === null ? "—" : String(v));

export type AssignmentBoardProps = Readonly<{
  lines: readonly NeedLine[];
  proposals: readonly ProposalSummary[];
  candidatesFor: (cell: Cell) => readonly Candidate[];
  labels?: Readonly<{ school?: (id: string) => string; cls?: (id: string) => string; component?: (id: string) => string }>;
  canPropose: boolean;
  onPropose?: (intent: ProposalIntent) => Promise<void>;
}>;

export function AssignmentBoard({ lines, proposals, candidatesFor, labels, canPropose, onPropose }: AssignmentBoardProps) {
  const [status, setStatus] = useState<Cell["status"] | "">("");
  const [selected, setSelected] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [intent, setIntent] = useState<ProposalIntent | null>(null);
  const cells = useMemo(() => buildBoard(lines, proposals), [lines, proposals]);
  const shown = filterBoard(cells, status ? { status } : {});
  const t = totals(cells);
  const cell = cells.find((c) => c.key === selected) ?? null;
  const submit = submitState(!!onPropose, canPropose);
  const L = { school: labels?.school ?? ((x: string) => x), cls: labels?.cls ?? ((x: string) => x), component: labels?.component ?? ((x: string) => x) };

  if (cells.length === 0) return <AbsenceState kind="sem-dado" title="Sem linhas de oferta" description="Nenhuma linha de oferta foi lida para este recorte. Isso não significa que não há aulas." />;

  return (
    <section aria-label="Quadro de atribuições" className="space-y-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Totais">
        <div><dt className="text-sm text-muted-foreground">Demandadas</dt><dd className="text-xl font-semibold">{n(t.demanded)}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Cobertas</dt><dd className="text-xl font-semibold">{n(t.covered)}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Descobertas</dt><dd className="text-xl font-semibold">{n(t.uncovered)}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Não calculáveis</dt><dd className="text-xl font-semibold">{t.indeterminate}</dd></div>
      </dl>
      <label className="flex items-center gap-2 text-sm">Situação
        <select className="rounded border border-input bg-background px-2 py-1" value={status} onChange={(e) => setStatus(e.target.value as Cell["status"] | "")}>
          <option value="">Todas</option><option value="descoberta">Descobertas</option><option value="coberta">Cobertas</option><option value="indeterminada">Não calculáveis</option>
        </select>
      </label>
      {shown.length === 0 ? <AbsenceState kind="nenhum-resultado" compact /> : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => (
            <li key={c.key}>
              <button type="button" aria-pressed={selected === c.key} onClick={() => { setSelected(c.key); setBlocks([]); setIntent(null); setMessage(null); }}
                className="w-full rounded-lg border border-border bg-card p-3 text-left hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring aria-pressed:border-primary">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{L.cls(c.classId)} · {L.component(c.componentId)}</span>
                  <Badge variant={c.status === "descoberta" ? "destructive" : c.status === "coberta" ? "secondary" : "outline"}>{STATUS_LABEL[c.status]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{L.school(c.schoolId)} — demandadas {n(c.demanded)}, cobertas {n(c.covered)}, descobertas {n(c.uncovered)}</p>
                {c.proposals.length > 0 && <p className="text-sm">Propostas em andamento: {c.proposals.length}</p>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {cell && (
        <div className="space-y-3 rounded-lg border border-border p-3" aria-label="Detalhe da linha">
          <h3 className="font-semibold">{L.cls(cell.classId)} · {L.component(cell.componentId)}</h3>
          {cell.proposals.map((p) => <p key={p.assignmentId} className="text-sm">Proposta: {p.personLabel} — etapa {p.stage}</p>)}
          <fieldset><legend className="text-sm font-medium">Horários sem professor</legend>
            {cell.openBlockIds.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum.</p> : cell.openBlockIds.map((b) => (
              <label key={b} className="mr-3 inline-flex items-center gap-1 text-sm">
                <input type="checkbox" checked={blocks.includes(b)} onChange={(e) => setBlocks((s) => (e.target.checked ? [...s, b] : s.filter((x) => x !== b)))} />{b}
              </label>
            ))}
          </fieldset>
          <ul className="space-y-1" aria-label="Professores">
            {candidatesFor(cell).map((cand) => (
              <li key={cand.linkLogicalId} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">{cand.label}{cand.ineligibility.length ? ` — não elegível: ${cand.ineligibility.join(", ")}` : " — elegível"}</span>
                <Button size="sm" variant="outline" onClick={() => { const r = makeIntent(cell, cand, blocks); setIntent(r.intent); setMessage(r.refusal ? REFUSAL_TEXT[r.refusal] ?? r.refusal : "Proposta montada só nesta tela. Nada foi registrado."); }}>Selecionar</Button>
              </li>
            ))}
          </ul>
          {message && <p role="status" className="text-sm">{message}</p>}
          {intent && (
            <div className="space-y-1">
              <Button disabled={!submit.enabled} onClick={async () => { if (onPropose) { await onPropose(intent); setMessage("Proposta enviada para análise. Ela ainda não é atribuição."); setIntent(null); } }}>Enviar como proposta</Button>
              {submit.reason && <p className="text-sm text-muted-foreground">{submit.reason}</p>}
              <p className="text-sm text-muted-foreground">A atribuição só vale depois de análise, validação por outra pessoa competente e ato formal.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
