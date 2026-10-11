import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader, StatePanel, EmptyState } from "@/components/sigem/patterns";
import { readCurrentSchoolNames, sortedSchoolOptions } from "@/features/units/current-school-names";
import { HEALTH_KIND_LABEL, healthMessage } from "./family-health";
import { readSchoolHealth, type SchoolHealthRow } from "./family-health-source";

/** Equipe de alimentação: lê só as declarações vigentes da própria escola. Leitura sob demanda, registrada no banco; nada é guardado no navegador. */
export function SchoolHealthPage() {
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [school, setSchool] = useState("");
  const [rows, setRows] = useState<SchoolHealthRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void readCurrentSchoolNames().then((m) => setSchools(sortedSchoolOptions(m)), () => setSchools([])); }, []);
  async function open() {
    setBusy(true); setErr(null); setRows(null);
    try { setRows(await readSchoolHealth(school)); } catch (e) { setErr(healthMessage((e as Error).message)); }
    setBusy(false);
  }
  return (
    <div className="space-y-4">
      <PageHeader title="Informações de saúde declaradas pela família" description="Alimentação, alergias e medicamentos. Dado sensível: use só para o cuidado do estudante; cada consulta fica registrada." />
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">Escola<select className="mt-1 block rounded border bg-background p-2" value={school} onChange={(e) => { setSchool(e.target.value); setRows(null); }}>
          <option value="">Escolha…</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <Button type="button" disabled={!school || busy} onClick={() => void open()}>Consultar</Button>
      </div>
      {err && <StatePanel tone="danger" title="Consulta recusada" description={err} />}
      {rows && rows.length === 0 && <EmptyState title="Nenhuma informação vigente" description="Nenhum responsável autorizado declarou informação de saúde para estudantes com matrícula vigente nesta escola." />}
      {rows && rows.length > 0 && (
        <table className="w-full text-sm" aria-label="Declarações vigentes">
          <thead><tr className="text-left"><th scope="col">Estudante</th><th scope="col">Tipo</th><th scope="col">Descrição</th><th scope="col">Orientação</th><th scope="col">Versão</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i} className="border-t align-top"><td>{r.student_name}{r.internal_id ? ` · ${r.internal_id}` : ""}</td><td>{HEALTH_KIND_LABEL[r.kind]}</td>
              <td>{r.description}</td><td>{r.instructions ?? "—"}</td><td>v{r.version}</td></tr>))}</tbody>
        </table>)}
    </div>
  );
}
