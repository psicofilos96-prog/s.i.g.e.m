import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, StatePanel } from "@/components/sigem/patterns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { networkSchools, readNetworkReconciliation } from "./supervision-network";

const number = (n: number | null) => n === null ? "Não disponível" : new Intl.NumberFormat("pt-BR").format(n);
const match: Record<string, string> = { coincide: "Coincide", diverge: "Difere", incompleto: "Incompleto" };

export function SupervisionNetworkPanel({ schools, sessionKey, openSchool }: {
  schools: { id: string; name: string }[]; sessionKey: string; openSchool: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const query = useQuery({ queryKey: ["supervision-network", sessionKey], retry: false, staleTime: 60_000,
    queryFn: ({ signal }) => readNetworkReconciliation(signal) });
  const rows = useMemo(() => networkSchools(schools, query.data?.rows ?? []), [schools, query.data]);
  const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const filtered = rows.filter((r) => normalize(`${r.name} ${r.inep ?? ""}`).includes(normalize(search.trim())));
  return <section aria-labelledby="supervision-network-heading" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="supervision-network-heading" className="font-semibold">Escolas da rede</h2>
        <p className="text-sm text-muted-foreground">{schools.length} escolas disponíveis para consulta</p></div>
      <Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className="size-4" />Atualizar</Button>
    </div>
    <label className="flex max-w-md items-center gap-2 rounded-md border border-input bg-background px-3">
      <Search className="size-4 text-muted-foreground" aria-hidden="true" /><span className="sr-only">Buscar escola ou INEP</span>
      <input type="search" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" placeholder="Escola ou INEP" value={search} onChange={(e) => setSearch(e.target.value)} />
    </label>
    {query.isPending && <p role="status" className="text-sm text-muted-foreground">Consultando números da rede…</p>}
    {query.isError && <div role="alert"><StatePanel tone="info" title="Números da rede não disponíveis" description="A consulta não foi concluída. As escolas continuam disponíveis; tente atualizar." /></div>}
    {filtered.length === 0 ? <EmptyState title="Nenhuma escola encontrada" description="Não há escola disponível para esta busca." /> :
      <Table className="min-w-[760px]">
        <TableCaption>Contagens da base operacional na consulta, comparadas ao recibo Educacenso 2026. Matrículas = vínculos aluno × turma. Não é fechamento mensal nem homologação.</TableCaption>
        <TableHeader><TableRow><TableHead>Escola / INEP</TableHead><TableHead>Turmas</TableHead><TableHead>Matrículas</TableHead><TableHead>Alunos na escola</TableHead><TableHead>Censo 2026</TableHead><TableHead><span className="sr-only">Abrir escola</span></TableHead></TableRow></TableHeader>
        <TableBody>{filtered.map((r) => <TableRow key={r.id}>
          <TableCell className="max-w-xs whitespace-normal"><strong className="block font-medium">{r.name}</strong><span className="text-xs text-muted-foreground">{r.inep ?? "INEP não disponível nesta consulta"}</span></TableCell>
          <TableCell>{query.isSuccess ? number(r.classes) : "—"}</TableCell><TableCell>{query.isSuccess ? number(r.enrollments) : "—"}</TableCell><TableCell>{query.isSuccess ? number(r.students) : "—"}</TableCell>
          <TableCell>{query.isSuccess && r.comparison ? match[r.comparison] ?? "Não disponível" : "Não disponível"}</TableCell>
          <TableCell><Button size="icon" variant="ghost" aria-label={`Abrir ${r.name}`} title={`Abrir ${r.name}`} onClick={() => openSchool(r.id)}><ArrowRight className="size-4" /></Button></TableCell>
        </TableRow>)}</TableBody>
      </Table>}
  </section>;
}