/** L41 — vínculos da folha (agosto/2026) agrupados por servidor, lidos pela RLS da sessão. Sem salário; sem ligação presumida a pessoa. */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { readPages } from "@/lib/list-paging";
import { SkeletonState } from "@/components/sigem/guidance";
import { EmptyState, StatePanel } from "@/components/sigem/patterns";
import { filterPayrollServants, groupPayrollServants, payrollSummary, type PayrollRegRow } from "./payroll-servants-model";

const db = supabase as unknown as { from: (t: string) => any };
const COLS = "registration_id, servant_key, reference_period, registration_raw, full_name, birth_date, admission_date, monthly_hours, weekly_workload_text, cargo_code, cargo_label, linked_person_id";
const PAGE = 50;

async function loadPayroll(): Promise<{ rows: PayrollRegRow[]; truncated: boolean }> {
  const { data, error, truncated } = await readPages<PayrollRegRow>((a, b) => db.from("payroll_servant_registrations").select(COLS).order("registration_id").range(a, b), 20000);
  if (error) throw new Error(error.message);
  return { rows: data ?? [], truncated };
}
async function loadPersisted(): Promise<{ total: number; candidates: Map<string, number> }> {
  const [sv, cand] = await Promise.all([
    readPages<{ id: string; servant_key: string }>((a, b) => db.from("payroll_functional_servants").select("id, servant_key").order("id").range(a, b), 20000),
    readPages<{ servant_id: string }>((a, b) => db.from("payroll_servant_identity_candidates").select("servant_id").order("id").range(a, b), 20000),
  ]);
  if (sv.error) throw new Error(sv.error.message);
  if (cand.error) throw new Error(cand.error.message);
  const byId = new Map<string, number>();
  for (const c of cand.data ?? []) byId.set(c.servant_id, (byId.get(c.servant_id) ?? 0) + 1);
  const candidates = new Map<string, number>();
  for (const s of sv.data ?? []) candidates.set(s.servant_key, byId.get(s.id) ?? 0);
  return { total: (sv.data ?? []).length, candidates };
}
const date = (d: string | null) => (d ? d.split("-").reverse().join("/") : "não informada");

export function PayrollServants({ uid }: { uid: string }) {
  const q = useQuery({ queryKey: ["payroll-servants", uid], queryFn: loadPayroll, retry: false });
  const persisted = useQuery({ queryKey: ["payroll-servants-persisted", uid], queryFn: loadPersisted, retry: false });
  const [text, setText] = useState("");
  const [multi, setMulti] = useState(false);
  const [page, setPage] = useState(0);
  const servants = useMemo(() => groupPayrollServants(q.data?.rows ?? []), [q.data]);
  if (q.isLoading) return <SkeletonState label="Lendo vínculos da folha" />;
  if (q.isError) return <StatePanel tone="danger" title="Folha indisponível" description="A leitura foi recusada ou falhou. Nome e nascimento só aparecem para quem consulta registro funcional." />;
  if (!servants.length) return <EmptyState title="Nenhum vínculo visível" description="Sua conta não tem a permissão de consultar registro funcional da rede." />;
  const s = payrollSummary(servants);
  const rows = filterPayrollServants(servants, text, multi);
  const view = rows.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <section aria-labelledby="payroll-servants" className="space-y-3">
      <h2 id="payroll-servants" className="font-semibold">Vínculos da folha — agosto/2026</h2>
      <p className="text-xs text-muted-foreground">Cada matrícula é um vínculo funcional. Mesmo nome e mesma data de nascimento agrupam os vínculos num servidor só para visualização — esse agrupamento não confirma identidade com o cadastro de pessoas nem com o Educacenso; homônimos com nascimento diferente ficam separados. Ligação ao cadastro de pessoas (inclusive Educacenso) só aparece quando comprovada por identificador. Dados de remuneração não são exibidos.</p>
      {q.data?.truncated && <StatePanel tone="warning" title="Lista parcial" description="A leitura atingiu o limite; os totais abaixo não são completos." />}
      <dl className="grid gap-2 sm:grid-cols-4 text-sm">
        <div className="rounded-md border p-2"><dt className="text-xs text-muted-foreground">Vínculos (matrículas)</dt><dd className="tabular-nums text-lg">{s.vinculos}</dd></div>
        <div className="rounded-md border p-2"><dt className="text-xs text-muted-foreground">Servidores</dt><dd className="tabular-nums text-lg">{s.servidores}</dd></div>
        <div className="rounded-md border p-2"><dt className="text-xs text-muted-foreground">Com mais de um vínculo</dt><dd className="tabular-nums text-lg">{s.comMaisDeUmVinculo}</dd></div>
        <div className="rounded-md border p-2"><dt className="text-xs text-muted-foreground">Ligados ao cadastro de pessoas</dt><dd className="tabular-nums text-lg">{s.ligadosAPessoa}</dd></div>
        <div className="rounded-md border p-2"><dt className="text-xs text-muted-foreground">Cadastros funcionais persistidos</dt><dd className="tabular-nums text-lg">{persisted.data ? persisted.data.total : persisted.isError ? "indisponível" : "…"}</dd></div>
      </dl>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="text-sm">Buscar por nome ou matrícula<input className="mt-1 block min-h-11 w-full rounded-md border bg-background px-2" value={text} onChange={(e) => { setText(e.target.value); setPage(0); }} /></label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={multi} onChange={(e) => { setMulti(e.target.checked); setPage(0); }} />Só com mais de um vínculo</label>
      </div>
      <p className="text-sm text-muted-foreground">{rows.length} servidor(es)</p>
      <ul className="space-y-2">{view.map((sv) => (
        <li key={sv.key} className="rounded-md border p-3">
          <p className="font-medium">{sv.name} <span className="text-xs text-muted-foreground">· {sv.registrations.length} vínculo(s){sv.linkedPersonIds.length ? " · ligado ao cadastro" : " · sem ligação comprovada"}{persisted.data?.candidates.get(sv.key) ? ` · ${persisted.data.candidates.get(sv.key)} candidato(s) por matrícula idêntica — a conferir` : ""}</span></p>
          <div className="overflow-x-auto"><table className="mt-1 w-full text-sm"><caption className="sr-only">Vínculos de {sv.name}</caption>
            <thead><tr className="text-left text-xs text-muted-foreground"><th scope="col">Matrícula</th><th scope="col">Cargo</th><th scope="col">Admissão</th><th scope="col">Jornada</th></tr></thead>
            <tbody>{sv.registrations.map((r) => (
              <tr key={r.registration_id} className="border-t"><td className="tabular-nums">{r.registration_raw}</td><td>{r.cargo_label ?? "não informado"}{r.cargo_code ? ` (${r.cargo_code})` : ""}</td>
                <td className="tabular-nums">{date(r.admission_date)}</td><td>{r.monthly_hours != null ? `${r.monthly_hours} h/mês` : "não informada"}{r.weekly_workload_text ? ` · ${r.weekly_workload_text}` : ""}</td></tr>))}</tbody></table></div>
        </li>))}</ul>
      {rows.length > PAGE && <div className="flex items-center gap-2 text-sm">
        <button className="min-h-11 rounded border px-3 disabled:opacity-50" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</button>
        <span>Página {page + 1} de {Math.ceil(rows.length / PAGE)}</span>
        <button className="min-h-11 rounded border px-3 disabled:opacity-50" disabled={(page + 1) * PAGE >= rows.length} onClick={() => setPage(page + 1)}>Próxima</button></div>}
    </section>
  );
}
