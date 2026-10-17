import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { z, parseBoundary } from "@/lib/runtime-shape";
import { callRpc } from "@/lib/rpc-call";
const schema = z.array(z.object({ authorization_id: z.string().uuid(), guardian_name: z.string(), indicated: z.boolean(), sequence: z.number().int() }));
export function ProtectionRecipients({ school, student, measure, protectionSeq }: { school: string; student: string; measure: string; protectionSeq: number }) {
  const qc = useQueryClient();
  const key = ["protection-recipients", school, student, measure, protectionSeq];
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: key, retry: false, queryFn: async () => parseBoundary(schema, await callRpc("school_protection_recipients", { _school: school, _student: student, _measure: measure }), "school_protection_recipients") });
  async function save(id: string, sequence: number, indicated: boolean) {
    setBusy(true); setError(null);
    try {
      await callRpc("record_protection_recipient", { _school: school, _student: student, _measure: measure, _authorization: id, _action: indicated ? "retirar" : "indicar", _reason: reason, _expected_seq: sequence, _expected_protection_seq: protectionSeq });
      setReason(""); await qc.invalidateQueries({ queryKey: key });
    } catch { setError("Não foi possível salvar a indicação. Reabra a ficha e confira o responsável e a medida."); }
    finally { setBusy(false); }
  }
  return <div className="mt-2 space-y-2">
    <p className="font-medium">Responsáveis que recebem o aviso de retirada</p>
    {q.isPending && <p role="status">Consultando responsáveis…</p>}
    {q.isError && <p role="alert" className="text-destructive">Não foi possível consultar os responsáveis.</p>}
    {q.data?.length === 0 && <p>Nenhum responsável com autorização vigente e conta vinculada. Cadastre o vínculo em Autorizações de responsáveis.</p>}
    {!!q.data?.length && <>
      <Input aria-label="Motivo da indicação do responsável" placeholder="Motivo da indicação ou retirada" value={reason} onChange={(e) => setReason(e.target.value)} />
      <ul className="space-y-2">{q.data.map((r) => <li key={r.authorization_id} className="flex flex-wrap items-center justify-between gap-2">
        <span>{r.guardian_name} · {r.indicated ? "Recebe aviso" : "Não recebe aviso"}</span>
        <Button size="sm" variant="outline" disabled={busy || reason.trim().length < 5} onClick={() => void save(r.authorization_id, r.sequence, r.indicated)}>{r.indicated ? "Retirar indicação" : "Indicar responsável"}</Button>
      </li>)}</ul>
    </>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </div>;
}
