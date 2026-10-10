import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RegistryHero } from "@/components/sigem/registry-layout";
import { SkeletonState } from "@/components/sigem/guidance";
import { OffsetPager } from "@/components/sigem/list-pager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GROUP_LABEL, groupCounts, loadReconciliation, pendingCsv, recordDecision, type ReconGroup, type ReconItem } from "./staff-reconciliation";

const PAGE = 50;
const GROUPS = Object.keys(GROUP_LABEL) as ReconGroup[];

function DecisionForm({ item, onDone }: { item: ReconItem; onDone: () => void }) {
  const [evidence, setEvidence] = useState("");
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (decision: "confirmado" | "rejeitado" | "pendente-de-chave") => recordDecision({ staffRecordId: item.record.id, decision, personId: decision === "confirmado" ? item.suggestedPersonId : null, evidence, expectedHead: item.head?.id ?? null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff-reconciliation"] }); onDone(); },
  });
  return (
    <div className="mt-2 space-y-2 rounded border border-dashed p-2">
      <Input aria-label="Evidência da conferência" placeholder="Evidência conferida (ex.: matrícula funcional e data de nascimento conferidas na ficha)" value={evidence} onChange={(e) => setEvidence(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {item.suggestedPersonId && <Button size="sm" disabled={m.isPending} onClick={() => m.mutate("confirmado")}>Confirmar sugestão</Button>}
        <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate("rejeitado")}>Não corresponde</Button>
        <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate("pendente-de-chave")}>Pendente de chave</Button>
      </div>
      {m.error && <p role="alert" className="text-xs text-destructive">{(m.error as Error).message}</p>}
      <p className="text-xs text-muted-foreground">Registrar uma decisão não cria vínculo, lotação, atuação nem acesso.</p>
    </div>
  );
}

export function StaffReconciliationPage() {
  const q = useQuery({ queryKey: ["staff-reconciliation"], queryFn: ({ signal }) => loadReconciliation(signal) });
  const [group, setGroup] = useState<ReconGroup>("sugestao");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const counts = useMemo(() => (q.data ? groupCounts(q.data.items) : null), [q.data]);
  const list = useMemo(() => (q.data?.items ?? []).filter((i) => i.group === group).sort((a, b) => a.record.full_name.localeCompare(b.record.full_name, "pt-BR")), [q.data, group]);
  const download = () => {
    const blob = new Blob([pendingCsv(q.data!.items)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "pendencias-conciliacao-pessoal-2026.csv"; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <div className="space-y-6">
      <RegistryHero eyebrow="Pessoal 2026 · uso interno" title="Conciliação assistida de pessoal"
        lede="Registros das planilhas de pessoal × pessoas declaradas no Censo. Coincidência de nome é só sugestão: só quem tem competência confirma, com evidência registrada."
        actions={q.data ? <Button size="sm" variant="outline" onClick={download}>Exportar pendências (CSV, sem CPF)</Button> : undefined} />
      {q.isLoading ? <SkeletonState label="Carregando" />
        : q.error ? <p role="alert" className="text-sm text-destructive">Não foi possível ler a conciliação, ou sua conta não tem acesso a ela.</p>
        : (
          <>
            <div role="tablist" className="flex flex-wrap gap-2">
              {GROUPS.map((g) => (
                <Button key={g} role="tab" aria-selected={g === group} size="sm" variant={g === group ? "default" : "outline"} onClick={() => { setGroup(g); setPage(0); }}>
                  {GROUP_LABEL[g]} · {counts![g]}
                </Button>
              ))}
            </div>
            {q.data!.truncated && <p className="text-xs text-muted-foreground">Leitura parcial: limite atingido; contagens não são totais.</p>}
            {!list.length ? <p className="text-sm text-muted-foreground">Nenhum registro neste grupo.</p> : (
              <ul className="grid gap-2">
                {list.slice(page * PAGE, page * PAGE + PAGE).map((i) => (
                  <li key={i.record.id} className="rounded-md border bg-card p-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium">{i.record.full_name}</span>
                      <span className="text-xs text-muted-foreground">{i.record.school_name_source ?? i.record.sector ?? "não informado"} · {i.record.cargo ?? "cargo não informado"} · aba “{i.record.sheet}”, linha {i.record.row_no}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {i.suggestedPersonId ? `Sugestão por ${i.rule === "nome-normalizado-rede" ? "nome na rede" : "nome na mesma escola"}` : "Sem pessoa sugerida"}
                      {i.group === "ambiguo" ? ` · a mesma pessoa é sugerida para ${i.competingRecords} registros` : ""}
                      {i.head ? ` · última decisão em ${new Date(i.head.decided_at).toLocaleDateString("pt-BR")}` : ""}
                    </p>
                    {open === i.record.id ? <DecisionForm item={i} onDone={() => setOpen(null)} />
                      : <Button size="sm" variant="link" className="h-auto p-0" onClick={() => setOpen(i.record.id)}>Conferir</Button>}
                  </li>
                ))}
              </ul>
            )}
            <OffsetPager page={page} pageSize={PAGE} total={list.length} onPage={setPage} noun="registros" />
          </>
        )}
    </div>
  );
}
