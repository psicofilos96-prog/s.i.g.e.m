import { useMemo, useState } from "react";
import { buildCapabilityMatrix, CAPABILITY_INVENTORY, STATUS_LABEL, type MatrixStatus } from "./capability-matrix";
import type { PolicyRule } from "./policy-governance";

type Eng = { id: string; engagement_kind_id: string; valid_from: string; valid_until: string | null };

/** Matriz só leitura; atribuir = nova versão da política na seção "Políticas de capacidades". */
export function CapabilityMatrixSection({ rules, policyVersion, engagements, endings, on }: { rules: readonly PolicyRule[] | null; policyVersion: number | null; engagements: readonly Eng[]; endings: ReadonlyMap<string, string>; on: string }) {
  const [module, setModule] = useState("todos");
  const [status, setStatus] = useState<"todos" | MatrixStatus>("todos");
  const rows = useMemo(() => buildCapabilityMatrix(CAPABILITY_INVENTORY, rules ?? [], engagements, endings, on), [rules, engagements, endings, on]);
  const modules = [...new Set(rows.map((r) => r.module))].sort();
  const shown = rows.filter((r) => (module === "todos" || r.module === module) && (status === "todos" || r.status === status));
  const count = (s: MatrixStatus) => rows.filter((r) => r.status === s).length;
  return (
    <section className="mt-6 space-y-3" aria-labelledby="matriz-cap">
      <h2 id="matriz-cap" className="text-lg font-semibold">Matriz de capacidades</h2>
      <p className="text-sm text-muted-foreground">
        {rows.length} capacidades exigidas pelo banco × política {policyVersion ? `vigente v${policyVersion}` : "vigente (nenhuma única vigente — tudo aparece sem titular)"}. Nada é atribuído aqui: atribuição só por nova versão da política, homologada por quem tem competência.
      </p>
      <ul className="flex flex-wrap gap-3 text-sm">
        <li>Sem titular: <strong>{count("sem-titular")}</strong></li>
        <li>Regra sem atuação vigente: <strong>{count("regra-sem-vinculo-vigente")}</strong></li>
        <li>Com titular: <strong>{count("com-titular")}</strong></li>
      </ul>
      <div className="flex flex-wrap gap-2 text-sm">
        <label>Módulo <select aria-label="Filtrar por módulo" value={module} onChange={(e) => setModule(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1">
          <option value="todos">Todos</option>{modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select></label>
        <label>Situação <select aria-label="Filtrar por situação" value={status} onChange={(e) => setStatus(e.target.value as never)} className="rounded-md border border-input bg-background px-2 py-1">
          <option value="todos">Todas</option>{(Object.keys(STATUS_LABEL) as MatrixStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select></label>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left"><tr><th className="p-2">Capacidade</th><th className="p-2">Módulo</th><th className="p-2">Escopo exigido</th><th className="p-2">Tipos de atuação na política</th><th className="p-2">Situação</th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="p-2 font-mono text-xs">{r.id}<div className="text-muted-foreground">{r.firstMigration}</div></td>
                <td className="p-2">{r.module}</td>
                <td className="p-2">{r.scopes.join(", ")}</td>
                <td className="p-2">{r.holders.length === 0 ? "—" : r.holders.map((h) => `${h.engagementKind} [${h.scope.join(",") || "sem escopo"}] · ${h.activeEngagements} vigente(s)`).join("; ")}</td>
                <td className={r.status === "com-titular" ? "p-2 text-primary" : "p-2 text-destructive"}>{STATUS_LABEL[r.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
