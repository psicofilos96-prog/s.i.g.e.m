/**
 * T — Regras de competência do Mapa: lista, rascunho e homologação por ato humano.
 * A tela não sugere dia de fotografia nem células: tudo é declarado por quem tem a capacidade
 * `manter-regra-de-competencia-do-mapa`; o banco revalida sessão, pessoa, atuação de rede e
 * segregação (quem redigiu não homologa).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/sigem/date-input";
import { draftMapRule, homologateMapRule, listMapRules } from "./statistical-map.functions";

export function MapRuleAdmin() {
  const list = useServerFn(listMapRules);
  const draft = useServerFn(draftMapRule);
  const homol = useServerFn(homologateMapRule);
  const qc = useQueryClient();
  const rules = useQuery({ queryKey: ["map-rules"], queryFn: () => list() });
  const [id, setId] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [json, setJson] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const done = { onSuccess: () => { setErr(null); qc.invalidateQueries({ queryKey: ["map-rules"] }); }, onError: (e: Error) => setErr(e.message) };
  const save = useMutation({ mutationFn: async () => {
    let definition: Record<string, unknown>;
    try { definition = JSON.parse(json); } catch { throw new Error("Definição precisa ser JSON válido."); }
    const prev = (rules.data?.rows ?? []).filter((r) => r.id === id).reduce((m, r) => Math.max(m, r.version), 0);
    return draft({ data: { id, expectedVersion: prev, validFrom: from, validUntil: until || null, definition } });
  }, ...done });
  const approve = useMutation({ mutationFn: (r: { id: string; version: number }) => homol({ data: { ...r, sourceRef: null } }), ...done });

  return (
    <section aria-labelledby="rules" className="space-y-3 rounded-lg border border-border bg-card p-4 print:hidden">
      <h2 id="rules" className="text-base font-semibold">Regras de competência do Mapa</h2>
      <p className="text-sm text-muted-foreground">Sem regra homologada que cubra a escola no mês, a competência aguarda regra e não pode ser oficializada. O dia da fotografia nunca é presumido.</p>
      {!rules.data ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : !rules.data.readable ? <p className="text-sm text-muted-foreground">Sem acesso às regras.</p>
        : !rules.data.rows.length ? <p className="text-sm">Nenhuma regra registrada.</p>
        : <ul className="space-y-1 text-sm">{rules.data.rows.map((r) => (
            <li key={`${r.id}@${r.version}`} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{r.id} v{r.version}</span>
              <span>{r.status === "homologada" ? "homologada" : "rascunho (não vale)"}</span>
              <span className="text-muted-foreground">{r.validFrom} a {r.validUntil ?? "sem fim"} · {r.coveredSchools} escola(s)</span>
              {r.status !== "homologada" && <Button size="sm" variant="outline" disabled={approve.isPending} onClick={() => approve.mutate({ id: r.id, version: r.version })}>Homologar</Button>}
            </li>))}</ul>}
      <details>
        <summary className="cursor-pointer text-sm">Registrar rascunho</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <label className="text-sm">Identificador<Input value={id} onChange={(e) => setId(e.target.value)} /></label>
          <label className="text-sm">Vigência de<DateInput value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="text-sm">até (opcional)<DateInput value={until} onChange={(e) => setUntil(e.target.value)} /></label>
        </div>
        <label className="mt-2 block text-sm">Definição (escolas cobertas, data da fotografia, células, tipo de atuação da direção)
          <textarea aria-label="Definição da regra" className="mt-1 min-h-32 w-full rounded-md border border-input bg-background p-2 font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} />
        </label>
        <Button className="mt-2" disabled={save.isPending || !id || !from || !json} onClick={() => save.mutate()}>Registrar rascunho</Button>
      </details>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
    </section>
  );
}
