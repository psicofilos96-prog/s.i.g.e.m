import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { readMyWorkPending, readMyMissingAttendance } from "./my-pending-source";

type Row = { subject_kind: string; em_analise: number; ajuste_solicitado: number };
const NOUN: Record<string, [string, string]> = { plano: ["plano", "planos"], instrumento: ["prova", "provas"] };

export function pendingLines(rows: readonly Row[]): string[] {
  const out: string[] = [];
  for (const r of rows) {
    const [one, many] = NOUN[r.subject_kind] ?? ["trabalho", "trabalhos"];
    if (r.ajuste_solicitado > 0) out.push(`${r.ajuste_solicitado} ${r.ajuste_solicitado === 1 ? one : many} com ajuste pedido pela Orientação`);
    if (r.em_analise > 0) out.push(`${r.em_analise} ${r.em_analise === 1 ? one : many} aguardando a Orientação`);
  }
  return out;
}

export function attendanceLines(n: number): string[] {
  return n > 0 ? [`${n} ${n === 1 ? "aula registrada" : "aulas registradas"} nos últimos 14 dias sem chamada`] : [];
}

/** Aviso do docente sobre planos e provas enviados à OP. Sem pendência, não aparece. */
export function MyPendingWorkCard() {
  const authority = useSessionAuthority();
  const eligible = authority.status === "signed-in" && !authority.principal && authority.person !== null;
  const userId = authority.status === "signed-in" ? authority.user.id : null;
  const revision = authority.status === "signed-in" ? authority.sessionRevision : null;
  const q = useQuery({
    queryKey: ["my-teacher-work-pending", userId, revision],
    enabled: eligible,
    queryFn: readMyWorkPending,
    retry: false,
    staleTime: 60_000,
  });
  const a = useQuery({
    queryKey: ["my-lessons-without-attendance", userId, revision],
    enabled: eligible,
    queryFn: readMyMissingAttendance,
    retry: false,
    staleTime: 60_000,
  });
  if (!eligible) return null;
  const lines = [...(a.isSuccess ? attendanceLines(a.data) : []), ...(q.isSuccess ? pendingLines(q.data) : [])];
  const failed = a.isError || q.isError;
  const loading = a.isPending || q.isPending;
  if (!failed && !loading && lines.length === 0) return null;
  return (
    <section aria-label="Suas pendências" className="rounded-2xl border bg-card p-5">
      <h2 className="text-lg font-semibold">Suas pendências</h2>
      {loading ? <p role="status" className="mt-2 text-sm text-muted-foreground">Consultando suas pendências…</p> : null}
      {failed ? <div role="alert" className="mt-2 space-y-2"><p className="text-sm text-muted-foreground">Não foi possível consultar {a.isError && q.isError ? "as chamadas e os trabalhos com a Orientação" : a.isError ? "as chamadas" : "os trabalhos com a Orientação"}.</p><Button variant="outline" size="sm" onClick={() => { if (a.isError) void a.refetch(); if (q.isError) void q.refetch(); }}>Tentar novamente</Button></div> : null}
      <ul className="mt-2 space-y-1 text-base">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
      <Link to="/meus-diarios" className="mt-3 inline-block text-primary underline">Abrir meus diários</Link>
    </section>
  );
}
