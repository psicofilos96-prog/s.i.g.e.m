import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpenText,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileClock,
  Info,
  MapPin,
  MoreHorizontal,
  Sparkles,
} from "lucide-react";
import heroImage from "@/assets/itaperuna-home.png.asset.json";
import educationLogo from "@/assets/logo-educacao.png.asset.json";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SectionHeader, StatusBadge } from "@/components/sigem/patterns";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Início — SIGEM 2.0" },
      {
        name: "description",
        content:
          "Ambiente inicial do Sistema Integrado de Gestão e Estatística Escolar de Itaperuna.",
      },
      { property: "og:title", content: "SIGEM 2.0 — Gestão e Estatística Escolar" },
      {
        property: "og:description",
        content: "Sistema municipal de gestão e estatística escolar de Itaperuna.",
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
];

const quickStarts = [
  { icon: BookOpenText, label: "Área acadêmica", detail: "Acesso demonstrativo" },
  { icon: FileClock, label: "Documentos", detail: "Estrutura provisória" },
  { icon: CalendarDays, label: "Agenda", detail: "Contexto futuro" },
];

function HomePage() {
  return (
    <div className="space-y-4 pb-3">
      <section
        className="relative min-h-[19.5rem] overflow-hidden rounded-lg bg-institutional shadow-float sm:min-h-[20.5rem]"
        aria-labelledby="welcome-title"
      >
        <img
          src={heroImage.url}
          alt="Vista panorâmica de Itaperuna ao pôr do sol, com o Cristo de Itaperuna em primeiro plano"
          className="absolute inset-0 size-full object-cover object-[66%_center] sm:object-[58%_center] lg:object-center"
        />
        <div className="home-hero-mask absolute inset-0" />
        <div className="relative flex min-h-[19.5rem] flex-col justify-between p-5 sm:min-h-[20.5rem] sm:p-6 lg:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 text-hero-muted">
              <MapPin className="size-4" />
              <span className="text-xs font-semibold uppercase">Itaperuna · Rio de Janeiro</span>
            </div>
            <img
              src={educationLogo.url}
              alt="Prefeitura de Itaperuna — Educação"
              className="hidden h-9 w-auto max-w-[15rem] object-contain brightness-0 invert sm:block"
            />
          </div>

          <div className="max-w-2xl text-hero-foreground">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-hero-muted">
              <span className="h-px w-7 bg-accent" /> Sistema municipal de educação
            </p>
            <h1
              id="welcome-title"
              className="max-w-xl text-3xl font-semibold leading-tight sm:text-4xl"
            >
              Bom trabalho. Este é o seu ponto de partida.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-hero-muted sm:text-[0.9375rem]">
              SIGEM 2.0 · Sistema Integrado de Gestão e Estatística Escolar
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
            <div className="hero-glass flex w-fit items-center gap-3 rounded-md px-3 py-2 text-hero-foreground">
              <CalendarDays className="size-4 text-accent" />
              <div>
                <p className="text-xs font-semibold">Terça-feira, 22 de setembro</p>
                <p className="text-[0.6875rem] text-hero-muted">Ambiente demonstrativo</p>
              </div>
            </div>
            <p className="hidden justify-self-end text-[0.6875rem] font-medium uppercase text-hero-muted lg:block">
              Território, educação e informação
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.72fr)]">
        <div className="min-w-0 space-y-4">
          <section aria-labelledby="overview-heading" className="border-y border-border bg-card">
            <div className="grid grid-cols-2 lg:grid-cols-4">
              <div className="px-4 py-3 lg:border-r lg:border-border">
                <p className="text-[0.6875rem] font-semibold uppercase text-muted-foreground">
                  Acompanhamentos
                </p>
                <p className="mt-1 font-mono text-xl font-semibold">—</p>
              </div>
              <div className="border-l border-border px-4 py-3 lg:border-l-0 lg:border-r">
                <p className="text-[0.6875rem] font-semibold uppercase text-muted-foreground">
                  Revisões
                </p>
                <p className="mt-1 font-mono text-xl font-semibold">—</p>
              </div>
              <div className="border-t border-border px-4 py-3 lg:border-r lg:border-t-0">
                <p className="text-[0.6875rem] font-semibold uppercase text-muted-foreground">
                  Atualizações
                </p>
                <p className="mt-1 font-mono text-xl font-semibold">—</p>
              </div>
              <div className="border-l border-t border-border px-4 py-3 lg:border-l-0 lg:border-t-0">
                <p className="text-[0.6875rem] font-semibold uppercase text-muted-foreground">
                  Referência
                </p>
                <p className="mt-1 text-sm font-semibold text-primary">Dados demonstrativos</p>
              </div>
            </div>
          </section>

          <section
            className="surface-panel min-w-0 overflow-hidden"
            aria-labelledby="activity-heading"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <SectionHeader
                title="Movimentações recentes"
                description="Leitura rápida do ambiente demonstrativo"
              />
              <Button variant="ghost" size="icon" aria-label="Mais opções">
                <MoreHorizontal />
              </Button>
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
              <span>3 registros demonstrativos</span>
              <Button variant="ghost" size="sm">
                Ver estrutura <ArrowRight />
              </Button>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="surface-panel overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <SectionHeader
                title="Comece por aqui"
                description="Atalhos provisórios do ambiente"
              />
            </div>
            <div className="divide-y divide-border">
              {quickStarts.map(({ icon: Icon, label, detail }) => (
                <button
                  key={label}
                  disabled
                  className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left disabled:cursor-default"
                >
                  <span className="grid size-8 place-items-center rounded-md bg-secondary text-secondary-foreground">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{detail}</span>
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </section>

          <section className="relative overflow-hidden rounded-md bg-institutional p-4 text-institutional-foreground">
            <div className="absolute right-0 top-0 size-28 rounded-bl-full border-b border-l border-hero-border opacity-60" />
            <p className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase text-hero-muted">
              <Sparkles className="size-3.5" /> Contexto atual
            </p>
            <h2 className="mt-3 text-lg font-semibold">Sua jornada começa com clareza.</h2>
            <p className="mt-1 text-xs leading-relaxed text-hero-muted">
              Nenhuma unidade, período ou perfil real está selecionado nesta etapa.
            </p>
            <div className="mt-4 flex items-center gap-2 border-t border-hero-border pt-3 text-xs text-hero-muted">
              <CheckCircle2 className="size-4 text-accent" /> Estrutura pronta para evolução por
              perfil
            </div>
          </section>

          <section className="px-1">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h2 className="text-sm font-semibold">Pontos de atenção</h2>
              <StatusBadge tone="neutral">Demonstração</StatusBadge>
            </div>
            <div className="space-y-3 pt-3">
              <div className="flex gap-3">
                <Clock3 className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
                <div>
                  <p className="text-sm font-medium">Revisão demonstrativa</p>
                  <p className="text-xs text-muted-foreground">Exemplo de informação com prazo.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Info className="mt-0.5 size-4 shrink-0 text-info" />
                <div>
                  <p className="text-sm font-medium">Conteúdo provisório</p>
                  <p className="text-xs text-muted-foreground">Sem dados administrativos reais.</p>
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[0.6875rem] text-muted-foreground">
        <span>Prefeitura Municipal de Itaperuna · Secretaria Municipal de Educação</span>
        <Button asChild variant="ghost" size="sm" className="h-7">
          <Link to="/design-system">
            Design System <ArrowRight />
          </Link>
        </Button>
      </footer>
    </div>
  );
}
