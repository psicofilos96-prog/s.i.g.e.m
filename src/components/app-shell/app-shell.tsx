import { useQuery } from "@tanstack/react-query";
import { ConnectionBanner } from "./connection-banner";
/**
 * App Shell 2.0 — Etapa 13UX.
 *
 * A casca do SIGEM responde sempre a três perguntas: onde estou, em que unidade
 * estou atuando e como encontro o que preciso. A navegação é apresentada por
 * AMBIENTE DE TRABALHO e continuará sendo derivada do contexto institucional do
 * agente; nada aqui codifica cargo nem cria sessão, usuário ou permissão.
 */
import { useRecoveryTrail } from "@/lib/observability/recovery-trail";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";
import sigemLogo from "@/assets/logo-sigem.png.asset.json";
import { institution } from "@/config/institution";
import { isPublicPath } from "@/features/public-portal/public-paths";
import { markVoluntarySignOut, safeRedirect } from "@/features/authority/session-lifecycle";
import { brand } from "@/config/branding";
import { breadcrumbForPath, pageTitleForPath, provisionalNavigation } from "@/config/navigation";
import { guideForPath } from "@/config/route-guides";
import { TaskGuide } from "@/components/sigem/guidance";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { requiresSessionBeforeRead } from "@/features/authority/session-read-gate";
import { pathAllowed } from "@/features/authority/nav-capabilities";
import { STATION_HOME, STATION_LABEL, stationAllowsPath } from "@/features/authority/station-navigation";
import { Kbd } from "@/components/sigem/kbd";
import { SEARCH_SHORTCUT_LABEL, isSearchShortcut } from "@/lib/keyboard";
import { NotificationBell } from "@/features/notifications/notification-bell";
import { ContextHelp, WhatThisMeans } from "@/features/help/help-components";
import { CATEGORY_LABEL, MATCH_LABEL, MIN_QUERY, deepLink, groupHits, stationScopedHits, useDebounced, useGlobalSearch } from "@/features/global-search/global-search";
import { useGeneralAdmin } from "@/features/institutional-admin/general-admin";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { countLabel } from "@/lib/format-ptbr";

/** Unidades apenas para representar a troca de contexto; sem autenticação. */
const DEMO_UNITS = [
  "Instituição Educacional Demonstrativa Horizonte",
  "Escola Demonstrativa Águas Claras",
] as const;

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <img
        src={institution.emblemUrl}
        alt=""
        className="size-8 shrink-0 object-contain"
      />
      {!compact && (
        <div className="min-w-0">
          <img
            src={sigemLogo.url}
            alt={brand.name}
            className="h-4 w-auto max-w-[6.5rem] object-contain object-left brightness-0 invert"
          />
          <p className="mt-1 truncate text-2xs font-semibold uppercase tracking-wide text-sidebar-muted">
            {institution.locality}
          </p>
        </div>
      )}
    </div>
  );
}

/** Grupos especializados: acessíveis, mas revelados sob demanda. */
const ADVANCED_GROUPS = ["Normas da rede", "Sistema"];

