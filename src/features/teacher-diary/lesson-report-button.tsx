import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadBlob } from "@/features/reports/report-engine";
import { createLessonReportAttempt } from "./lesson-report-export";
import type { LessonRow, MyDiary } from "./diary-w-source";

export function LessonReportButton({ diary, lessons }: { diary: MyDiary; lessons: readonly LessonRow[] | null }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const active = useRef(true); const sending = useRef(false);
  const attempt = useRef<ReturnType<typeof createLessonReportAttempt> | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; attempt.current = null; }; }, []);
  const generate = async () => {
    if (!lessons?.length || sending.current) return;
    sending.current = true; setBusy(true); setMessage(null);
    try {
      attempt.current ??= createLessonReportAttempt(diary, lessons, `teacher-lessons:${crypto.randomUUID()}`, () => active.current);
      const result = await attempt.current();
      if (!active.current) return;
      downloadBlob(result.name, result.blob); setMessage(`Arquivo gerado. Código de verificação: ${result.code}`);
    } catch { if (active.current) setMessage("Não foi possível concluir a emissão. Nenhum arquivo foi baixado; tente novamente."); }
    finally { sending.current = false; if (active.current) setBusy(false); }
  };
  return <div className="space-y-2">
    <Button size="sm" variant="outline" disabled={busy || !lessons?.length} onClick={() => void generate()}><Download className="size-4" />{busy ? "Gerando PDF…" : "PDF de aulas"}</Button>
    {message && <p role="status" className="break-words text-xs text-muted-foreground">{message}</p>}
  </div>;
}