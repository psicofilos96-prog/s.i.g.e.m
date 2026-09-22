import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  GraduationCap,
  MoveUpRight,
  School,
  Users,
} from "lucide-react";
import heroImage from "@/assets/itaperuna-home.png.asset.json";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/sigem/patterns";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Início — SIGEM 2.0" },
      {
        name: "description",
        content:
          "Centro de situação do Sistema Integrado de Gestão e Estatística Escolar de Itaperuna.",
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
    event: "Registro demonstrativo A",
    unit: "Fluxo de trabalho",
    reference: "Hoje, 09:42",
    status: "Em análise",
    tone: "warning" as const,
  },
  {
    event: "Registro demonstrativo B",
    unit: "Documento",
    reference: "Ontem, 16:18",
    status: "Concluído",
    tone: "success" as const,
  },
  {
    event: "Registro demonstrativo C",
    unit: "Revisão interna",
    reference: "18 set, 11:05",
    status: "Pendente",
    tone: "info" as const,
  },
];
const indicators = [
  { label: "Unidades escolares", icon: School, note: "aguardando fonte oficial" },
  { label: "Estudantes", icon: GraduationCap, note: "aguardando consolidação" },
  { label: "Profissionais", icon: Users, note: "aguardando integração" },
];

function HomePage() {
  return (
    <div className="home-canvas -m-3 min-h-[calc(100svh-3.5rem)] bg-background sm:-m-4 xl:-m-5">
      <section className="relative isolate min-h-[25rem] overflow-hidden border-b border-border lg:min-h-[30rem]">
        <img
          src={heroImage.url}
          alt="Vista panorâmica de Itaperuna ao pôr do sol, com o Cristo de Itaperuna em primeiro plano"
          className="absolute inset-0 -z-20 size-full object-cover object-[64%_center] lg:object-center"
        />
        <div className="home-hero-mask absolute inset-0 -z-10" aria-hidden="true" />
        <div className="relative mx-auto flex min-h-[25rem] max-w-[1680px] flex-col justify-between px-5 py-7 sm:px-8 lg:min-h-[30rem] lg:px-12 lg:py-10">
          <div className="flex items-center justify-between text-hero-foreground">
            <span className="inline-flex items-center gap-2 text-[0.66rem] font-bold uppercase text-hero-muted">
              <span className="size-1.5 rounded-full bg-accent" />
              Centro de situação
            </span>
            <span className="hidden text-xs text-hero-muted sm:block">
              Contexto demonstrativo · 2026
            </span>
          </div>
          <div className="max-w-[46rem] pb-3 text-hero-foreground lg:pb-1">
            <h1 className="text-[2.35rem] font-semibold leading-[1.02] sm:text-5xl lg:text-[3.6rem]">
              Educação municipal, em perspectiva.
            </h1>
            <div className="mt-6 grid max-w-2xl gap-4 border-t border-hero-border pt-5 sm:grid-cols-[1fr_auto] sm:items-end">
              <p className="max-w-xl text-sm leading-relaxed text-hero-muted sm:text-base">
                Uma leitura contínua do contexto escolar de Itaperuna. Informações oficiais serão
                exibidas quando as fontes forem conectadas.
              </p>
              <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-accent">
                <CalendarDays className="size-3.5" />
                Ano letivo 2026
              </span>
            </div>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-[1680px] px-5 sm:px-8 lg:px-12">
        <section
          aria-labelledby="indicators-title"
          className="grid border-b border-border py-8 lg:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.8fr)] lg:gap-12 lg:py-10"
        >
          <div>
            <p className="text-[0.65rem] font-bold uppercase text-primary">Leitura da rede</p>
            <h2
              id="indicators-title"
              className="mt-2 max-w-xs text-2xl font-semibold leading-tight sm:text-3xl"
            >
              O essencial, sem ruído.
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              A estrutura está pronta para receber dados oficiais sem antecipar números do
              município.
            </p>
          </div>
          <div className="mt-7 grid divide-y divide-border border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:mt-0">
            {indicators.map(({ label, icon: Icon, note }) => (
              <div key={label} className="py-5 sm:px-5 sm:py-3 first:sm:pl-0 last:sm:pr-0">
                <div className="flex items-center justify-between">
                  <Icon className="size-4 text-primary" />
                  <span className="text-4xl font-medium text-foreground/28">—</span>
                </div>
                <p className="mt-7 text-sm font-semibold">{label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{note}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="grid border-b border-border py-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(17rem,0.65fr)] lg:gap-14 lg:py-10">
          <div>
            <div className="flex items-end justify-between gap-5 pb-5">
              <div>
                <p className="text-[0.65rem] font-bold uppercase text-primary">Acompanhamento</p>
                <h2 className="mt-2 text-xl font-semibold">Movimentações recentes</h2>
              </div>
              <Button variant="ghost" size="sm" disabled className="hidden sm:inline-flex">
                Ver histórico <ArrowRight />
              </Button>
            </div>
            <div className="border-y border-border">
              {rows.map((row) => (
                <div
                  key={row.event}
                  className="group grid gap-2 border-b border-border py-4 text-sm last:border-b-0 md:grid-cols-[minmax(11rem,1.1fr)_minmax(10rem,1fr)_minmax(9rem,0.8fr)_auto] md:items-center md:gap-4"
                >
                  <div>
                    <p className="font-medium group-hover:text-primary">{row.event}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground md:hidden">{row.unit}</p>
                  </div>
                  <span className="hidden text-muted-foreground md:block">{row.unit}</span>
                  <span className="text-xs text-muted-foreground md:text-sm">{row.reference}</span>
                  <StatusBadge tone={row.tone}>{row.status}</StatusBadge>
                </div>
              ))}
            </div>
            <p className="pt-3 text-xs text-muted-foreground">
              Registros ilustrativos. Nenhuma operação está ativa.
            </p>
          </div>
          <aside
            className="mt-9 lg:mt-0 lg:border-l lg:border-border lg:pl-9"
            aria-labelledby="attention-title"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-4 text-warning-foreground" />
              <div>
                <p className="text-[0.65rem] font-bold uppercase text-warning-foreground">
                  Atenção
                </p>
                <h2 id="attention-title" className="mt-2 text-lg font-semibold">
                  Pontos para acompanhamento
                </h2>
              </div>
            </div>
            <div className="mt-5 divide-y divide-border border-y border-border">
              <div className="flex items-start gap-3 py-4">
                <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Pendências operacionais</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Sem contagem até conexão com fontes oficiais.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 py-4">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                <div>
                  <p className="text-sm font-medium">Estrutura visual disponível</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Pronta para evolução controlada dos módulos.
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              disabled
              className="mt-5 w-full justify-between px-0 hover:bg-transparent"
            >
              Acompanhar pendências <MoveUpRight />
            </Button>
          </aside>
        </section>
        <footer className="flex flex-col gap-2 py-7 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>SIGEM 2.0 — Sistema Integrado de Gestão e Estatística Escolar</span>
          <span>Prefeitura Municipal de Itaperuna · Secretaria Municipal de Educação</span>
          <Button asChild variant="link" className="h-auto justify-start p-0 sm:hidden">
            <Link to="/design-system">Design System</Link>
          </Button>
        </footer>
      </div>
    </div>
  );
}
