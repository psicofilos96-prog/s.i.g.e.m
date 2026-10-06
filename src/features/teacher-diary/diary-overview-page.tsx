/**
 * Frente W.2 — acompanhamento dos Diários SOMENTE LEITURA (Direção/Secretaria da própria escola; rede por capacidade).
 * Mostra existência, versões e contagens; nenhum conteúdo de aula, nenhuma marcação individual, nenhuma ação de autoria docente.
 */
import { useEffect, useState } from "react";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { Badge } from "@/components/ui/badge";
import { diaryMessage, readSchoolOverview, type OverviewRow } from "./diary-w-source";

const today = () => new Date().toLocaleDateString("sv-SE");
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
  const kind = rows?.[0]?.result_kind;
  const lessons = rows?.filter((r) => r.result_kind === "lesson") ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title="Acompanhamento dos diários" description="Consulta somente leitura das aulas registradas. Registrar ou corrigir aula é ato exclusivo do professor da regência." />
      <div className="grid max-w-2xl gap-2 sm:grid-cols-3">
        <label className="text-sm">Escola (código)<input className="w-full rounded border bg-background p-2 text-sm" value={school} onChange={(e) => setSchool(e.target.value)} /></label>
        <label className="text-sm">De<DateInput value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm">Até<DateInput value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {!school.trim() ? <EmptyState title="Informe a escola" description="A consulta só mostra o que sua atuação autoriza." />
        : err ? <StatePanel tone="danger" title="Consulta indisponível" description={err} />
        : !rows ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : kind === "access-denied" ? <StatePanel tone="warning" title="Sem autorização para esta escola" description="Sua atuação vigente não tem capacidade de consulta do Diário nesta escola." />
        : kind === "invalid" ? <StatePanel tone="warning" title="Período inválido" description="Use um intervalo de até 62 dias, com início antes do fim." />
        : lessons.length === 0 ? <EmptyState title="Nenhuma aula registrada no período" description="Ausência de registro não significa que a aula não ocorreu nem que houve falta." />
        : (
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th>Data</th><th>Turma</th><th>Elemento</th><th>Registro</th><th>Chamada</th></tr></thead>
            <tbody>{lessons.map((r) => (
              <tr key={r.logical_record_id ?? ""} className="border-t">
                <td>{r.lesson_date}</td><td>{r.class_id}</td><td>{r.component_id}</td>
                <td>versão {r.lesson_version} {r.recorded_as === "substituto" && <Badge variant="outline">Substituição</Badge>}</td>
                <td>{r.attendance_version ? `versão ${r.attendance_version} · ${r.marked_count} de ${r.eligible_count} marcados` : "sem chamada"}</td>
              </tr>))}</tbody>
          </table>)}
    </div>
  );
}
