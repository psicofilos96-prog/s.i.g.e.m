/**
 * B3.3 — Painel da posição curricular individual por alocação. Ausência é exibida por extenso;
 * esquema é digitado (catálogo aberto, D1 pendente) e só valores homologados são oferecidos.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/sigem/date-input";
import { formatAcademicDate as fmt } from "@/lib/academic-date";
import { homologatedValues } from "./cycle-enrollment-source";
import {
  positionDraftProblems, positionMessage, readAllocationPositions, recordAllocationPosition,
  type AllocationPositionRow, type PositionAxis,
} from "./allocation-curricular-position-source";

export function AllocationPositionsPanel({ school, validOn, canMaintain }: { school: string; validOn: string; canMaintain: boolean }) {
  const q = useQuery({ queryKey: ["b3", "positions", school, validOn], queryFn: () => readAllocationPositions({ school }, { validOn }) });
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <h3 className="font-medium">Posição curricular individual em {fmt(validOn)}</h3>
      <p className="text-xs text-muted-foreground">Registrada por estudante na alocação; nunca deduzida da turma. AEE e atividade complementar não são etapa.</p>
      {q.error && <p role="alert">{positionMessage(q.error)}</p>}
      {q.data && q.data.length === 0 && <p className="text-muted-foreground">Nenhuma alocação vigente nesta data.</p>}
      <ul className="space-y-2">
        {q.data?.map((r) => <PositionRow key={r.allocationId} row={r} validOn={validOn} canMaintain={canMaintain} />)}
      </ul>
    </div>
  );
}

function PositionRow({ row, validOn, canMaintain }: { row: AllocationPositionRow; validOn: string; canMaintain: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(row.position?.validFrom ?? validOn);
  const [until, setUntil] = useState(row.position?.validUntil ?? "");
  const [axes, setAxes] = useState<PositionAxis[]>(row.position?.axes ?? []);
  const [scheme, setScheme] = useState("");
  const [reason, setReason] = useState("");
  const [act, setAct] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const values = useQuery({
    queryKey: ["b3", "position-values", scheme, from],
    enabled: open && scheme.trim().length > 0 && Boolean(from),
    queryFn: () => homologatedValues(scheme.trim(), from),
  });
  const p = row.position;
  const correcting = Boolean(p);
  const problems = positionDraftProblems({ validFrom: from, validUntil: until || null, axes, baseVersionId: p?.versionId ?? null, reason });
  const save = async (annul = false, successive = false) => {
    setMsg(null);
    try {
      await recordAllocationPosition({
        logicalId: successive || !p ? `pos-${crypto.randomUUID()}` : p.logicalId,
        baseVersionId: successive || !p ? null : p.versionId,
        allocationLogicalId: row.allocationLogicalId, validFrom: from, validUntil: until || null, axes,
        actRef: act || null, reason: reason || null, annul,
      });
      setMsg(annul ? "Posição anulada (nova versão)." : "Posição registrada como nova versão.");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["b3", "positions"] });
    } catch (e) { setMsg(positionMessage(e)); }
  };
  return (
    <li className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span>{row.studentId} · turma {row.classId}:</span>
        {p ? <span>{p.axes.map((a) => `${a.scheme}=${a.value} (v${a.version})`).join(" · ")} · {fmt(p.validFrom)}{p.validUntil ? `–${fmt(p.validUntil)}` : ""} · versão {p.version}</span>
          : <span className="text-muted-foreground">Posição curricular não registrada.</span>}
        {canMaintain && <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>{p ? "Corrigir / nova posição" : "Registrar posição"}</Button>}
      </div>
      {msg && <p role="status" className="text-xs">{msg}</p>}
      {open && (
        <div className="space-y-2 rounded border border-dashed border-border p-2">
          <div className="flex flex-wrap gap-2">
            <DateInput aria-label="Início da posição" value={from} onChange={(e) => setFrom(e.target.value)} />
            <DateInput aria-label="Fim da posição (opcional)" value={until} onChange={(e) => setUntil(e.target.value)} />
            <Input aria-label="Ato de origem" placeholder="Ato de origem" className="w-48" value={act} onChange={(e) => setAct(e.target.value)} />
          </div>
          <ul className="text-xs">
            {axes.map((a) => (
              <li key={a.scheme}>{a.scheme} = {a.value} (v{a.version}){" "}
                <button type="button" className="underline" onClick={() => setAxes(axes.filter((x) => x.scheme !== a.scheme))}>remover</button></li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Input aria-label="Esquema do catálogo (ID)" placeholder="ID do esquema do catálogo" className="w-56" value={scheme} onChange={(e) => setScheme(e.target.value)} />
            {scheme.trim() && values.data?.length === 0 && <span className="text-xs text-muted-foreground">Sem valor homologado neste esquema na data; nada a escolher.</span>}
            {values.data && values.data.length > 0 && (
              <select aria-label="Valor homologado" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value=""
                onChange={(e) => {
                  const v = values.data!.find((x) => `${x.valueId}@${x.version}` === e.target.value);
                  if (v) setAxes([...axes.filter((x) => x.scheme !== scheme.trim()), { scheme: scheme.trim(), value: v.valueId, version: v.version }]);
                }}>
                <option value="">Valor…</option>
                {values.data.map((v) => <option key={`${v.valueId}@${v.version}`} value={`${v.valueId}@${v.version}`}>{v.label} ({v.valueId} v{v.version})</option>)}
              </select>
            )}
          </div>
          {correcting && <Input aria-label="Motivo da correção" placeholder="Motivo (obrigatório na correção)" value={reason} onChange={(e) => setReason(e.target.value)} />}
          {problems.length > 0 && <ul role="alert" className="text-xs text-destructive">{problems.map((x) => <li key={x}>{x}</li>)}</ul>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={problems.length > 0} onClick={() => save(false)}>{correcting ? "Gravar correção" : "Registrar"}</Button>
            {correcting && <Button size="sm" variant="outline" disabled={positionDraftProblems({ validFrom: from, validUntil: until || null, axes, baseVersionId: null, reason }).length > 0} onClick={() => save(false, true)}>Registrar posição sucessiva</Button>}
            {correcting && <Button size="sm" variant="outline" disabled={!reason.trim()} onClick={() => save(true)}>Anular</Button>}
          </div>
        </div>
      )}
    </li>
  );
}
