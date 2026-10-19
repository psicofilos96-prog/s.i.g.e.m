import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

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

/** Aviso do docente sobre planos e provas enviados à OP. Sem pendência, não aparece. */
export function MyPendingWorkCard() {
  const q = useQuery({
    queryKey: ["my-teacher-work-pending"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_teacher_work_pending");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    staleTime: 60_000,
  });
  const lines = q.data ? pendingLines(q.data) : [];
  if (lines.length === 0) return null;
  return (
    <section aria-label="Pendências com a Orientação" className="rounded-2xl border bg-card p-5">
      <h2 className="text-lg font-semibold">Com a Orientação</h2>
      <ul className="mt-2 space-y-1 text-base">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
      <Link to="/meus-diarios" className="mt-3 inline-block text-primary underline">Abrir meus diários</Link>
    </section>
  );
}
