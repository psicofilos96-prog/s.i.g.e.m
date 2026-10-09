/** NDIARY.FINAL.2 — painel das 7 impressões do Diário (só com sessão; turma e período explícitos). */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/sigem/date-input";
import { DIARY_PRINTS, renderDiaryPrint, type DiaryPrintKind } from "./diary-prints";
import { loadDiaryPrintData } from "./diary-prints-cloud";

export function DiaryPrintsPanel({ classId, assignmentId, periodId }: { classId: string | undefined; assignmentId: string | undefined; periodId: string | undefined }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState<DiaryPrintKind | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (!classId) return <p className="text-sm text-muted-foreground">Escolha uma turma para imprimir o Diário.</p>;
  const print = async (kind: DiaryPrintKind) => {
    if (!from || !to) { setMsg("Informe o início e o fim do período."); return; }
    setBusy(kind); setMsg(null);
    try {
      const data = await loadDiaryPrintData({ classId, assignmentId: assignmentId ?? null, period: { id: periodId ?? null, label: periodId ?? null, from, to } });
      const r = renderDiaryPrint(kind, data, new Date().toISOString());
      if (!r.ok) { setMsg(r.reason); return; }
      const w = window.open("", "_blank");
      if (!w) { setMsg("O navegador bloqueou a janela de impressão. Permita janelas para este endereço."); return; }
      w.document.write(r.html); w.document.close(); w.focus(); w.print();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Não foi possível gerar a impressão."); }
    finally { setBusy(null); }
  };
  return (
    <section aria-labelledby="diary-prints" className="surface-panel space-y-3 p-4">
      <h2 id="diary-prints" className="text-sm font-semibold text-foreground">Impressões do Diário</h2>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm"><span className="mb-1 block text-xs text-muted-foreground">Início do período</span><DateInput aria-label="Início do período" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-xs text-muted-foreground">Fim do período</span><DateInput aria-label="Fim do período" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {DIARY_PRINTS.map((p) => (
          <Button key={p.kind} type="button" variant="outline" disabled={busy !== null} onClick={() => void print(p.kind)}>
            {busy === p.kind ? "Preparando…" : p.title}
          </Button>
        ))}
      </div>
      {msg ? <p role="status" className="text-sm text-muted-foreground">{msg}</p> : null}
    </section>
  );
}
