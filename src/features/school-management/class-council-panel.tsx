import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { callRpc } from "@/lib/rpc-call";
import { useSessionAuthority } from "@/features/authority/session-authority";
import type { VacancyRow } from "./director-summary";

/** Atalho da Direção ao Conselho de Classe de cada turma (sessão, pauta, deliberação e ata vivem no módulo de colegiados). */
export function ClassCouncilPanel({ school, year, on }: { school: string; year: string; on: string }) {
  const auth = useSessionAuthority();
  const s = auth.status === "signed-in" ? auth : null;
  const q = useQuery({ queryKey: ["council-classes", s?.user.id, s?.sessionRevision, school, year, on], enabled: !!s, retry: false,
    queryFn: async () => {
      const rows = await callRpc<(VacancyRow & { name?: string })[]>("secretariat_class_vacancies_at", { _school: school, _year: year, _on: on });
      return (rows ?? []).map((r) => ({ id: r.class_id, name: r.name ?? r.class_id })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    } });
  if (!s) return null;
  return (
    <section aria-label="Conselho de Classe" className="rounded-lg border bg-card p-4 space-y-3">
      <h2 className="font-semibold">Conselho de Classe</h2>
      {q.isLoading ? <p className="text-sm text-muted-foreground">…</p>
        : q.isError ? <p className="text-sm text-muted-foreground">Não foi possível ler as turmas.</p>
        : !q.data?.length ? <p className="text-sm text-muted-foreground">Nenhuma turma ativa nesta data.</p>
        : <div className="flex flex-wrap gap-2">{q.data.map((c) => (
            <Link key={c.id} to="/diario/turmas/$turmaId/avaliacao/conselho" params={{ turmaId: c.id }}
              className="rounded border px-2 py-1 text-sm hover:bg-accent">{c.name}</Link>))}</div>}
      <p className="text-xs text-muted-foreground">Abra a turma para conduzir a sessão, registrar presença, deliberações e a ata.</p>
    </section>
  );
}
