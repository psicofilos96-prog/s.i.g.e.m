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
import { brand } from "@/config/branding";
import { useSessionUser } from "@/features/authority/session-authority";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `Início — ${brand.name}` },
      {
        name: "description",
        content: `Centro de situação do ${brand.fullName} de Itaperuna.`,
      },
      { property: "og:title", content: brand.displayName },
      {
        property: "og:description",
        content: `${brand.fullName} da rede municipal de Itaperuna.`,
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
  const { user } = useSessionUser();
  const real = !!user;
  return (
    <div className="pilot-page -m-3 min-h-[calc(100svh-var(--topbar-height))] bg-background sm:-m-4 lg:-m-5 xl:-m-6">
      <section className="relative isolate min-h-[22rem] overflow-hidden border-b border-border lg:min-h-[27rem]">
        <img
          src={heroImage.url}
          alt="Vista panorâmica de Itaperuna ao pôr do sol, com o Cristo de Itaperuna em primeiro plano"
          className="absolute inset-0 -z-20 size-full object-cover object-[64%_center] lg:object-center"
        />
        <div className="home-hero-mask absolute inset-0 -z-10" aria-hidden="true" />
        <div className="relative mx-auto flex min-h-[22rem] max-w-[var(--container-app)] flex-col justify-between px-5 py-7 sm:px-8 lg:min-h-[27rem] lg:px-12 lg:py-9">
          <div className="flex items-center justify-between text-hero-foreground">
            <span className="inline-flex items-center gap-2 text-micro font-bold uppercase text-hero-muted">
              <span className="size-1.5 rounded-full bg-accent" />
              Centro de situação
            </span>
            <span className="hidden text-xs text-hero-muted sm:block">
              {real ? "Rede municipal" : "Contexto demonstrativo · 2026"}
            </span>
          </div>
          <div className="max-w-[50rem] pb-2 text-hero-foreground">
            <p className="mb-4 text-xs font-semibold uppercase text-territory-accent">
              Itaperuna · Rede municipal
            </p>
            <h1 className="font-display text-[2.6rem] font-semibold leading-[1.02] sm:text-5xl lg:text-[3.75rem]">
              Educação pública com contexto e clareza.
            </h1>
            <div className="mt-6 grid max-w-3xl gap-4 border-t border-hero-border pt-5 sm:grid-cols-[1fr_auto] sm:items-end">
              <p className="max-w-xl text-sm leading-relaxed text-hero-muted sm:text-base">
                {real
                  ? "Use o menu para abrir as tarefas do seu setor. Esta página não mostra números nem registros sem fonte oficial."
                  : "Centro de trabalho demonstrativo para acompanhar o contexto escolar. Informações oficiais serão exibidas quando as fontes forem conectadas."}
              </p>
              <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-accent">
                <CalendarDays className="size-3.5" />
                {real ? "Sessão institucional" : "Ano letivo 2026"}
              </span>
            </div>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-[var(--container-app)] px-5 sm:px-8 lg:px-12">
        <section
          aria-labelledby="indicators-title"
          className="grid border-b border-border/80 py-8 lg:grid-cols-[minmax(17rem,0.72fr)_minmax(0,1.8fr)] lg:gap-14 lg:py-9"
        >
          <div>
            <p className="text-[0.65rem] font-bold uppercase text-primary">Leitura da rede</p>
            <h2
              id="indicators-title"
              className="mt-2 max-w-sm font-display text-3xl font-semibold leading-tight"
            >
              O essencial para orientar o trabalho.
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              A estrutura está pronta para receber dados oficiais sem antecipar números do
              município.
            </p>
          </div>
          <div className="mt-7 grid divide-y divide-border/80 border-y border-border/80 sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:mt-0">
            {indicators.map(({ label, icon: Icon, note }) => (
              <div key={label} className="py-5 sm:px-6 sm:py-4 first:sm:pl-0 last:sm:pr-0">
                <div className="flex items-center justify-between">
                  <span className="grid size-8 place-items-center rounded-md bg-secondary text-primary">
                    <Icon className="size-4" />
                  </span>
                  <span className="font-display text-4xl font-medium text-foreground/25">—</span>
                </div>
                <p className="mt-6 text-sm font-semibold">{label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{note}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="grid border-b border-border/80 py-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.6fr)] lg:gap-16 lg:py-9">
          <div>
            <div className="flex items-end justify-between gap-5 pb-5">
              <div>
                <p className="text-[0.65rem] font-bold uppercase text-primary">Acompanhamento</p>
                <h2 className="mt-2 font-display text-2xl font-semibold">Movimentações recentes</h2>
              </div>
              <Button variant="ghost" size="sm" disabled className="hidden sm:inline-flex">
                Ver histórico <ArrowRight />
              </Button>
            </div>
            {real ? (
              <p className="border-y border-border/80 py-6 text-sm text-muted-foreground">
                Nenhuma movimentação para mostrar aqui. As movimentações reais ficam nas telas de cada setor.
              </p>
            ) : (
              <>
            <div className="border-y border-border/80">
              {rows.map((row) => (
                <div
                  key={row.event}
                  className="group grid gap-2 border-b border-border/70 py-4 text-sm transition-colors last:border-b-0 hover:bg-card/60 md:grid-cols-[minmax(11rem,1.1fr)_minmax(10rem,1fr)_minmax(9rem,0.8fr)_auto] md:items-center md:gap-4 md:px-2"
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
              </>
            )}
          </div>
          <aside
            className="mt-9 lg:mt-0 lg:border-l lg:border-border/80 lg:pl-10"
            aria-labelledby="attention-title"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-4 text-warning-foreground" />
              <div>
                <p className="text-[0.65rem] font-bold uppercase text-warning-foreground">
                  Atenção
                </p>
                <h2 id="attention-title" className="mt-2 font-display text-xl font-semibold">
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
          <span>{brand.displayName}</span>
          <span>Prefeitura Municipal de Itaperuna · Secretaria Municipal de Educação</span>
        </footer>
      </div>
    </div>
  );
}
