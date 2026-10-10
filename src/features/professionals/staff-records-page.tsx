import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { RegistryHero } from "@/components/sigem/registry-layout";
import { SkeletonState } from "@/components/sigem/guidance";
import { OffsetPager } from "@/components/sigem/list-pager";
import { Input } from "@/components/ui/input";
import { RECORD_KINDS, STAFF_PAGE_SIZE, STAFF_SOURCES, readStaffRecords, readStaffSchools, type StaffFilters } from "./staff-records";

const empty: StaffFilters = { source: "", schoolId: "", sector: "", situacao: "", search: "" };

export function StaffRecordsPage() {
  const [typed, setTyped] = useState(empty);
  const [f, setF] = useState(empty);
  const [page, setPage] = useState(0);
  useEffect(() => { const t = setTimeout(() => { setF(typed); setPage(0); }, 300); return () => clearTimeout(t); }, [typed]);
  const schools = useQuery({ queryKey: ["staff-schools"], queryFn: ({ signal }) => readStaffSchools(signal), staleTime: 300_000 });
  const q = useQuery({ queryKey: ["staff-records", f, page], queryFn: ({ signal }) => readStaffRecords(f, page, signal), placeholderData: keepPreviousData });
  const set = (k: keyof StaffFilters) => (v: string) => setTyped((p) => ({ ...p, [k]: v }));
  const sel = "h-9 rounded-md border bg-background px-2 text-sm";
  return (
    <div className="space-y-6">
      <RegistryHero eyebrow="Rede Municipal · Pessoal 2026" title="Pessoal por escola e setor"
        lede="Registros administrativos das planilhas de pessoal 2026, no seu alcance de acesso. Nenhum registro aqui concede acesso ao SIGEM."
        count={q.data ? <>{q.data.total.toLocaleString("pt-BR")}<span className="ml-2 align-middle text-sm font-normal text-muted-foreground">registros</span></> : undefined} />
      <section aria-label="Tipos de informação" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {RECORD_KINDS.map((k) => (
          <div key={k.key} className={`rounded-lg border p-3 text-xs ${k.key === "administrativo" ? "border-primary bg-card" : "border-dashed"}`}>
            <p className="mb-1 text-sm font-semibold">{k.label}{k.key === "administrativo" ? " · esta tela" : ""}</p><p className="text-muted-foreground">{k.text}</p>
          </div>
        ))}
      </section>
      <div className="flex flex-wrap gap-2">
        <Input aria-label="Pesquisar por nome, cargo ou função" placeholder="Nome, cargo ou função" value={typed.search} onChange={(e) => set("search")(e.target.value)} className="max-w-xs" />
        <select aria-label="Fonte" className={sel} value={typed.source} onChange={(e) => set("source")(e.target.value)}>
          <option value="">Todas as fontes</option>
          {Object.entries(STAFF_SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="Escola" className={sel} value={typed.schoolId} onChange={(e) => set("schoolId")(e.target.value)}>
          <option value="">Todas as escolas visíveis</option>
          {(schools.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Input aria-label="Setor" placeholder="Setor (SEMED)" value={typed.sector} onChange={(e) => set("sector")(e.target.value)} className="max-w-[12rem]" />
        <Input aria-label="Situação" placeholder="Situação" value={typed.situacao} onChange={(e) => set("situacao")(e.target.value)} className="max-w-[12rem]" />
      </div>
      {q.isLoading ? <SkeletonState label="Carregando" />
        : q.error ? <p role="alert" className="text-sm text-destructive">Não foi possível ler os registros de pessoal, ou sua conta não tem acesso a eles.</p>
        : !q.data?.rows.length ? <p className="text-sm text-muted-foreground">Nenhum registro visível com esses filtros.</p>
        : (
          <>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm"><caption className="sr-only">Registros administrativos de pessoal 2026</caption>
                <thead className="bg-muted text-left text-xs"><tr>{["Nome", "Escola / setor", "Cargo", "Função", "Vínculo declarado", "Situação", "Fonte"].map((h) => <th key={h} scope="col" className="p-2">{h}</th>)}</tr></thead>
                <tbody>{q.data.rows.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="p-2 font-medium">{r.fullName}</td>
                    <td className="p-2">{r.schoolNameSource ?? r.sector ?? "não informado"}</td>
                    <td className="p-2">{r.cargo ?? "não informado"}</td>
                    <td className="p-2">{r.funcao ?? "não informado"}</td>
                    <td className="p-2">{r.vinculo ?? "não informado"}</td>
                    <td className="p-2">{r.situacao ?? "não informado"}</td>
                    <td className="p-2 text-xs text-muted-foreground">{r.sourceLabel} · aba “{r.sheet}”, linha {r.rowNo}{r.referencePeriod ? ` · ref. ${r.referencePeriod}` : ""}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <OffsetPager page={page} pageSize={STAFF_PAGE_SIZE} total={q.data.total} onPage={setPage} noun="registros">
              {`${page * STAFF_PAGE_SIZE + 1}–${Math.min(q.data.total, (page + 1) * STAFF_PAGE_SIZE)} de ${q.data.total}`}
            </OffsetPager>
          </>
        )}
    </div>
  );
}
