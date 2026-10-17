/**
 * CIECE Lote 19 — Central SIGEM 2.0 do CIECE (tela real, leitura com a sessão).
 * Observatório, mapa (bloqueado sem coordenada verificada), inconsistências paginadas,
 * fluxo censitário por escola e ações rápidas por `pathAllowed`. Nada é calculado aqui:
 * os números vêm de `getCieceOverview` (RLS) e das projeções puras L02/L06.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCieceOverview } from "../ciece-overview.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatePanel } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { NetworkNoticeComposer } from "../network-notices";

const LABEL: Record<string, string> = { escolas: "Escolas", "estudantes-unicos": "Estudantes únicos", matriculas: "Matrículas", turmas: "Turmas", professores: "Professores", servidores: "Vínculos funcionais", pendencias: "Pendências" };
const GRADE: Record<string, string> = { "erro-confirmado": "Erro confirmado", provavel: "Provável", alerta: "Alerta", pendencia: "Pendência", "nao-aplicavel": "Não aplicável" };
const PAGE = 20;

export const QUICK_ACTIONS = [
  { to: "/censo-escolar", label: "Ciclo do Censo Escolar" },
  { to: "/qualidade-dos-dados", label: "Qualidade dos dados" },
  { to: "/mapa-estatistico-rede", label: "Mapa Estatístico da rede" },
  { to: "/relatorios/personalizado", label: "Editor de relatórios" },
  { to: "/relatorios/paineis", label: "Painéis" },
] as const;

export function paginate<T>(rows: T[], page: number) {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const p = Math.min(Math.max(1, page), pages);
  return { rows: rows.slice((p - 1) * PAGE, p * PAGE), page: p, pages };
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  return (
    <nav aria-label="Paginação" className="flex items-center justify-end gap-2 pt-2 text-sm">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</Button>
      <span aria-live="polite">Página {page} de {pages}</span>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Próxima</Button>
    </nav>
  );
}

export function CieceCentral({ pathAllowed }: { pathAllowed: (p: string) => boolean }) {
  const load = useServerFn(getCieceOverview);
  const q = useQuery({ queryKey: ["ciece-overview"], queryFn: () => load(), staleTime: 60_000 });
  const [filter, setFilter] = useState("");
  const [sPage, setSPage] = useState(1);
  const [fPage, setFPage] = useState(1);
  const schools = useMemo(() => (q.data?.schools ?? []).filter((s) => !filter || `${s.name} ${s.inep ?? ""}`.toLowerCase().includes(filter.toLowerCase())), [q.data, filter]);

  if (q.isPending) return <SkeletonState label="Carregando panorama" />;
  if (q.isError) return <StatePanel tone="danger" title="Panorama indisponível" description="Não foi possível ler os dados agora." action={<Button variant="outline" onClick={() => q.refetch()}>Tentar novamente</Button>} />;
  const d = q.data;
  const sp = paginate(schools, sPage);
  const fp = paginate(d.findings, fPage);
  const actions = QUICK_ACTIONS.filter((a) => pathAllowed(a.to));

  return (
    <section aria-labelledby="ciece-central-title" className="space-y-4">
      <h2 id="ciece-central-title" className="text-lg font-semibold">Central do CIECE</h2>
      <Tabs defaultValue="observatorio">
        <TabsList className="flex-wrap">
          <TabsTrigger value="observatorio">Observatório</TabsTrigger>
          <TabsTrigger value="mapa">Mapa</TabsTrigger>
          <TabsTrigger value="inconsistencias">Inconsistências ({d.findings.length})</TabsTrigger>
          <TabsTrigger value="censo">Fluxo censitário</TabsTrigger>
          <TabsTrigger value="avisos">Avisos da rede</TabsTrigger>
          <TabsTrigger value="acoes">Ações rápidas</TabsTrigger>
        </TabsList>

        <TabsContent value="observatorio">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {d.cells.map((c) => (
              <li key={c.key} className="rounded-lg border bg-card p-3">
                <p className="text-sm text-muted-foreground">{LABEL[c.key]}</p>
                <p className="text-2xl font-semibold">{c.display}</p>
                <p hidden data-provenance className="text-xs text-muted-foreground">{c.reading.state === "lido" ? `Fonte: ${c.reading.source} · ${c.reading.referenceDate}` : c.reading.reason}</p>
              </li>
            ))}
          </ul>
          <p hidden className="pt-2 text-xs text-muted-foreground">Ausência de leitura nunca aparece como zero. Vínculos não são pessoas.</p>
        </TabsContent>

        <TabsContent value="mapa">
          <StatePanel tone="neutral" title="Mapa bloqueado" description={`Nenhuma das ${d.schools.length} escolas tem coordenada verificada no cadastro; nenhum ponto é desenhado por estimativa.`} />
        </TabsContent>

        <TabsContent value="inconsistencias">
          {d.findings.length === 0 ? <StatePanel tone="neutral" title="Nenhuma inconsistência detectada" description="Fontes não lidas não geram achado." /> : (
            <>
              <Table>
                <TableHeader><TableRow><TableHead>Regra</TableHead><TableHead>Grau</TableHead><TableHead>Sujeito</TableHead><TableHead>Evidência</TableHead><TableHead>Correção na origem</TableHead></TableRow></TableHeader>
                <TableBody>{fp.rows.map((f, i) => (
                  <TableRow key={`${f.ruleId}-${f.subject}-${i}`}><TableCell>{f.ruleId}@v{f.version}</TableCell><TableCell>{GRADE[f.grade]}</TableCell><TableCell>{d.schools.find((s) => s.id === f.subject)?.name ?? f.subject}</TableCell><TableCell>{f.evidence}</TableCell><TableCell>{f.fix}</TableCell></TableRow>
                ))}</TableBody>
              </Table>
              <Pager page={fp.page} pages={fp.pages} onPage={setFPage} />
            </>
          )}
        </TabsContent>

        <TabsContent value="censo">
          <label htmlFor="ciece-school-filter" className="text-sm font-medium">Filtrar escola (nome ou INEP)</label>
          <Input id="ciece-school-filter" value={filter} onChange={(e) => { setFilter(e.target.value); setSPage(1); }} className="mb-2 max-w-sm" />
          {!d.schoolsReadable ? <StatePanel tone="neutral" title="Cadastro de escolas não lido" description="Sem permissão ou fonte indisponível." /> : schools.length === 0 ? <StatePanel tone="neutral" title="Nenhuma escola encontrada" description="Ajuste o filtro." /> : (
            <>
              <Table>
                <TableHeader><TableRow><TableHead>Escola</TableHead><TableHead>INEP</TableHead><TableHead>Distrito</TableHead><TableHead>Data de referência</TableHead><TableHead>Situação</TableHead></TableRow></TableHeader>
                <TableBody>{sp.rows.map((s) => (
                  <TableRow key={s.id}><TableCell>{s.name}</TableCell><TableCell>{s.inep ?? "não informado"}</TableCell><TableCell>{s.district || "não informado"}</TableCell><TableCell>não configurada</TableCell><TableCell>Bloqueada: data oficial e leiaute do ano ausentes</TableCell></TableRow>
                ))}</TableBody>
              </Table>
              <Pager page={sp.page} pages={sp.pages} onPage={setSPage} />
            </>
          )}
        </TabsContent>

        <TabsContent value="avisos"><NetworkNoticeComposer /></TabsContent>

        <TabsContent value="acoes">
          {actions.length === 0 ? <StatePanel tone="neutral" title="Nenhuma ação disponível" description="Seu acesso não abre as telas relacionadas." /> : (
            <ul className="flex flex-wrap gap-2">{actions.map((a) => <li key={a.to}><Button asChild variant="outline"><Link to={a.to}>{a.label}</Link></Button></li>)}</ul>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}
