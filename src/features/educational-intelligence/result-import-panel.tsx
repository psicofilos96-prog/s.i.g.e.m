import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { governError } from "@/lib/observability/governed-errors";
import { projectBatches, rowResolution, type BatchEvent, type ImportBatch, type ImportRow, type ReviewEvent } from "./result-import";

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);
const MATCH_LABEL: Record<ImportRow["match_state"], string> = { "exato-inep": "INEP exato", "exato-matricula": "Matrícula exata", "revisao-nome": "Revisar (nome)",
  "sem-correspondencia": "Sem correspondência", duplicado: "Duplicado", "sem-dado": "Sem respostas" };

export function ResultImportPanel() {
  const [d, setD] = useState<{ b: ImportBatch[]; r: ImportRow[]; v: ReviewEvent[]; e: BatchEvent[] } | { error: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const load = useCallback(async () => {
    const [b, r, v, e] = await Promise.all([supabase.from("aa_import_batches").select("*").limit(1000), supabase.from("aa_import_rows").select("*").limit(1000),
      supabase.from("aa_import_review_events").select("*").limit(1000), supabase.from("aa_import_batch_events").select("*").limit(1000)]);
    const err = b.error ?? r.error ?? v.error ?? e.error;
    if (err) setD({ error: governError(err).userMessage });
    else setD({ b: b.data as unknown as ImportBatch[], r: r.data as unknown as ImportRow[], v: v.data as unknown as ReviewEvent[], e: e.data as unknown as BatchEvent[] });
  }, []);
  useEffect(() => { void load(); }, [load]);
  const views = useMemo(() => (d && "b" in d ? projectBatches(d.b, d.r, d.v, d.e) : []), [d]);

  async function act(fn: string, args: Record<string, unknown>, ok: string) {
    const r = await rpc(fn, args); setMsg(r.error ? governError(r.error).userMessage : ok); if (!r.error) void load();
  }
  if (!d) return <SkeletonState />;
  if ("error" in d) return <StatePanel tone="warning" title="Leitura indisponível" description={d.error} />;
  return (
    <div className="space-y-4">
      <StatePanel tone="info" title="Importação em etapas" description="Planilha → prévia sem gravar → área de revisão (com hash e linha de origem) → revisão humana de identidade → confirmação → reversão técnica se necessário. Nome nunca vincula aluno sozinho. Acertos locais e proficiência TRI ficam separados e nunca se convertem. A confirmação não grava resultado oficial: isso segue pelo registro canônico de resultados." />
      <input className="h-8 w-full rounded-md border bg-background px-2 text-sm" placeholder="Motivo (obrigatório para decidir, confirmar ou reverter)" value={reason} onChange={(e) => setReason(e.target.value)} />
      {msg && <p role="status" className="text-sm">{msg}</p>}
      {views.length === 0 ? <StatePanel title="Nenhum lote visível" description="Sem lotes preparados ou sem a permissão de importar resultados de avaliação." /> : (
        <ul className="space-y-2">{views.map((v) => (
          <li key={v.batch.id} className="rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="neutral">{v.state}</StatusBadge>
              <strong>{v.batch.file_name}</strong><span>· {v.batch.sheet}</span>
              <span className="text-xs text-muted-foreground">{v.batch.program_key} {v.batch.edition_year}{v.batch.round ? ` · rodada ${v.batch.round}` : ""} · {v.batch.measure_kind === "acertos-locais" ? "Acertos locais" : "Proficiência TRI"} · {v.batch.school_label ?? "escola não identificada"} · hash {v.batch.sha256.slice(0, 10)}…</span>
              <Button size="sm" variant="ghost" onClick={() => setOpen(open === v.batch.id ? null : v.batch.id)}>{open === v.batch.id ? "Fechar" : "Linhas"}</Button>
            </div>
            <p className="text-xs">{Object.entries(v.counts).filter(([, n]) => n > 0).map(([k, n]) => `${MATCH_LABEL[k as ImportRow["match_state"]]}: ${n}`).join(" · ")} · vinculadas {v.linked} · rejeitadas {v.rejected}</p>
            {v.batch.formula_note && <p className="text-xs text-muted-foreground">Fórmula do instrumento preservada: <code>{v.batch.formula_note.slice(0, 120)}</code></p>}
            {v.blockers.map((b) => <p key={b} className="text-xs text-muted-foreground">• {b}</p>)}
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={!v.canConfirm} onClick={() => void act("aa_import_batch_act", { _batch: v.batch.id, _expected_seq: v.seq, _event: "confirmado", _reason: reason }, "Lote confirmado.")}>Confirmar lote</Button>
              {v.state !== "revertido" && <Button size="sm" variant="outline" onClick={() => void act("aa_import_batch_act", { _batch: v.batch.id, _expected_seq: v.seq, _event: "revertido", _reason: reason }, "Lote revertido (histórico mantido).")}>Reverter</Button>}
            </div>
            {open === v.batch.id && d && "r" in d && (
              <table className="mt-2 w-full text-xs"><tbody>{d.r.filter((r) => r.batch_id === v.batch.id).sort((a, b) => a.row_no - b.row_no).map((r) => {
                const res = rowResolution(r, d.v); const seq = d.v.filter((x) => x.row_id === r.id).length;
                return (<tr key={r.id} className="border-t"><td className="p-1">L{r.row_no}</td><td>{r.student_name}</td><td>{MATCH_LABEL[r.match_state]}</td><td>{res.status}</td>
                  <td>{(r.match_state === "revisao-nome" || r.match_state === "sem-correspondencia") && v.state === "preparado" && (<span className="flex flex-wrap gap-1">
                    {r.candidate_student_ids.map((c) => <Button key={c} size="sm" variant="outline" onClick={() => void act("aa_import_review", { _row: r.id, _expected_seq: seq, _decision: "vincular", _student: c, _reason: reason }, "Vínculo registrado.")}>Vincular {c.slice(0, 8)}</Button>)}
                    <Button size="sm" variant="ghost" onClick={() => void act("aa_import_review", { _row: r.id, _expected_seq: seq, _decision: "rejeitar", _student: null, _reason: reason }, "Linha rejeitada.")}>Rejeitar</Button></span>)}</td></tr>);
              })}</tbody></table>)}
          </li>))}</ul>)}
    </div>
  );
}