function SidebarNavigation({
  compact = false,
  closeOnNavigate = false,
}: {
  compact?: boolean;
  closeOnNavigate?: boolean;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const authority = useSessionAuthority();
  const generalAdmin = useGeneralAdmin(authority);
  const inAdvanced = provisionalNavigation
    .filter((group) => ADVANCED_GROUPS.includes(group.label))
    .some((group) =>
      group.items.some(
        (item) => item.to === pathname || (item.to !== "/" && pathname.startsWith(`${item.to}/`)),
      ),
    );
  const [showAdvanced, setShowAdvanced] = useState(inAdvanced);
  const principal = authority.status === "signed-in" ? (authority.principal ?? null) : null;
  // BQ.1 Lote 2 — conta de setor vê só a própria estação; humanos inalterados.
  // Lote 2.1: enquanto a autoridade carrega, o menu fica vazio (antes mostrava tudo por um instante a contas de setor).
  const groups = authority.status === "loading" ? [] : provisionalNavigation
    .filter((group) => principal !== null || compact || showAdvanced || !ADVANCED_GROUPS.includes(group.label))
    // NACL.UI.1: mesma regra de estação × capacidade usada por paleta, busca, cards e deep link.
    .map((group) => authority.status === "signed-in" ? { ...group, items: group.items.filter((item) => pathAllowed(authority, item.to)) } : group)
    .filter((group) => group.items.length > 0);
  const generalAdminLink = (
    <Link
      to="/administracao-geral"
      aria-current={pathname === "/administracao-geral" ? "page" : undefined}
    >
      <div
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-lg px-2.5 text-sm font-medium text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          pathname === "/administracao-geral" && "bg-sidebar-accent text-sidebar-foreground",
          compact && "justify-center px-0",
        )}
      >
        <Building2 className="size-[1.125rem] shrink-0" aria-hidden="true" />
        {!compact && <span>Administração Geral</span>}
      </div>
    </Link>
  );
  const generalAdminNavigable = closeOnNavigate ? (
    <SheetClose asChild>{generalAdminLink}</SheetClose>
  ) : (
    generalAdminLink
  );
  // NLOADING.2: enquanto a autoridade é lida, reserva o espaço do menu (sem piscar opções de outro setor).
  if (authority.status === "loading" && !authority.error)
    return (
      <nav aria-label="Navegação principal" aria-busy="true" data-sigem-nav-skeleton className="flex-1 overflow-y-auto px-3 py-4">
        <span className="sr-only">Carregando menu</span>
        <ul className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <li key={i} aria-hidden className="h-9 animate-pulse rounded-lg bg-sidebar-accent/40" />)}</ul>
      </nav>
    );
  return (
    <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <div className="mb-5" key={group.label}>
          {!compact && (
            <p className="mb-1.5 px-2.5 text-2xs font-semibold uppercase tracking-[0.1em] text-sidebar-muted/80">
              {group.label}
            </p>
          )}
          <ul className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.to === pathname || (item.to !== "/" && pathname.startsWith(`${item.to}/`));
              const content = (
                <div
                  className={cn(
                    "relative flex min-h-10 items-center gap-3 rounded-lg px-2.5 text-[0.875rem] font-medium transition-colors duration-150",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-foreground shadow-[inset_0_0_0_1px_var(--sidebar-border)] before:absolute before:inset-y-2 before:-left-3 before:w-[3px] before:rounded-r-full before:bg-territory-accent"
                      : "text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    compact && "justify-center px-0",
                  )}
                >
                  <Icon className="size-[1.125rem] shrink-0" aria-hidden="true" />
                  {!compact && <span className="truncate">{item.label}</span>}
                </div>
              );
              const wrapped = <Link to={item.to} aria-current={isActive ? "page" : undefined}>{content}</Link>;
              const navigable = closeOnNavigate ? (
                <SheetClose asChild>{wrapped}</SheetClose>
              ) : (
                wrapped
              );
              return (
                <li key={item.label}>
                  {compact ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{navigable}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    navigable
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {generalAdmin.status === "general-admin" ? (
        <div className="mb-5">
          {!compact && (
            <p className="mb-2 px-2.5 text-2xs font-semibold uppercase tracking-wide text-sidebar-muted">
              Administração
            </p>
          )}
          {compact ? (
            <Tooltip>
              <TooltipTrigger asChild>{generalAdminNavigable}</TooltipTrigger>
              <TooltipContent side="right">Administração Geral</TooltipContent>
            </Tooltip>
          ) : generalAdminNavigable}
        </div>
      ) : null}
      {!compact && !showAdvanced ? (
        <button
          type="button"
          onClick={() => setShowAdvanced(true)}
          className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        >
          <ChevronDown className="size-[1.125rem] shrink-0" aria-hidden="true" />
          <span>Mais funções</span>
        </button>
      ) : null}
    </nav>
  );
}

function Sidebar({ compact, onToggle }: { compact: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        "sidebar-terrain print:!hidden fixed inset-y-0 left-0 z-40 hidden flex-col overflow-hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex",
        compact ? "w-[var(--sidebar-collapsed-width)]" : "w-[var(--sidebar-width)]",
      )}
    >
      <div
        className={cn(
          "flex h-[var(--topbar-height)] items-center border-b border-sidebar-border/70 px-4",
          compact && "justify-center px-2",
        )}
      >
        <Brand compact={compact} />
      </div>
      <SidebarNavigation compact={compact} />
      {!compact && (
        <div className="print:hidden mx-4 mb-3 border-l border-sidebar-border pl-3">
          <p className="text-2xs font-semibold uppercase tracking-wide text-sidebar-muted">
            {institution.governmentName}
          </p>
          <p className="mt-0.5 text-micro text-sidebar-foreground/75">
            {institution.departmentName}
          </p>
        </div>
      )}
      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          className={cn(
            "min-h-11 w-full text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
            compact ? "px-0" : "justify-start",
          )}
          onClick={onToggle}
          aria-label={compact ? "Expandir menu lateral" : "Recolher menu lateral"}
        >
          {compact ? (
            <PanelLeftOpen />
          ) : (
            <>
              <PanelLeftClose />
              <span>Recolher menu</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}

function GlobalResults({ query, onPick }: { query: string; onPick: (to: string, params?: Record<string, string>) => void }) {
  const session = useSessionAuthority();
  const [page, setPage] = useState(0);
  const debounced = useDebounced(query);
  useEffect(() => setPage(0), [debounced]);
  const r = useGlobalSearch(debounced, session.status === "signed-in", page);
  if (session.status !== "signed-in" || debounced.trim().length < MIN_QUERY) return null;
  if (r.isError) return <p role="alert" className="px-3 py-2 text-sm text-destructive">A pesquisa não respondeu. Tente novamente.</p>;
  if (r.isLoading) return <p role="status" className="px-3 py-2 text-sm text-muted-foreground">Pesquisando…</p>;
  // NACL.UI.1: busca nunca oferece destino que a sessão não pode abrir.
  const groups = groupHits(stationScopedHits(r.data?.hits ?? [], (p) => pathAllowed(session, p)));
  return (
    <>
      {groups.length === 0 && page === 0 && <p role="status" className="px-3 py-2 text-sm text-muted-foreground">Nenhum registro ao seu alcance corresponde a “{debounced.trim()}”.</p>}
      {groups.map(([cat, hits]) => (
        <CommandGroup key={cat} heading={CATEGORY_LABEL[cat]}>
          {hits.map((h) => {
            const link = deepLink(h);
            return (
              <CommandItem key={`${cat}-${h.entity_id}`} value={`${debounced} ${cat} ${h.entity_id}`} disabled={!link} onSelect={() => link && onPick(link.to, link.params)}>
                <span className="truncate">{h.title}</span>
                <span className="ml-auto truncate text-xs text-muted-foreground">{[h.subtitle, MATCH_LABEL[h.match_kind]].filter(Boolean).join(" · ")}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      ))}
      {(page > 0 || r.data?.hasMore) && (
        <div className="flex justify-between px-3 py-2 text-xs">
          <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="disabled:opacity-40">← anteriores</button>
          <button type="button" disabled={!r.data?.hasMore} onClick={() => setPage(page + 1)} className="disabled:opacity-40">próximos →</button>
        </div>
      )}
    </>
  );
}

function SystemSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const authority = useSessionAuthority();
  // NACL.UI.1: atalhos da paleta seguem a mesma regra; autoridade incompleta ⇒ nenhum atalho.
  const shortcutGroups = provisionalNavigation
    .map((g) => ({ ...g, items: g.items.filter((i) => pathAllowed(authority, i.to)) }))
    .filter((g) => g.items.length > 0);
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar estudante, turma, unidade, matriz… ou ir para uma área" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>
        <GlobalResults query={query} onPick={(to, params) => { onOpenChange(false); void navigate({ to, params } as never); }} />
        {shortcutGroups.map((group) => (
          <CommandGroup key={group.label} heading={group.label}>
            {group.items.map((item) => (
              <CommandItem
                key={item.to}
                value={`${item.label} ${item.hint ?? ""}`}
                onSelect={() => {
                  onOpenChange(false);
                  void navigate({ to: item.to });
                }}
              >
                <item.icon className="size-4" aria-hidden="true" />
                <span>{item.label}</span>
                {item.hint ? (
                  <span className="ml-auto truncate text-xs text-muted-foreground">
                    {item.hint}
                  </span>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

function Topbar({
  compact,
  unit,
  onUnitChange,
  onOpenSearch,
}: {
  compact: boolean;
  unit: string;
  onUnitChange: (unit: string) => void;
  onOpenSearch: () => void;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const pageName = pageTitleForPath(pathname);
  const crumb = breadcrumbForPath(pathname);
  const session = useSessionAuthority();
  return (
    <header
      className={cn(
        "print:hidden fixed right-0 top-0 z-30 h-[var(--topbar-height)] border-b border-border/80 bg-card/90 backdrop-blur-xl transition-[left] duration-200",
        compact ? "lg:left-[var(--sidebar-collapsed-width)]" : "lg:left-[var(--sidebar-width)]",
        "left-0",
      )}
    >
      <div className="print:hidden flex h-full items-center gap-2 px-3 sm:px-5">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[17rem] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
          >
            <SheetTitle className="sr-only">Menu principal</SheetTitle>
            <div className="flex h-[var(--topbar-height)] items-center border-b border-sidebar-border px-4">
              <Brand />
            </div>
            <SidebarNavigation closeOnNavigate />
          </SheetContent>
        </Sheet>

        <nav aria-label="Você está em" className="min-w-0">
          <ol className="flex min-w-0 items-center gap-1.5 text-sm">
            {crumb.group && (
              <li className="hidden shrink-0 items-center gap-1.5 text-muted-foreground md:flex">
                <span>{crumb.group}</span>
                <ChevronRight className="size-3.5 opacity-60" aria-hidden="true" />
              </li>
            )}
            <li aria-current="page" className="min-w-0 truncate font-display text-[0.9375rem] font-semibold text-foreground lg:text-base">
              {pageName}
            </li>
          </ol>
        </nav>

        <button
          type="button"
          onClick={onOpenSearch}
          className="ml-auto hidden h-10 pointer-coarse:h-11 min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted lg:flex lg:w-80"
        >
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Buscar no sistema</span>
          <Kbd className="ml-auto hidden lg:block">{SEARCH_SHORTCUT_LABEL}</Kbd>
        </button>

        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Buscar no sistema"
          onClick={onOpenSearch}
        >
          <Search />
        </Button>

        <ContextHelp />
        {session.status === "signed-in" && <NotificationBell />}
        {session.status === "signed-in" ? <InstitutionalContextBadge /> : session.status === "loading" ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="ml-auto hidden min-h-10 max-w-[10rem] gap-2 px-2 md:flex lg:ml-0 lg:max-w-[18rem]"
              aria-label="Trocar a unidade em que estou atuando"
            >
              <Building2 className="size-4 text-muted-foreground" />
              <span className="truncate text-sm">{unit}</span>
              <ChevronDown className="size-3.5 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Estou atuando em</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {DEMO_UNITS.map((option) => (
              <DropdownMenuItem key={option} onSelect={() => onUnitChange(option)}>
                {option === unit ? <Check className="size-4" /> : <span className="size-4" />}
                <span className="[overflow-wrap:anywhere]">{option}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        )}


        <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex">
          <Link to="/ajuda" aria-label="Central de ajuda">
            <CircleHelp />
          </Link>
        </Button>

        <SessionMenu />
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [compact, setCompact] = useState(false);
  const [unit, setUnit] = useState<string>(DEMO_UNITS[0]);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // NHOME.1: ação principal do guia só com sessão — sem login a página de destino também pede entrada.
  const signedInForGuide = useSessionAuthority().status === "signed-in";

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // NKEY.1: tela com busca própria (ex.: Secretaria) trata antes e marca o evento.
      if (isSearchShortcut(event) && !event.defaultPrevented) {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (pathname === "/login" || pathname === "/auth" || pathname === "/primeiro-acesso" || isPublicPath(pathname)) return <>{children}</>;

  return (
    <TooltipProvider delayDuration={250}>
      <div className="min-h-dvh bg-background" data-density="comfortable">
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring">Pular para o conteúdo</a>
        <Sidebar compact={compact} onToggle={() => setCompact((value) => !value)} />
        <Topbar
          compact={compact}
          unit={unit}
          onUnitChange={setUnit}
          onOpenSearch={() => setSearchOpen(true)}
        />
        <SystemSearch open={searchOpen} onOpenChange={setSearchOpen} />
        <main
          id="conteudo"
          tabIndex={-1}
          className={cn(
            "min-h-dvh pt-[var(--topbar-height)] outline-none transition-[padding] duration-200 motion-reduce:transition-none print:!p-0",
            compact ? "lg:pl-[var(--sidebar-collapsed-width)]" : "lg:pl-[var(--sidebar-width)]",
          )}
        >
          <div className="app-workspace mx-auto w-full max-w-[var(--content-max)] px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8 print:!max-w-none print:!p-0">
            <ConnectionBanner />
            <StationGate pathname={pathname}>
              {(() => {
                const g = guideForPath(pathname);
                return g ? <div className="mb-4 print:hidden" data-route-guide><TaskGuide where={g.where} todo={g.todo} {...(g.next ? { next: g.next } : {})} action={g.primary && signedInForGuide ? <Button asChild size="sm" className="min-h-11"><Link to={g.primary.to}>{g.primary.label}</Link></Button> : undefined} /></div> : null;
              })()}
              <div className="mb-4 empty:hidden print:hidden"><WhatThisMeans pathname={pathname} /></div>
              {children}
            </StationGate>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

/** NOBS.4 — falha ao ler a autoridade: recarregar entra na trilha de recuperação. */
function StationLoadError({ error }: { error: unknown }) {
  const trail = useRecoveryTrail(error, { operation: "ler-autoridade" }, { onReload: () => window.location.reload() });
  return (
    <section role="alert" className="mx-auto mt-10 max-w-xl rounded-2xl border border-border bg-card p-8 text-center shadow-panel">
      <h1 className="font-display text-xl font-semibold text-foreground">Não conseguimos abrir sua área</h1>
      <p className="mt-2 text-sm text-muted-foreground">{trail.governed.userMessage}</p>
      <p className="mt-1 text-xs text-muted-foreground">Código para o suporte: {trail.governed.correlationId}</p>
      <Button className="mt-5" onClick={trail.reload}>Tentar novamente</Button>
    </section>
  );
}

/** BQ.1 Lote 2 — rota fora da estação da conta de setor não renderiza o conteúdo. */
function StationGate({ pathname, children }: { pathname: string; children: ReactNode }) {
  const authority = useSessionAuthority();
  // Lote 2.1: autoridade ainda não lida ⇒ conteúdo não é montado (falha fechada; o servidor recusa de todo modo).
  if (authority.status === "loading") {
    if (authority.error) return <StationLoadError error={authority.error} />;
    return (
      <div role="status" aria-label="Abrindo sua área" data-sigem-shell-skeleton className="space-y-6" >
        {/* NROUTE.3: título principal existe também enquanto a área abre (leitores de tela). */}
        <h1 className="sr-only">{pageTitleForPath(pathname)}</h1>
        <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }
  // PERF.LOADING.1: rotas que leem dados de domínio não montam sem sessão (antes geravam 401 e ruído).
  if (authority.status === "signed-out" && requiresSessionBeforeRead(pathname)) {
    return (
      <section role="alert" data-sigem-session-gate="signed-out" className="mx-auto mt-10 max-w-xl rounded-2xl border border-border bg-card p-8 text-center shadow-panel">
        <h1 className="font-display text-xl font-semibold text-foreground">Entre para abrir esta página</h1>
        <p className="mt-2 text-sm text-muted-foreground">Esta área mostra dados da rede e só abre com sua conta.</p>
        <Button asChild size="lg" className="mt-6"><Link to="/auth" search={{ redirect: pathname }}>Entrar</Link></Button>
      </section>
    );
  }
  const principal = authority.status === "signed-in" ? (authority.principal ?? null) : null;
  if (authority.status !== "signed-in" || pathAllowed(authority, pathname)) return <>{children}</>;
  // NACL.UI.1: deep link sem a capacidade exigida pela tela ⇒ AccessDenied (o servidor recusa de todo modo).
  if (!principal || stationAllowsPath(principal.station, pathname)) {
    return (
      <section role="alert" data-sigem-access-denied="capability" className="mx-auto mt-10 max-w-xl rounded-2xl border border-border bg-card p-8 text-center shadow-panel">
        <h1 className="font-display text-xl font-semibold text-foreground">Você não tem acesso a esta área</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sua atuação não inclui a permissão que esta página exige. Se precisar dela, peça à administração da rede.</p>
        <Button asChild size="lg" className="mt-6"><Link to={principal ? STATION_HOME[principal.station] : "/"}>Voltar ao início</Link></Button>
      </section>
    );
  }
  return (
    <section role="alert" data-sigem-station-gate="blocked" className="mx-auto mt-10 max-w-xl rounded-2xl border border-border bg-card p-8 text-center shadow-panel">
      <div aria-hidden className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-foreground">
        <Building2 className="h-7 w-7" />
      </div>
      <h1 className="mt-4 font-display text-xl font-semibold text-foreground">Esta página é de outro setor</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Você entrou como {STATION_LABEL[principal.station]}. Esta área não faz parte do seu trabalho — o sistema também protege estes dados no servidor.
      </p>
      <Button asChild size="lg" className="mt-6"><Link to={STATION_HOME[principal.station]}>Voltar para a minha área</Link></Button>
    </section>
  );
}

function SessionMenu() {
  const authority = useSessionAuthority();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // BO.5: durante a leitura da sessão não oferecer "Entrar" a quem já está autenticado.
  if (authority.status === "loading" && !authority.error)
    return <span role="status" aria-label="Carregando sessão" className="inline-block h-8 w-16 animate-pulse rounded-md bg-muted" />;
  if (authority.status !== "signed-in")
    return (
      <Button asChild variant="outline" size="sm" className="shrink-0 whitespace-nowrap">
        <Link to="/auth" search={{ ...(safeRedirect(typeof window === "undefined" ? null : window.location.pathname + window.location.search) ? { redirect: window.location.pathname + window.location.search } : {}) }}>Entrar</Link>
      </Button>
    );
  const name = authority.person?.displayName ?? authority.user.email ?? "Conta";
  const initials = name.split(/\s|@/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="min-h-10 gap-2 px-2" aria-label="Abrir meu perfil">
          <span className="grid size-8 place-items-center rounded-full bg-institutional text-xs font-bold text-institutional-foreground">
            {initials}
          </span>
          <span className="hidden max-w-40 truncate text-left text-xs font-semibold xl:block">{name}</span>
          <ChevronDown className="hidden size-3.5 xl:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>
          {name}
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
            {authority.person
              ? `${countLabel(authority.capabilities.length, "capacidade efetiva", "capacidades efetivas")} pela política homologada.`
              : "Conta ainda não vinculada a pessoa institucional — nenhuma capacidade."}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            markVoluntarySignOut();
            try {
              await queryClient.cancelQueries();
              queryClient.clear();
              await supabase.auth.signOut();
            } finally {
              // NAUTH.3: falha de rede ao sair nunca deixa a tela protegida aberta.
              queryClient.clear();
              navigate({ to: "/auth", replace: true });
            }
          }}
        >
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Em sessão real, o topo mostra a rede e o estado verdadeiro da instalação — nunca uma unidade demonstrativa. */
function InstitutionalContextBadge() {
  const authority = useSessionAuthority();
  const generalAdmin = useGeneralAdmin(authority);
  const q = useQuery({
    queryKey: ["b468-installation-state"], retry: false,
    queryFn: async () => { const r = await supabase.from("sigem_installation_state").select("state").maybeSingle(); if (r.error) throw r.error; return r.data?.state ?? null; },
  });
  const text = q.error ? "Rede municipal · estado da instalação indisponível"
    : q.isLoading ? "Rede municipal"
    : q.data === "instalado" ? "Rede municipal" : q.data === "nao-instalado" ? "Rede municipal · SIGEM não instalado" : "Rede municipal · estado não reconhecido";
  return (
    <span className="ml-auto hidden max-w-[24rem] items-center gap-2 px-2 text-sm md:ml-0 md:flex" aria-label="Contexto institucional" data-sigem-build="b4.6.8-header">
      <Building2 className="size-4 text-muted-foreground" /><span className="truncate">{text}</span>
      {generalAdmin.status === "general-admin" ? (
        <Link to="/administracao-geral" className="shrink-0 rounded-md border border-border px-2 py-0.5 text-xs font-semibold hover:bg-muted">
          Administração Geral
        </Link>
      ) : null}
    </span>
  );
}
