import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc-call";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { SECTOR_PARAMETERS, formatParameterValue, parameterError, type SectorParameter } from "@/config/sector-parameters";

interface Version { key: string; version: number; value: unknown; reason: string; recorded_at: string }

/** Tela de parâmetros do setor: valor atual, onde é usado, alterar (nova versão) e histórico. */
export function SectorParametersPanel({ sector, id = "parametros" }: { sector: string; id?: string }) {
  const a = useSessionAuthority();
  const uid = a.status === "signed-in" ? a.user.id : null;
  const params = SECTOR_PARAMETERS[sector] ?? [];
  const q = useQuery({
    queryKey: ["sector-params", uid, sector], enabled: !!uid && params.length > 0,
    queryFn: async () => {
      const r = await supabase.from("sector_parameter_versions").select("key,version,value,reason,recorded_at").in("key", params.map((p) => p.key)).order("version", { ascending: false });
      if (r.error) throw new Error(r.error.message);
      const c = await supabase.from("sector_parameter_catalog").select("key,default_value").in("key", params.map((p) => p.key));
      if (c.error) throw new Error(c.error.message);
      return { versions: r.data as Version[], defaults: new Map((c.data as { key: string; default_value: unknown }[]).map((x) => [x.key, x.default_value])) };
    },
  });
  if (!params.length) return null;
  const groups = [...new Set(params.map((p) => p.group))];
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-16 space-y-4 rounded-lg border p-4">
      <div><h2 id={`${id}-t`} className="text-lg font-semibold">Parâmetros</h2>
        <p className="text-sm text-muted-foreground">Defina e altere quando quiser. Cada alteração vale na hora e fica no histórico.</p></div>
      {q.isLoading && <p role="status" className="text-sm">Carregando…</p>}
      {q.isError && <p className="text-sm text-destructive">Não foi possível ler os parâmetros.</p>}
      {q.data && groups.map((g) => (
        <div key={g} className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{g}</h3>
          <ul className="grid gap-3 md:grid-cols-2">
            {params.filter((p) => p.group === g).map((p) => <ParameterCard key={p.key} p={p} versions={q.data.versions.filter((v) => v.key === p.key)} fallback={q.data.defaults.get(p.key) ?? null} sector={sector} uid={uid} />)}
          </ul>
        </div>
      ))}
    </section>
  );
}

function ParameterCard({ p, versions, sector, uid, fallback }: { p: SectorParameter; versions: Version[]; sector: string; uid: string | null; fallback: unknown }) {
  const qc = useQueryClient();
  const cur = versions[0] ?? null;
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState(false);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const v = p.input.kind === "dias" ? Number(value) : value;
      await callRpc("record_sector_parameter", { _key: p.key, _value: v, _reason: reason, _expected_version: cur?.version ?? 0 });
      setEditing(false); setReason(""); setMsg("Salvo.");
      await qc.invalidateQueries({ queryKey: ["sector-params", uid, sector] });
      await qc.invalidateQueries();
    } catch (e) { setMsg(parameterError(e instanceof Error ? e.message : "")); } finally { setBusy(false); }
  };
  return (
    <li className="space-y-2 rounded-md border bg-card p-3">
      <div><p className="font-medium">{p.label}</p><p className="text-xs text-muted-foreground">{p.help}</p></div>
      <p className="text-lg font-semibold">{formatParameterValue(p, cur?.value ?? fallback)}</p>
      {!cur && <p className="text-xs text-muted-foreground">Padrão do sistema — já funciona; altere quando quiser.</p>}
      {cur && <p className="text-xs text-muted-foreground">Alterado em {new Date(cur.recorded_at).toLocaleString("pt-BR")} — {cur.reason}</p>}
      <p className="text-xs">Usado em: {p.usedIn.map((u, i) => <a key={i} href={u.href} className="text-primary underline">{u.label}</a>)}</p>
      {editing ? (
        <div className="space-y-2">
          {p.input.kind === "dias"
            ? <Input type="number" min={1} max={365} inputMode="numeric" aria-label="Dias" value={value} onChange={(e) => setValue(e.target.value)} />
            : <select aria-label="Opção" className="block min-h-9 w-full rounded-md border border-border bg-background px-2 text-sm" value={value} onChange={(e) => setValue(e.target.value)}>
                <option value="">Escolha…</option>{p.input.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>}
          <Input aria-label="Motivo" placeholder="Motivo da alteração" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2"><Button size="sm" disabled={busy || !value || reason.trim().length < 3} onClick={() => void save()}>Salvar</Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button></div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setEditing(true); setValue(String(cur?.value ?? fallback ?? "")); }}>Alterar</Button>
          {versions.length > 0 && <Button size="sm" variant="ghost" onClick={() => setHistory((h) => !h)}>{history ? "Ocultar histórico" : "Ver histórico"}</Button>}
        </div>
      )}
      {msg && <p role="status" className="text-xs">{msg}</p>}
      {history && <ol className="space-y-1 text-xs text-muted-foreground">{versions.map((v) => <li key={v.version}>v{v.version} — {formatParameterValue(p, v.value)} — {new Date(v.recorded_at).toLocaleString("pt-BR")} — {v.reason}</li>)}</ol>}
    </li>
  );
}
