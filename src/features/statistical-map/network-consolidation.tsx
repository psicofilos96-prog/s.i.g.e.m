/**
 * Consolidação da rede e homologação pelo CIECE. Os totais são os mesmos `networkTotal` da tabela
 * exibida; a homologação grava só a fotografia vista (totais + escolas + impressão digital) por
 * `homologate_network_consolidation`, com revisão esperada e motivo a partir da 2ª revisão.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/components/sigem/confirm-action";
import { NETWORK_CATEGORY_LABEL, consolidationFingerprint, type NetworkCategory } from "@/features/ciece/network-categories";
import { MEASURE_KEYS, MEASURE_LABEL, display, networkTotal, type MonthWindow, type SchoolProjection } from "./network-projection";

const ERR: Record<string, string> = {
  "consolidacao:sem-permissao": "Sua conta não pode homologar a consolidação da rede.",
  "consolidacao:base-desatualizada": "Outra homologação foi registrada agora. Recarregue a página.",
  "consolidacao:motivo-obrigatorio": "Informe o motivo da nova homologação.",
};

export function NetworkConsolidation({ window: w, category, schools }: { window: MonthWindow; category: NetworkCategory; schools: SchoolProjection[] }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const totals = Object.fromEntries(MEASURE_KEYS.map((k) => [k, networkTotal(schools, k).value])) as Record<string, number | null>;
  const missing = MEASURE_KEYS.reduce((n, k) => n + networkTotal(schools, k).missingSchools.length, 0);
  const qk = ["consolidacao-rede", w.year, w.month, category];
  const hist = useQuery({
    queryKey: qk,
    queryFn: async () => {
      const { data, error } = await supabase.from("network_consolidation_homologations").select("revision,school_count,totals,fingerprint,reason,homologated_at")
        .eq("year", w.year).eq("month", w.month).eq("audience", category).order("revision", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const fp = useQuery({ queryKey: ["fp", qk, totals, schools.length], queryFn: () => consolidationFingerprint({ year: w.year, month: w.month, audience: category, schoolIds: schools.map((s) => s.schoolId), totals }) });
  const last = hist.data?.[0];
  const same = !!last && last.fingerprint === fp.data;

  const run = useMutation({
    mutationFn: async () => {
      const r = await supabase.rpc("homologate_network_consolidation", {
        _year: w.year, _month: w.month, _audience: category, _school_count: schools.length, _totals: totals, _fingerprint: fp.data!,
        _expected_revision: last?.revision ?? 0, _reason: reason,
      });
      if (r.error) throw new Error(r.error.message);
    },
    onSuccess: () => { setReason(""); setMsg("Consolidação homologada."); void qc.invalidateQueries({ queryKey: qk }); },
    onError: (e: Error) => { const k = Object.keys(ERR).find((x) => e.message.includes(x)); setMsg(k ? ERR[k]! : "Não foi possível homologar agora."); },
  });

  return (
    <section aria-labelledby="consolidacao" className="rounded-2xl border border-border bg-card p-5 print:hidden">
      <h2 id="consolidacao" className="font-display text-lg font-semibold">Consolidação da rede — {NETWORK_CATEGORY_LABEL[category]}</h2>
      <p className="text-sm text-muted-foreground">{schools.length} escola(s) · soma do que cada escola registrou no mês.</p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-3">
        {MEASURE_KEYS.map((k) => <div key={k} className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">{MEASURE_LABEL[k]}</dt><dd className="text-xl font-semibold">{display(totals[k] ?? null)}</dd></div>)}
      </dl>
      {missing > 0 && <p className="mt-2 text-sm">Há escolas sem dado em algum total; elas ficam fora da soma, nunca contadas como zero.</p>}
      <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
        {hist.isPending ? "Lendo homologações…" : !last ? "Esta consolidação ainda não foi homologada pelo CIECE."
          : <>Homologada (revisão {last.revision}) em {new Date(last.homologated_at).toLocaleString("pt-BR")} com {last.school_count} escola(s).{same ? " Os números atuais são os mesmos." : " Os números mudaram desde então."}</>}
      </div>
      {!same && schools.length > 0 && (
        <div className="mt-3 space-y-2">
          {last && <textarea aria-label="Motivo da nova homologação" placeholder="Motivo da nova homologação (obrigatório)" className="min-h-16 w-full rounded-md border border-input bg-background p-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} />}
          <Button disabled={run.isPending || !fp.data || (!!last && reason.trim().length < 3)}
            onClick={async () => { if (await confirmAction({ title: "Homologar consolidação?", description: `Os totais de ${NETWORK_CATEGORY_LABEL[category].toLowerCase()} deste mês ficarão registrados como homologados pelo CIECE.`, confirmLabel: "Homologar" })) run.mutate(); }}>
            Homologar consolidação
          </Button>
        </div>
      )}
      {msg && <p role="status" className="mt-2 text-sm">{msg}</p>}
    </section>
  );
}
