import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { callRpc } from "@/lib/rpc-call";
import { userErrorText } from "@/lib/observability/governed-errors";
import { useSessionAuthority } from "@/features/authority/session-authority";

type Row = { student_id: string; student_name: string; present: number; absent: number; rate: number; limit_pct: number; limit_version: number };

/** Estudantes abaixo do limite de frequência da escola, só com chamadas oficiais do Diário. Sem chamada = fora da lista, nunca falta. */
export function FrequencyRiskPanel({ school, today }: { school: string; today: string }) {
  const auth = useSessionAuthority();
  const s = auth.status === "signed-in" ? auth : null;
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const q = useQuery({ queryKey: ["direcao-frequency-risk", s?.user.id, s?.sessionRevision, school, from, to], enabled: !!s && !!from && !!to, retry: false,
    queryFn: () => callRpc<Row[]>("direcao_students_below_frequency", { _school: school, _from: from, _to: to }) });
  if (!s) return null;
  const missing = q.isError && String((q.error as Error).message).includes("frequency-limit-missing");
  return (
    <section aria-label="Estudantes abaixo do limite de frequência" className="rounded-lg border bg-card p-4 space-y-3">
      <h2 className="font-semibold">Estudantes abaixo do limite de frequência</h2>
      <div className="flex flex-wrap gap-2 text-sm">
        <label>De <input type="date" className="rounded border bg-background px-2 py-1" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>Até <input type="date" className="rounded border bg-background px-2 py-1" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {q.isLoading ? <p className="text-sm text-muted-foreground">…</p>
        : missing ? <p className="text-sm text-muted-foreground">Defina primeiro a frequência de corte em "Limites de risco da escola".</p>
        : q.isError ? <p className="text-sm text-destructive">{userErrorText(q.error as Error)}</p>
        : !q.data?.length ? <p className="text-sm text-muted-foreground">Nenhum estudante abaixo do limite no período, considerando as chamadas registradas.</p>
        : (<>
          <p className="text-xs text-muted-foreground">Limite: {q.data[0]!.limit_pct}% (versão {q.data[0]!.limit_version}) · {q.data.length} estudante(s)</p>
          <ul className="divide-y text-sm">
            {q.data.map((r) => (
              <li key={r.student_id} className="flex justify-between py-1">
                <span>{r.student_name}</span>
                <span className="text-muted-foreground">{r.rate}% · {r.absent} falta(s) em {r.present + r.absent} aula(s)</span>
              </li>))}
          </ul>
        </>)}
      <p className="text-xs text-muted-foreground">Só contam aulas com chamada registrada no Diário. O risco por nota aguarda a regra de médias da rede.</p>
    </section>
  );
}
