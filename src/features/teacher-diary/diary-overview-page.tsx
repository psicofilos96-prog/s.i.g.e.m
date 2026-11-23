import { operationalToday } from "@/lib/academic-date";
import { readPages } from "@/lib/list-paging";
import { supabase } from "@/integrations/supabase/client";
/**
 * Frente W.2 — acompanhamento dos Diários SOMENTE LEITURA (Direção/Secretaria da própria escola; rede por capacidade).
 * Mostra existência, versões e contagens; nenhum conteúdo de aula, nenhuma marcação individual, nenhuma ação de autoria docente.
 */
import { SkeletonState } from "@/components/sigem/guidance";
import { useEffect, useState } from "react";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { Badge } from "@/components/ui/badge";
import { diaryMessage, readSchoolOverview, type OverviewRow } from "./diary-w-source";
import { DiaryOversightSection } from "@/features/diary-oversight/diary-oversight-section";

const today = () => operationalToday();
const monthStart = () => today().slice(0, 8) + "01";

export function DiaryOverviewPage() {
  const [school, setSchool] = useState("");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [rows, setRows] = useState<OverviewRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!school.trim()) { setRows(null); return; }
    let live = true; setRows(null); setErr(null);
    readSchoolOverview(school.trim(), from, to).then((r) => live && setRows(r)).catch((e) => live && setErr(diaryMessage((e as Error).message)));
    return () => { live = false; };
  }, [school, from, to]);
  const [classIds, setClassIds] = useState<string[]>([]);
  useEffect(() => {
    if (!school.trim()) { setClassIds([]); return; }
    let live = true;
    void readPages<{ id: string }>((f, t) => (supabase as unknown as { from: (t: string) => any }).from("institutional_classes").select("id").eq("school_id", school.trim()).order("id").range(f, t), 20000)
      .then(({ data }) => live && setClassIds((data ?? []).map((c) => c.id)));
    return () => { live = false; };
  }, [school]);
  const kind = rows?.[0]?.result_kind;
  const lessons = rows?.filter((r) => r.result_kind === "lesson") ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title="Acompanhamento dos diários" description="Veja as aulas e chamadas registradas pela escola. Para registrar ou corrigir uma aula, o professor responsável deve abrir o Diário." />
      <div className="grid max-w-2xl gap-2 sm:grid-cols-3">
        <label className="text-sm">Código da escola<input className="w-full rounded border bg-background p-2 text-sm" value={school} onChange={(e) => setSchool(e.target.value)} /></label>
        <label className="text-sm">De<DateInput value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm">Até<DateInput value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {!school.trim() ? <EmptyState title="Digite o código da escola" description="A escola ainda não foi informada, por isso os registros não podem ser buscados. Digite o código no campo acima para consultar as aulas e chamadas." />
        : err ? <StatePanel tone="danger" title="Não foi possível buscar os diários" description={`${err} Confira a conexão e tente buscar novamente.`} />
        : !rows ? <SkeletonState label="Carregando" />
        : kind === "access-denied" ? <StatePanel tone="warning" title="Você não pode consultar o Diário desta escola" description="Sua conta não tem autorização para ver estes registros. Peça à gestão responsável para conferir seu acesso à escola." />
        : kind === "invalid" ? <StatePanel tone="warning" title="Confira as datas" description="O período precisa ter até 62 dias e começar antes de terminar. Ajuste os campos De e Até para buscar novamente." />
        : lessons.length === 0 ? <EmptyState title="Nenhuma aula registrada neste período" description="Não há registros de aula para a escola e as datas escolhidas. Confira os campos De e Até ou escolha outro período; a ausência de registro não confirma falta nem que a aula não ocorreu." />
        : (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Aulas registradas no período"><table className="w-full text-sm">
            <caption className="sr-only">Aulas registradas no período</caption><thead><tr className="text-left"><th scope="col">Data</th><th scope="col">Turma</th><th scope="col">Componente curricular</th><th scope="col">Registro</th><th scope="col">Chamada</th></tr></thead>
            <tbody>{lessons.map((r) => (
              <tr key={r.logical_record_id ?? ""} className="border-t">
                <td>{r.lesson_date}</td><td>{r.class_id}</td><td>{r.component_id}</td>
                <td>Versão {r.lesson_version} {r.recorded_as === "substituto" && <Badge variant="outline">Substituição</Badge>}</td>
                <td>{r.attendance_version ? `Versão ${r.attendance_version} · ${r.marked_count} de ${r.eligible_count} registros de frequência` : "Sem chamada registrada"}</td>
              </tr>))}</tbody>
          </table></div>)}
      {rows && kind !== "access-denied" && kind !== "invalid" ? <DiaryOversightSection lessons={lessons} from={from} to={to} schoolClassIds={classIds} /> : null}
    </div>
  );
}
