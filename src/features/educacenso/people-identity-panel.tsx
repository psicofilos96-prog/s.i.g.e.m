import { humanizeForScreen } from "@/config/technical-codes";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PEOPLE_STATE_LABEL, COLLISION_LABEL, REVIEW_LABEL, peoplePendencies, type PeopleAt } from "./people-identity";

import { LoadingState } from "@/components/sigem/states";
const field = "h-8 rounded-md border bg-background px-2 text-sm";

/** LOTE 04 — pessoas da escola para o Educacenso: só leitura mascarada; nenhum dado ausente é inferido. */
export function PeopleIdentityPanel({ schools, names, network }: { schools: string[]; names: Map<string, string>; network: boolean }) {
  const [school, setSchool] = useState(schools[0] ?? "");
  const [data, setData] = useState<PeopleAt | "error" | null>(null);
  const [page, setPage] = useState(0);
  const [reason, setReason] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!school) return; setData(null);
    const r = await supabase.rpc("educacenso_people_at", { _school: school, _limit: 100, _offset: page * 100 });
    setData(r.error ? "error" : (r.data as unknown as PeopleAt));
  }, [school, page]);
  useEffect(() => { void load(); }, [load]);
  if (schools.length === 0) return null;
  const review = async (key: string, kind: string, persons: string[], decision: string, seq: number) => {
    const r = await supabase.rpc("educacenso_identity_review", { _key: key, _kind: kind, _persons: persons, _decision: decision, _reason: reason, _expected_seq: seq });
    setMsg(r.error ? (r.error.message.includes("reason") ? "Informe o motivo (mín. 5 caracteres)." : r.error.message.includes("stale") ? "Outra pessoa revisou antes; recarregado." : "Não foi possível registrar.") : "Revisão registrada.");
    if (!r.error) setReason(""); void load();
  };
  return (
    <section className="rounded-md border p-3" aria-label="Pessoas e identidade">
      <h2 className="text-sm font-semibold">Pessoas e identidade (Registros 30/40/50/60)</h2>
      <p className="mb-2 text-xs text-muted-foreground">Nomes mascarados e identificadores parciais. CPF, raça/cor, deficiência e sexo nunca são deduzidos: o que não está no cadastro aparece como ausente. Possíveis duplicidades vão para revisão da rede; o sistema não unifica pessoas.</p>
      <label className="text-xs">Escola<br />
        <select aria-label="Escola" className={field} value={school} onChange={(e) => { setSchool(e.target.value); setPage(0); }}>
          {schools.map((s) => <option key={s} value={s}>{names.get(s) ?? s}</option>)}
        </select></label>
      {data === null ? <LoadingState label="Carregando…" /> : data === "error" ? <p role="alert" className="mt-2 text-xs">Sem permissão para ver as pessoas desta escola ou falha na leitura.</p> : <>
        <div className="my-2 grid gap-2 text-xs sm:grid-cols-4">
          <div>{data.summary.students} alunos com enturmação · {data.summary.professionals} profissionais com atuação</div>
          <div>INEP: {data.summary.inep_valid} válidos · {data.summary.inep_invalid} inválidos · {data.summary.inep_missing} ausentes</div>
          <div>CPF registrado: {data.summary.cpf_present} · nascimento: {data.summary.birth_present} · sexo: {data.summary.sex_present}</div>
          <div>{data.summary.staff_records_without_person} linhas de pessoal sem pessoa conciliada · {data.summary.collisions} possíveis duplicidades</div>
        </div>
        <ul className="mb-2 list-disc pl-5 text-xs">{peoplePendencies(data.summary).map((p) => <li key={p}>{p}</li>)}</ul>
        {data.collisions.length > 0 && <div className="mb-3 rounded-md border p-2"><h3 className="text-xs font-semibold">Fila de revisão de duplicidade</h3>
          {network && <input aria-label="Motivo da revisão" placeholder="Motivo da decisão" className={`${field} my-1 w-full`} value={reason} onChange={(e) => setReason(e.target.value)} />}
          <ul className="space-y-1 text-xs">{data.collisions.map((c) => <li key={c.key}>{COLLISION_LABEL[c.kind] ?? c.kind}: {(c.masked_names ?? []).join(" · ")} — {c.review ? `${REVIEW_LABEL[c.review.decision] ?? c.review.decision} (${humanizeForScreen(c.review.reason)})` : "aguardando revisão"}
            {network && (c.review?.decision === "manter-separados" || c.review?.decision === "encaminhar-correcao-na-origem"
              ? <Button size="sm" variant="outline" className="ml-2 h-6" onClick={() => void review(c.key, c.kind, c.person_ids, "reabrir", c.review!.seq)}>Reabrir</Button>
              : <><Button size="sm" variant="outline" className="ml-2 h-6" onClick={() => void review(c.key, c.kind, c.person_ids, "manter-separados", c.review?.seq ?? 0)}>São pessoas diferentes</Button>
                <Button size="sm" variant="outline" className="ml-1 h-6" onClick={() => void review(c.key, c.kind, c.person_ids, "encaminhar-correcao-na-origem", c.review?.seq ?? 0)}>Corrigir na origem</Button></>)}</li>)}</ul>
          {msg && <p role="status" className="mt-1 text-xs">{msg}</p>}</div>}
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="text-left"><th scope="col">Pessoa</th><th scope="col">Papel</th><th scope="col">INEP</th><th scope="col">CPF</th><th scope="col">Nascimento</th><th scope="col">Sexo</th><th scope="col">Cor/raça</th><th scope="col">Deficiência</th></tr></thead>
          <tbody>{data.people.map((p) => <tr key={p.role + p.local_ref} className="border-t">
            <td>{p.masked_name ?? "sem pessoa conciliada"}</td><td>{p.role}</td><td>{p.inep_masked ?? "—"} <span className="text-muted-foreground">({PEOPLE_STATE_LABEL[p.inep]})</span></td>
            <td>{PEOPLE_STATE_LABEL[p.cpf]}</td><td>{PEOPLE_STATE_LABEL[p.birth]}</td><td>{PEOPLE_STATE_LABEL[p.sex]}</td><td>sem fonte no SIGEM</td><td>via NEI (não lido aqui)</td></tr>)}</tbody>
        </table></div>
        <div className="mt-2 flex gap-2"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
          <Button size="sm" variant="outline" disabled={data.people.length < 100} onClick={() => setPage(page + 1)}>Próxima</Button></div>
      </>}
    </section>
  );
}
