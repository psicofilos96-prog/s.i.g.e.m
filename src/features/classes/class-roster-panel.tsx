import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SkeletonState } from "@/components/sigem/guidance";
import { OffsetPager } from "@/components/sigem/list-pager";
import { Input } from "@/components/ui/input";
import { formatAcademicDate } from "@/lib/academic-date";
import { readClassRoster, ROSTER_PAGE_SIZE, type RosterSort } from "./class-roster";

async function classIsAee(classId: string, signal?: AbortSignal): Promise<boolean> {
  const { data, error } = await supabase.from("class_census_declarations").select("value_text")
    .eq("class_id", classId).eq("field", "Tipo de turma").abortSignal(signal as AbortSignal);
  if (error) throw new Error(error.message);
  return (data ?? []).some((r) => /AEE|atendimento educacional especializado/i.test(r.value_text ?? ""));
}

export function ClassRosterPanel({ classId }: { classId: string }) {
  const [page, setPage] = useState(0);
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<RosterSort>("nome");
  useEffect(() => { const t = setTimeout(() => { setSearch(typed); setPage(0); }, 300); return () => clearTimeout(t); }, [typed]);
  const aee = useQuery({ queryKey: ["class-is-aee", classId], queryFn: ({ signal }) => classIsAee(classId, signal) });
  const q = useQuery({
    queryKey: ["class-roster", classId, page, search, sort, aee.data],
    queryFn: ({ signal }) => readClassRoster(classId, { page, search, sort, isAee: !!aee.data }, signal),
    enabled: aee.isSuccess, placeholderData: keepPreviousData,
  });
  const c = q.data?.counts;
  return (
    <section className="rounded-lg border bg-card p-4" aria-labelledby="roster-title">
      <h2 id="roster-title" className="mb-1 flex items-center gap-2 text-sm font-semibold"><ListChecks className="size-4" />Diário nominal da turma · 2026</h2>
      <p className="mb-3 text-xs text-muted-foreground">Relação lida com a sua permissão: só aparecem estudantes que a sua atuação pode ver.</p>
      {c && (
        <dl className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div><dt className="inline text-muted-foreground">Estudantes distintos: </dt><dd className="inline font-medium">{c.distinctStudents}</dd></div>
          <div><dt className="inline text-muted-foreground">Matrículas: </dt><dd className="inline font-medium">{c.distinctEnrollments}</dd></div>
          <div><dt className="inline text-muted-foreground">Vigentes: </dt><dd className="inline font-medium">{c.active}</dd></div>
          <div><dt className="inline text-muted-foreground">Encerrados: </dt><dd className="inline font-medium">{c.ended}</dd></div>
          {q.data?.countsTruncated && <div className="text-muted-foreground">(contagem parcial: limite de leitura atingido)</div>}
        </dl>
      )}
      <div className="mb-3 flex flex-wrap gap-2">
        <Input aria-label="Pesquisar estudante por nome" placeholder="Pesquisar por nome" value={typed} onChange={(e) => setTyped(e.target.value)} className="max-w-xs" />
        <select aria-label="Ordenar" value={sort} onChange={(e) => { setSort(e.target.value as RosterSort); setPage(0); }} className="rounded-md border bg-background px-2 text-sm">
          <option value="nome">Ordem alfabética</option>
          <option value="inicio">Data de início</option>
        </select>
      </div>
      {aee.isLoading || q.isLoading ? <SkeletonState label="Carregando" />
        : aee.error || q.error ? <p role="alert" className="text-sm text-destructive">Não foi possível consultar a relação nominal. Sem permissão para esta turma, nada é exibido.</p>
        : !q.data?.entries.length ? <p className="text-sm text-muted-foreground">{search ? "Nenhum estudante encontrado para essa pesquisa." : "Nenhum estudante visível para a sua atuação."}</p>
        : (
          <>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-1">Estudante</th><th>Vínculo</th><th>Situação</th><th>Início</th></tr></thead>
              <tbody>
                {q.data.entries.map((e) => (
                  <tr key={e.episodeId} className="border-b last:border-0">
                    <td className="py-1"><Link to="/alunos/$id" params={{ id: e.studentId }} className="font-medium hover:underline">{e.studentName ?? "Nome não informado"}</Link>
                      {e.otherActiveClasses > 0 && <span className="ml-2 text-xs text-muted-foreground">também em {e.otherActiveClasses} outra(s) turma(s)</span>}</td>
                    <td>{e.bond === "aee" ? "AEE" : "Regular"}</td>
                    <td>{e.situation.kind === "vigente" ? "Vigente" : `Encerrado em ${formatAcademicDate(e.situation.on)}${e.situation.reason ? ` · ${e.situation.reason}` : ""}`}</td>
                    <td>{e.validFrom ? formatAcademicDate(e.validFrom) : "não informado"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <OffsetPager page={page} pageSize={ROSTER_PAGE_SIZE} total={q.data.total} onPage={setPage} noun="estudantes">
              {`${page * ROSTER_PAGE_SIZE + 1}–${Math.min(q.data.total, (page + 1) * ROSTER_PAGE_SIZE)} de ${q.data.total}`}
            </OffsetPager>
          </>
        )}
    </section>
  );
}
