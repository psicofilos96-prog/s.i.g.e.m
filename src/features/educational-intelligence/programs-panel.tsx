import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { governError } from "@/lib/observability/governed-errors";
import { registrationState } from "./program-catalog";

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);

/** Registro de programa é ato humano pelo writer existente (capability + pessoa natural); nada é semeado. */
export function ProgramsPanel({ registeredNames, onChanged }: { registeredNames: string[] | null; onChanged: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const rows = registrationState(registeredNames ?? []);
  const register = async (key: string) => {
    const p = rows.find((r) => r.spec.key === key)!.spec;
    setBusy(key);
    const { error } = await rpc("record_assessment_program", { _base_id: null, _kind: "registro", _name: p.name, _origin: p.origin, _application: p.application,
      _correction: p.correction, _delivery: p.delivery, _source: `Catálogo SIGEM 2.0 A&A (${p.key}); escala ${p.scaleKey}; fonte oficial pendente`, _reason: "Registro do programa a partir do catálogo metodológico" });
    setBusy(null);
    setMsg(error ? governError(error).userMessage : `${p.name} registrado em seu nome.`);
    if (!error) onChanged();
  };
  return (
    <div className="space-y-3">
      <StatePanel tone="info" title="Programas e metodologia" description="Identidade e metodologia de cada programa. Escala oficial, faixas, metas e matriz ficam pendentes até a fonte oficial ser importada. Nenhum resultado é criado aqui." />
      {registeredNames === null && <StatePanel tone="warning" title="Situação de registro desconhecida" description="Não foi possível ler os programas registrados." />}
      {msg && <p role="status" className="text-sm">{msg}</p>}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr><th scope="col" className="p-2">Programa</th><th scope="col" className="p-2">População</th><th scope="col" className="p-2">Ciclos/edições</th><th scope="col" className="p-2">Nível</th><th scope="col" className="p-2">Escala</th><th scope="col" className="p-2">Integra</th><th scope="col" className="p-2">Situação</th></tr></thead>
          <tbody>
            {rows.map(({ spec: p, registered }) => (
              <tr key={p.key} className="border-t align-top">
                <td className="p-2 font-medium">{p.name}<div className="text-xs text-muted-foreground">{p.origin} · {p.note}</div></td>
                <td className="p-2">{p.population}</td>
                <td className="p-2">{[...p.cycles, ...p.editionsDeclared].join(", ") || "a declarar"}</td>
                <td className="p-2">{p.grains.join(", ")}{p.studentLevelLegit ? "" : " (sem estudante)"}</td>
                <td className="p-2">{p.scaleKind}<div className="text-xs text-muted-foreground">oficial: pendente</div></td>
                <td className="p-2">{p.integrations.join(", ")}</td>
                <td className="p-2">{registered ? <StatusBadge tone="success">Registrado</StatusBadge> : registeredNames === null ? <StatusBadge tone="neutral">Desconhecido</StatusBadge> :
                  <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void register(p.key)}>{busy === p.key ? "Registrando…" : "Registrar"}</Button>}</td>
              </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
