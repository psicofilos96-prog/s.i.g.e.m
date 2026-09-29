import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DateInput } from "@/components/sigem/date-input";
import { formatAcademicDate, parseAcademicDate } from "@/lib/academic-date";

/**
 * B2.3 — Componentes curriculares. Identidade permanente (ID do banco); nome,
 * situação e vigência são versões encadeadas gravadas só por
 * `register_curricular_component_version`. Sem cadastro oficial, lista vazia:
 * nunca componentes demonstrativos.
 */
type Version = {
  id: string; component_id: string; version: number; official_name: string; short_name: string | null;
  is_active: boolean; valid_from: string; change_reason: string | null; originating_act_ref: string; created_at: string;
};

const ERR: Record<string, string> = {
  "capability:manter-componentes-curriculares": "Sua atuação vigente não concede a capacidade de manter componentes curriculares com alcance de rede.",
  "component:name-required": "Informe o nome oficial.",
  "component:act-required": "Informe o ato que fundamenta o registro.",
  "component:reason-required": "Informe o motivo da nova versão.",
  "component:base-superseded": "Outra versão foi registrada antes; recarregue e confira a versão vigente.",
  "component:no-change": "Nada mudou em relação à versão vigente; nenhuma versão foi criada.",
  "component:valid-from-before-base": "A nova vigência não pode começar antes da vigência da versão atual.",
  "component:valid-from-required": "Informe o início da vigência.",
};
const human = (m: string) => ERR[Object.keys(ERR).find((k) => m.includes(k)) ?? ""] ?? "Operação recusada; nada foi gravado.";
const iso = (v: FormDataEntryValue | null) => { const t = String(v ?? "").trim(); return t ? parseAcademicDate(t) ?? t : ""; };

export function ComponentsAdminSection({ canMaintain }: { canMaintain: boolean }) {
  const [rows, setRows] = useState<Version[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.from("curricular_component_versions")
      .select("id, component_id, version, official_name, short_name, is_active, valid_from, change_reason, originating_act_ref, created_at")
      .order("version");
    setRows((data ?? []) as Version[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const chains = useMemo(() => {
    const m = new Map<string, Version[]>();
    for (const r of rows) m.set(r.component_id, [...(m.get(r.component_id) ?? []), r]);
    return [...m.values()].map((c) => ({ chain: c, last: c[c.length - 1]! }))
      .sort((a, b) => a.last.official_name.localeCompare(b.last.official_name, "pt-BR"));
  }, [rows]);
  const shown = chains.filter((c) => c.chain.some((v) => `${v.official_name} ${v.short_name ?? ""}`.toLowerCase().includes(q.toLowerCase())));

  async function save(e: FormEvent<HTMLFormElement>, base?: Version) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const { error } = await supabase.rpc("register_curricular_component_version", {
      _component: (base?.component_id ?? null) as string,
      _base_version_id: (base?.id ?? null) as string,
      _official_name: String(f.get("cname")),
      _short_name: String(f.get("cshort")),
      _is_active: f.get("cactive") === "sim",
      _valid_from: iso(f.get("cfrom")),
      _reason: String(f.get("creason") ?? ""),
      _act_ref: String(f.get("cact")),
    });
    if (error) return setErr(human(error.message));
    setErr(null);
    form.reset();
    await load();
  }

  const fields = (v?: Version) => (
    <>
      <div className="grid gap-1"><Label htmlFor={`cn-${v?.id ?? "novo"}`}>Nome oficial</Label><Input id={`cn-${v?.id ?? "novo"}`} name="cname" defaultValue={v?.official_name} required /></div>
      <div className="grid gap-1"><Label htmlFor={`cs-${v?.id ?? "novo"}`}>Nome curto (opcional)</Label><Input id={`cs-${v?.id ?? "novo"}`} name="cshort" defaultValue={v?.short_name ?? ""} /></div>
      <div className="grid gap-1"><Label htmlFor={`ca-${v?.id ?? "novo"}`}>Situação</Label>
        <select id={`ca-${v?.id ?? "novo"}`} name="cactive" defaultValue={v && !v.is_active ? "nao" : "sim"} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="sim">Ativo</option><option value="nao">Inativo</option>
        </select></div>
      <div className="grid gap-1"><Label htmlFor={`cf-${v?.id ?? "novo"}`}>Início da vigência</Label><DateInput id={`cf-${v?.id ?? "novo"}`} name="cfrom" defaultValue={v?.valid_from ?? ""} required /></div>
      <div className="grid gap-1"><Label htmlFor={`ct-${v?.id ?? "novo"}`}>Ato</Label><Input id={`ct-${v?.id ?? "novo"}`} name="cact" required /></div>
    </>
  );

  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <h2 className="mb-1 font-display text-lg font-semibold text-foreground">Componentes curriculares</h2>
      <p className="mb-3 text-sm text-muted-foreground">Cadastro único da rede. Mudar nome ou situação cria nova versão; registros antigos continuam apontando para o mesmo componente.</p>
      <Input placeholder="Localizar por nome" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3" aria-label="Localizar componente" />
      <ul className="mb-4 grid gap-2 text-sm">
        {shown.map(({ chain, last }) => (
          <li key={last.component_id} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{last.official_name}{last.short_name ? ` (${last.short_name})` : ""}</span>
              <span className="flex gap-2">
                <Badge variant={last.is_active ? "secondary" : "outline"}>{last.is_active ? "Ativo" : "Inativo"}</Badge>
                <Button size="sm" variant="outline" onClick={() => setOpen(open === last.component_id ? null : last.component_id)}>
                  {open === last.component_id ? "Fechar" : "Histórico"}
                </Button>
              </span>
            </div>
            {open === last.component_id && (
              <div className="mt-3 grid gap-3">
                <ol className="grid gap-1 text-muted-foreground">
                  {[...chain].reverse().map((v) => (
                    <li key={v.id}>Versão {v.version}: {v.official_name} · {v.is_active ? "ativo" : "inativo"} · desde {formatAcademicDate(v.valid_from)} · ato {v.originating_act_ref}{v.change_reason ? ` · motivo: ${v.change_reason}` : ""}</li>
                  ))}
                </ol>
                {canMaintain && (
                  <form onSubmit={(e) => save(e, last)} className="grid gap-3 sm:grid-cols-2">
                    {fields(last)}
                    <div className="grid gap-1"><Label htmlFor={`cr-${last.id}`}>Motivo da nova versão</Label><Input id={`cr-${last.id}`} name="creason" required /></div>
                    <div className="sm:col-span-2"><Button type="submit">Registrar nova versão</Button></div>
                  </form>
                )}
              </div>
            )}
          </li>
        ))}
        {shown.length === 0 && <li className="text-muted-foreground">Nenhum componente curricular cadastrado.</li>}
      </ul>
      {canMaintain && (
        <form onSubmit={(e) => save(e)} className="grid gap-3 sm:grid-cols-2">
          {fields()}
          <div className="sm:col-span-2"><Button type="submit">Cadastrar componente</Button></div>
        </form>
      )}
      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
    </section>
  );
}
