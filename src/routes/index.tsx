import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, BookOpenText, CalendarDays, FileBarChart2, GraduationCap, School, Users } from "lucide-react";
import heroImage from "@/assets/itaperuna-home.png.asset.json";
import { hideBrokenImage, hideIfAlreadyBroken } from "@/lib/img-fallback";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/branding";
import { useSessionUser } from "@/features/authority/session-authority";
import { BUILDER_SOURCES } from "@/features/reports/builder-sources";
import { panoramaTotals, type PanoramaRow } from "@/features/reports/cross-reports";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `Início — ${brand.name}` },
      { name: "description", content: `A rede municipal de Itaperuna em 2026: escolas, turmas e matrículas no ${brand.fullName}.` },
      { property: "og:title", content: `${brand.displayName} — Rede municipal de Itaperuna` },
      { property: "og:description", content: `${brand.fullName} da rede municipal de Itaperuna.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const fmt = new Intl.NumberFormat("pt-BR");
const n = (v: number | null) => (v === null ? "não disponível" : fmt.format(v));

/** Lê o panorama com a sessão de quem está logado; nada é lido antes da sessão. */
function usePanorama(enabled: boolean) {
  return useQuery({
    queryKey: ["home-panorama-2026"],
    enabled,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const src = BUILDER_SOURCES.find((s) => s.id === "gerador-panorama-escolas");
      if (!src?.load) throw new Error("fonte indisponível");
      const r = await src.load({ offset: 0, limit: 5000 } as never);
      return r.rows as unknown as PanoramaRow[];
    },
  });
}

const tasks = [
  { to: "/unidades", label: "Escolas", hint: "Cadastro, turmas e pessoal de cada unidade", icon: School },
  { to: "/alunos", label: "Alunos e matrículas", hint: "Buscar, matricular, transferir", icon: GraduationCap },
  { to: "/turmas", label: "Turmas", hint: "Oferta, enturmação e designação", icon: BookOpenText },
  { to: "/profissionais", label: "Profissionais", hint: "Vínculos, lotações e funções", icon: Users },
  { to: "/relatorios", label: "Relatórios", hint: "Cruzar dados e exportar", icon: FileBarChart2 },
  { to: "/calendario-escolar", label: "Calendário escolar", hint: "Dias letivos e documento", icon: CalendarDays },
] as const;

function HomePage() {
  const { user, loading } = useSessionUser();
  const q = usePanorama(!!user);
  const rows = q.data ?? [];
  const totals = rows.length ? panoramaTotals(rows) : null;
  const ranked = [...rows].filter((r) => r.enrollments !== null).sort((a, b) => (b.enrollments ?? 0) - (a.enrollments ?? 0));
  const max = ranked[0]?.enrollments ?? 1;

  return (
    <div className="pilot-page -m-3 min-h-[calc(100svh-var(--topbar-height))] bg-background sm:-m-4 lg:-m-5 xl:-m-6">
      {/* Cabeçalho editorial: tipografia à esquerda, o vale à direita */}
      <section className="mx-auto grid max-w-[var(--container-app)] gap-8 px-5 pb-10 pt-10 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14 lg:px-12 lg:pt-14">
        <div className="flex min-w-0 flex-col justify-end">
          <p className="eyebrow">Rede municipal de Itaperuna · Ano letivo 2026</p>
          <h1 className="mt-5 font-display text-[2.75rem] leading-[0.98] sm:text-6xl lg:text-[4.5rem]">
            A rede,<br />
            <em className="font-normal italic text-primary">escola por escola.</em>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground">
            Matrículas, turmas, profissionais e calendário num só lugar, para quem trabalha na
            Secretaria Municipal de Educação e nas escolas do município.
          </p>
          {!user && !loading && (
            <div className="mt-7">
              <Button asChild size="lg"><Link to="/auth">Entrar no SIGEM</Link></Button>
            </div>
          )}
        </div>
        <figure className="relative aspect-[16/9] overflow-hidden rounded-lg lg:aspect-auto lg:min-h-[24rem]">
          <img
            src={heroImage.url}
            onError={hideBrokenImage}
            ref={hideIfAlreadyBroken}
            alt="Vale de Itaperuna e o rio Muriaé ao pôr do sol"
            className="absolute inset-y-0 left-0 h-full w-[175%] max-w-none object-cover lg:inset-0 lg:w-full lg:object-[18%_center]"
          />
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-territory/85 to-transparent px-5 pb-4 pt-12 text-xs text-hero-muted">
            Itaperuna · Noroeste Fluminense
          </figcaption>
        </figure>
      </section>

      <div className="mx-auto max-w-[var(--container-app)] px-5 sm:px-8 lg:px-12">
        {/* Números da rede */}
        <section aria-labelledby="numeros" className="border-t-2 border-foreground py-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="numeros" className="font-display text-2xl">A rede hoje</h2>
            <p className="text-xs text-muted-foreground">
              Base operacional conferida com o Educacenso 2026 · lida com o seu acesso
            </p>
          </div>
          {!user ? (
            <p className="mt-6 max-w-xl text-sm text-muted-foreground">
              Os números da rede aparecem depois que você entra. Esta página não mostra dados sem sessão.
            </p>
          ) : q.isError ? (
            <div className="mt-6 flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Não foi possível ler os números agora.</span>
              <Button variant="outline" size="sm" onClick={() => q.refetch()}>Tentar novamente</Button>
            </div>
          ) : (
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
              {[
                { k: "Escolas", v: totals?.schools ?? null, d: "unidades com dado no seu acesso" },
                { k: "Turmas", v: totals?.classes ?? null, d: "turmas registradas" },
                { k: "Matrículas", v: totals?.enrollments ?? null, d: "vínculos aluno × turma" },
                { k: "Alunos por escola", v: totals?.students ?? null, d: "soma de alunos distintos em cada escola" },
              ].map((m) => (
                <div key={m.k} className="min-w-0 border-l border-border pl-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-accent-foreground">{m.k}</dt>
                  <dd className="mt-2 font-display text-4xl tabular-nums sm:text-5xl">
                    {q.isLoading ? <span className="inline-block h-10 w-24 animate-pulse rounded bg-muted" /> : n(m.v)}
                  </dd>
                  <dd className="mt-1 text-xs text-muted-foreground">{m.d}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <div className="grid gap-12 border-t border-border py-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(16rem,1fr)] lg:gap-16">
          {/* Distribuição das matrículas */}
          <section aria-labelledby="dist" className="min-w-0">
            <p className="eyebrow">Distribuição</p>
            <h2 id="dist" className="mt-2 font-display text-2xl">Matrículas por escola</h2>
            {!user ? (
              <p className="mt-4 text-sm text-muted-foreground">Disponível após entrar.</p>
            ) : q.isLoading ? (
              <div className="mt-6 space-y-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-5 animate-pulse rounded bg-muted" />)}</div>
            ) : ranked.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Nenhuma escola com matrículas no seu acesso.</p>
            ) : (
              <>
                <ol className="mt-6 space-y-2.5">
                  {ranked.slice(0, 15).map((r) => (
                    <li key={r.school + r.inep} className="grid grid-cols-[minmax(0,14rem)_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm">
                      <span className="truncate" title={r.school}>{r.school}</span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${((r.enrollments ?? 0) / max) * 100}%` }} />
                      </span>
                      <span className="text-right tabular-nums text-muted-foreground">{fmt.format(r.enrollments ?? 0)}</span>
                    </li>
                  ))}
                </ol>
                <Link to="/relatorios" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                  Ver as {ranked.length} escolas no panorama <ArrowUpRight className="size-4" />
                </Link>
              </>
            )}
          </section>

          {/* Tarefas */}
          <nav aria-labelledby="tarefas">
            <p className="eyebrow">Trabalhar</p>
            <h2 id="tarefas" className="mt-2 font-display text-2xl">Ir direto à tarefa</h2>
            <ul className="mt-5 divide-y divide-border border-y border-border">
              {tasks.map(({ to, label, hint, icon: Icon }) => (
                <li key={to}>
                  <Link to={to} className="group flex items-center gap-4 py-3.5">
                    <Icon className="size-5 shrink-0 text-accent-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium group-hover:text-primary">{label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{hint}</span>
                    </span>
                    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <footer className="flex flex-col gap-2 border-t border-border py-7 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <span>{brand.displayName}</span>
          <span>Prefeitura Municipal de Itaperuna · Secretaria Municipal de Educação</span>
        </footer>
      </div>
    </div>
  );
}
