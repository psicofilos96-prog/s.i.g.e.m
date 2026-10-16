import { Input } from "@/components/ui/input";
import { NETWORK_SCHOOLS, PRIVATE_SCHOOLS } from "@/config/private-schools";
import { supabase } from "@/integrations/supabase/client";

/** Forma de ingresso: aluno novo (primeira matrícula da vida) × transferência recebida (com escola de origem). */
export type EntryOrigin = { entry: "" | "aluno-novo" | "transferencia-recebida"; origin: string; otherName: string };
export const emptyEntryOrigin: EntryOrigin = { entry: "", origin: "", otherName: "" };

export const entryOriginOk = (v: EntryOrigin) =>
  v.entry === "aluno-novo" || (v.entry === "transferencia-recebida" && v.origin !== "" && (v.origin !== "outra" || v.otherName.trim() !== ""));

export async function recordEntryOrigin(enrollmentId: string, v: EntryOrigin) {
  const novo = v.entry === "aluno-novo";
  const [okind, inep] = v.origin === "outra" ? ["outra", null] : v.origin.split(":");
  const name = v.origin === "outra" ? v.otherName.trim() : [...NETWORK_SCHOOLS, ...PRIVATE_SCHOOLS].find((x) => x.inep === inep)?.name ?? null;
  const r = await supabase.rpc("record_enrollment_entry_origin", { _enrollment: enrollmentId, _entry_kind: v.entry, _origin_kind: novo ? null : okind, _origin_inep: novo ? null : inep, _origin_name: novo ? null : name } as never);
  if (r.error) throw new Error("Matrícula feita, mas a forma de ingresso não foi gravada.");
}

export function EntryOriginField({ value, onChange }: { value: EntryOrigin; onChange: (v: EntryOrigin) => void }) {
  return (
    <fieldset className="space-y-2 rounded-md border border-border p-3 text-left">
      <legend className="px-1 text-sm font-medium">Forma de ingresso</legend>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-1.5"><input type="radio" name="entry-origin" checked={value.entry === "aluno-novo"} onChange={() => onChange({ ...value, entry: "aluno-novo" })} /> Aluno novo (primeira matrícula da vida)</label>
        <label className="flex items-center gap-1.5"><input type="radio" name="entry-origin" checked={value.entry === "transferencia-recebida"} onChange={() => onChange({ ...value, entry: "transferencia-recebida" })} /> Transferência (veio de outra escola)</label>
      </div>
      {value.entry === "transferencia-recebida" && (
        <div className="flex flex-wrap gap-2">
          <select aria-label="Escola de origem" className="h-9 max-w-full rounded-md border border-input bg-background px-2 text-sm" value={value.origin} onChange={(e) => onChange({ ...value, origin: e.target.value })}>
            <option value="">Escola de origem…</option>
            <optgroup label="Rede municipal">{NETWORK_SCHOOLS.map((x) => <option key={x.inep} value={`rede:${x.inep}`}>{x.name} ({x.inep})</option>)}</optgroup>
            <optgroup label="Escolas privadas">{PRIVATE_SCHOOLS.map((x) => <option key={x.inep} value={`privada:${x.inep}`}>{x.name} ({x.inep})</option>)}</optgroup>
            <option value="outra">Outra</option>
          </select>
          {value.origin === "outra" && <Input aria-label="Nome da escola de origem" className="w-72" placeholder="Nome da escola" value={value.otherName} maxLength={200} onChange={(e) => onChange({ ...value, otherName: e.target.value })} />}
        </div>
      )}
    </fieldset>
  );
}
