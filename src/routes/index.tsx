import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock3, FileClock, Info, ListFilter, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, SectionHeader, StatCard, StatusBadge } from "@/components/sigem/patterns";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Início — SIGEM 2.0" },
      {
        name: "description",
        content:
          "Ambiente inicial demonstrativo do Sistema Integrado de Gestão e Estatística Escolar de Itaperuna.",
      },
      { property: "og:title", content: "SIGEM 2.0 — Gestão e Estatística Escolar" },
      {
        property: "og:description",
        content: "Fundação visual do sistema municipal de gestão educacional de Itaperuna.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const rows = [
  {
    area: "Registro demonstrativo A",
    category: "Fluxo de trabalho",
    updated: "Hoje, 09:42",
    status: "Em análise",
    tone: "warning" as const,
  },
  {
    area: "Registro demonstrativo B",
    category: "Documento",
    updated: "Ontem, 16:18",
    status: "Concluído",
    tone: "success" as const,
  },
  {
    area: "Registro demonstrativo C",
    category: "Revisão interna",
    updated: "18 set, 11:05",
    status: "Pendente",
    tone: "info" as const,
  },
  {
    area: "Registro demonstrativo D",
    category: "Solicitação",
    updated: "17 set, 14:30",
    status: "Rascunho",
    tone: "neutral" as const,
  },
];

function HomePage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Visão geral"
        title="Bom trabalho"
        description="Ambiente demonstrativo para validação da linguagem visual, densidade e organização do SIGEM 2.0."
        actions={
          <Button asChild>
            <Link to="/design-system">
              Explorar design system <ArrowRight />
            </Link>
          </Button>
        }
      />

      <div className="flex items-start gap-3 rounded-md border border-info/25 bg-info/5 px-4 py-3 text-info-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="text-sm font-semibold">Dados demonstrativos</p>
          <p className="text-xs opacity-80">
            Os conteúdos abaixo existem apenas para testar componentes e não representam informações
            da Secretaria.
          </p>
        </div>
      </div>

      <section aria-labelledby="summary-heading" className="surface-panel overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <SectionHeader
            title="Resumo operacional"
            description="Indicadores visuais sem vínculo com dados reais"
            action={<StatusBadge tone="neutral">Demonstração</StatusBadge>}
          />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Itens em acompanhamento"
            value="—"
            helper="Aguardando integração futura"
          />
          <StatCard label="Revisões pendentes" value="—" helper="Aguardando integração futura" />
          <StatCard label="Atualizações recentes" value="—" helper="Aguardando integração futura" />
          <StatCard
            label="Índice demonstrativo"
            value="00,0%"
            trend="Exemplo"
            helper="Somente validação visual"
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.75fr)]">
        <section
          className="surface-panel min-w-0 overflow-hidden"
          aria-labelledby="activity-heading"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <SectionHeader
              title="Atividade recente"
              description="Fundação visual para tabelas densas"
            />
            <div className="flex shrink-0 gap-1">
              <Button variant="outline" size="sm">
                <ListFilter /> Filtrar
              </Button>
              <Button variant="ghost" size="icon" aria-label="Mais opções">
                <MoreHorizontal />
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader className="bg-muted/45">
              <TableRow className="hover:bg-muted/45">
                <TableHead className="w-10">
                  <Checkbox aria-label="Selecionar todos" />
                </TableHead>
                <TableHead>Identificação</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Atualização</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.area}>
                  <TableCell>
                    <Checkbox aria-label={`Selecionar ${row.area}`} />
                  </TableCell>
                  <TableCell className="font-medium">{row.area}</TableCell>
                  <TableCell className="text-muted-foreground">{row.category}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {row.updated}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={row.tone}>{row.status}</StatusBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            <span>4 registros demonstrativos</span>
            <Button variant="ghost" size="sm">
              Ver estrutura completa <ArrowRight />
            </Button>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="surface-panel p-4">
            <SectionHeader
              title="Contexto atual"
              description="Espaço reservado para contexto operacional"
            />
            <div className="mt-4 space-y-4">
              <div>
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="font-medium">Etapa demonstrativa</span>
                  <span className="font-mono text-muted-foreground">65%</span>
                </div>
                <Progress value={65} className="h-1.5" />
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground">
                  Nenhuma unidade, período ou perfil real está selecionado nesta etapa.
                </p>
              </div>
            </div>
          </section>
          <section className="surface-panel overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <SectionHeader
                title="Pontos de atenção"
                description="Exemplos de prioridade e leitura rápida"
              />
            </div>
            <div className="divide-y divide-border">
              <div className="flex gap-3 p-4">
                <Clock3 className="size-4 shrink-0 text-warning-foreground" />
                <div>
                  <p className="text-sm font-medium">Revisão demonstrativa</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Exemplo de informação com prazo.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 p-4">
                <FileClock className="size-4 shrink-0 text-info" />
                <div>
                  <p className="text-sm font-medium">Documento de exemplo</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Sem conteúdo administrativo real.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
