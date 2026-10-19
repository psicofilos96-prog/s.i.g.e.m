import { useState } from "react";
import { callRpc } from "@/lib/rpc-call";
import { formatInt } from "@/lib/format-ptbr";

type Audit = {
  generated_at: string; cpf_records: number; malformed_fingerprints: number;
  duplicate_groups: { people: string[]; count: number }[];
  applications_same_cpf_requester_student: number; applications_cpf_of_other_person: number;
};

/** Relatório de inconsistências de CPF para revisão administrativa. Só lê; nada é excluído ou corrigido. */
export function CpfAuditPanel() {
  const [a, setA] = useState<Audit | "erro" | null>(null);
  const [busy, setBusy] = useState(false);
  const run = () => { setBusy(true); callRpc<Audit>("cpf_integrity_audit").then(setA, () => setA("erro")).finally(() => setBusy(false)); };
  return (
    <section aria-labelledby="sv-cpf" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="sv-cpf" className="text-lg font-semibold">Conferência dos CPFs</h2>
        <button type="button" onClick={run} disabled={busy} className="rounded-md border border-input bg-background px-3 py-2 text-sm">{busy ? "Conferindo…" : "Conferir agora"}</button>
      </div>
      <p className="text-xs text-muted-foreground">O SIGEM guarda o CPF só de forma protegida, e todo CPF passa pela conferência dos dígitos antes de ser gravado. A conferência é matemática: não confirma a situação na Receita Federal.</p>
      {a === "erro" && <p role="alert" className="text-sm">Não foi possível conferir com esta conta.</p>}
      {a && a !== "erro" && (
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          <li className="p-3">CPFs registrados: {formatInt(a.cpf_records)}</li>
          <li className="p-3">Registros com formato inesperado: {formatInt(a.malformed_fingerprints)}</li>
          <li className="p-3">Mesmo CPF em pessoas diferentes: {formatInt(a.duplicate_groups.length)}
            {a.duplicate_groups.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs">{a.duplicate_groups.map((g, i) => <li key={i}>Pessoas para revisar: {g.people.join(", ")}</li>)}</ul>}
          </li>
          <li className="p-3">Inscrições com o mesmo CPF para responsável e estudante: {formatInt(a.applications_same_cpf_requester_student)}</li>
          <li className="p-3">Inscrições em que os dois CPFs são da mesma pessoa: {formatInt(a.applications_cpf_of_other_person)}</li>
          <li className="p-3 text-xs text-muted-foreground">Nada foi excluído nem corrigido. Gerado em {new Date(a.generated_at).toLocaleString("pt-BR")}.</li>
        </ul>
      )}
    </section>
  );
}
