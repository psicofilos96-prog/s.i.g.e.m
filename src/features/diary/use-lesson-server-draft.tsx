/**
 * NDIARY.FINAL.2 — autosave do registro de aula no servidor: debounce (useAutosave), versão do
 * rascunho (seq), recuperação do último rascunho aberto, `lastSavedAt`, falha por extenso com
 * "Tentar novamente" (mesma seq = idempotente) e flush ao sair. Nada vai para localStorage.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useAutosave } from "@/features/autosave/use-autosave";
import { Button } from "@/components/ui/button";
import { formatAcademicDate } from "@/lib/academic-date";
import type { CloudDraft } from "./infant-draft-cloud";
import { createDraftSequencer, readOpenLessonDrafts, writeLessonDraft } from "./lesson-draft-cloud";
import type { LessonRecordInput } from "./lesson-records";

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`);

export function useLessonServerDraft(value: LessonRecordInput, enabled: boolean) {
  const [draftKey, setDraftKey] = useState<string>(() => newKey());
  const seq = useRef(createDraftSequencer());
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [recoverable, setRecoverable] = useState<CloudDraft | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    readOpenLessonDrafts()
      .then((drafts) => { if (alive) setRecoverable(drafts[0] ?? null); })
      .catch(() => { if (alive) setRecoveryError("Não foi possível verificar rascunhos salvos anteriormente."); });
    return () => { alive = false; };
  }, [enabled]);

  const autosave = useAutosave(value, async (v) => {
    const s = seq.current.next(v);
    await writeLessonDraft(draftKey, s, v);
    setLastSavedAt(new Date().toISOString());
  }, { enabled, debounceMs: 1200 });

  const api = useMemo(() => ({
    adopt(d: CloudDraft) { setDraftKey(d.draftKey); seq.current = createDraftSequencer(d.seq); setLastSavedAt(d.recordedAt); setRecoverable(null); },
    dismiss() { setRecoverable(null); },
    async close() { await autosave.flush(); if (seq.current.current > 0) await writeLessonDraft(draftKey, seq.current.current + 1, {}, true); },
  }), [draftKey, autosave]);

  return { ...autosave, lastSavedAt, recoverable, recoveryError, draftKey, ...api };
}

export function LessonDraftStatus({ draft }: { draft: ReturnType<typeof useLessonServerDraft> }) {
  const saved = draft.lastSavedAt ? new Date(draft.lastSavedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>{draft.label}{saved && draft.status !== "erro" ? ` · último salvamento às ${saved}` : ""}</span>
      {draft.status === "erro" ? <Button type="button" size="sm" variant="outline" onClick={() => void draft.retry()}>Tentar novamente</Button> : null}
      {draft.recoveryError ? <span className="text-destructive">{draft.recoveryError}</span> : null}
    </div>
  );
}

export function LessonDraftRecovery({ draft, onRecover }: { draft: ReturnType<typeof useLessonServerDraft>; onRecover: (v: LessonRecordInput) => void }) {
  const d = draft.recoverable;
  if (!d) return null;
  const p = d.payload as Partial<LessonRecordInput>;
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
      <p>Há um rascunho salvo{p.date ? ` da aula de ${formatAcademicDate(p.date)}` : ""}, gravado em {new Date(d.recordedAt).toLocaleString("pt-BR")}. Ele ainda não é registro oficial.</p>
      <div className="mt-2 flex gap-2">
        <Button type="button" size="sm" onClick={() => { draft.adopt(d); onRecover(d.payload as LessonRecordInput); }}>Continuar este rascunho</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => draft.dismiss()}>Começar outro</Button>
      </div>
    </div>
  );
}
