import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SkeletonState, GuidedErrorState } from "@/components/sigem/guidance";
import { confirmAction } from "@/components/sigem/confirm-action";
import { EmptyState } from "@/components/sigem/patterns";
import {
  REVIEW_STATE_LABEL, canSubmit, recordReview, reviewMessage, reviewPrintHtml, reviewQueue, reviewState, reviewsOf,
  type PrintSection, type ReviewEvent, type ReviewSubject,
  reviewEventLabel,
} from "./teacher-work-review";
import { formatDateTime } from "@/lib/academic-date";

const SUBJECT_LABEL: Record<ReviewSubject, string> = { plano: "Planejamento", instrumento: "Prova" };

/** Painel do autor: situação, histórico com comentários e envio/reenvio. */
export function ReviewPanel({ kind, subjectId, versionId, isAuthor, print }: { kind: ReviewSubject; subjectId: string; versionId: string | null; isAuthor: boolean; print?: { title: string; sections: PrintSection[] } }) {
  const q = useQuery({ queryKey: ["twr", kind, subjectId], queryFn: () => reviewsOf(kind, subjectId) });
  const [msg, setMsg] = useState<string | null>(null);
  if (q.isLoading) return <SkeletonState rows={1} label="Carregando análise da Orientação Pedagógica" />;
  if (q.error) return <GuidedErrorState error={q.error} onRetry={() => q.refetch()} />;
  const events = q.data ?? [];
  const state = reviewState(events, versionId);
  const send = async () => {
    if (!versionId) return;
    if (!(await confirmAction({ title: "Enviar à Orientação Pedagógica?", consequence: "A versão atual será analisada. Você poderá continuar consultando, e só reenvia se for pedido ajuste.", actionLabel: "Enviar" }))) return;
    try { await recordReview({ kind, subjectId, versionId, expectedSeq: events.at(-1)?.seq ?? 0, event: "enviado" }); setMsg("Enviado."); q.refetch(); }
    catch (e) { setMsg(reviewMessage(e instanceof Error ? e.message : "")); }
  };
  return (
    <section aria-label="Análise da Orientação Pedagógica" className="space-y-2 rounded border p-3 text-sm" data-review-state={state}>
      <p className="font-medium">{REVIEW_STATE_LABEL[state]}</p>
      {events.length > 0 && (
        <ol className="space-y-1 text-xs">
          {events.map((e) => (
            <li key={e.seq}>{reviewEventLabel(e.event)} · {formatDateTime(e.recorded_at)}{e.comment ? ` — “${e.comment}”` : ""}</li>
          ))}
        </ol>
      )}
      {isAuthor && canSubmit(state) && versionId && (
        <Button size="sm" onClick={send}>{state === "nao-enviado" ? "Enviar à Orientação Pedagógica" : "Reenviar à Orientação Pedagógica"}</Button>
      )}
      {print && (
        <Button size="sm" variant="outline" onClick={() => {
          const w = window.open("", "_blank"); if (!w) return;
          w.document.write(reviewPrintHtml(print.title, state, print.sections, events)); w.document.close(); w.focus(); w.print();
        }}>Imprimir com a situação da análise</Button>
      )}
      {msg && <p role="status" className="text-xs text-muted-foreground">{msg}</p>}
    </section>
  );
}

/** Fila da OP: aprovar ou pedir ajuste (comentário obrigatório). */
export function ReviewQueue({ school }: { school: string }) {
  const q = useQuery({ queryKey: ["twr-queue", school], queryFn: () => reviewQueue(school) });
  const [comment, setComment] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  if (q.isLoading) return <SkeletonState label="Carregando envios aguardando análise" />;
  if (q.error) return <GuidedErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.data?.kind === "negado") return <EmptyState title="Sem autorização para analisar" description="Sua conta não tem a autorização de análise de trabalhos docentes nesta escola. Ela é dada por política homologada." />;
  const rows = q.data?.kind === "ok" ? q.data.rows : [];
  if (rows.length === 0) return <EmptyState title="Nenhum envio aguardando análise" description="Quando um professor enviar planejamento ou prova, aparece aqui." />;
  const act = async (r: (typeof rows)[number], event: "aprovado" | "ajuste-solicitado") => {
    const key = `${r.subject_kind}:${r.subject_id}`;
    const c = comment[key]?.trim() ?? "";
    if (event === "ajuste-solicitado" && c.length < 3) { setMsg("Escreva o que precisa ser ajustado."); return; }
    try { await recordReview({ kind: r.subject_kind, subjectId: r.subject_id, versionId: r.subject_version_id, expectedSeq: r.seq, event, comment: c || null }); setMsg(event === "aprovado" ? "Aprovado." : "Ajuste solicitado."); q.refetch(); }
    catch (e) { setMsg(reviewMessage(e instanceof Error ? e.message : "")); }
  };
  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {rows.map((r) => {
          const key = `${r.subject_kind}:${r.subject_id}`;
          return (
            <li key={key} className="space-y-2 rounded border p-3 text-sm">
              <p className="font-medium">{SUBJECT_LABEL[r.subject_kind]}: {r.title ?? "Sem título"}</p>
              <p className="text-xs text-muted-foreground">Enviado em {formatDateTime(r.submitted_at)}</p>
              <label className="block text-xs">Comentário
                <Textarea value={comment[key] ?? ""} onChange={(e) => setComment({ ...comment, [key]: e.target.value })} />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => act(r, "aprovado")}>Aprovar</Button>
                <Button size="sm" variant="outline" onClick={() => act(r, "ajuste-solicitado")}>Pedir ajuste</Button>
              </div>
            </li>
          );
        })}
      </ul>
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </div>
  );
}
