import { useQuery } from "@tanstack/react-query";
/**
 * App Shell 2.0 — Etapa 13UX.
 *
 * A casca do SIGEM responde sempre a três perguntas: onde estou, em que unidade
 * estou atuando e como encontro o que preciso. A navegação é apresentada por
 * AMBIENTE DE TRABALHO e continuará sendo derivada do contexto institucional do
 * agente; nada aqui codifica cargo nem cria sessão, usuário ou permissão.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  CircleHelp,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";
import sigemLogo from "@/assets/logo-sigem.png.asset.json";
import brasao from "@/assets/brasao-itaperuna.png.asset.json";
import { brand } from "@/config/branding";
import { pageTitleForPath, provisionalNavigation } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessionAuthority } from "@/features/authority/session-authority";
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

/** Unidades apenas para representar a troca de contexto; sem autenticação. */
const DEMO_UNITS = [
  "Instituição Educacional Demonstrativa Horizonte",
  "Escola Demonstrativa Águas Claras",
] as const;

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <img
        src={brasao.url}
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
          <p className="mt-1 truncate text-[0.625rem] font-semibold uppercase tracking-wide text-sidebar-muted">
            Itaperuna · RJ
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
  const inAdvanced = provisionalNavigation
    .filter((group) => ADVANCED_GROUPS.includes(group.label))
    .some((group) =>
      group.items.some(
        (item) => item.to === pathname || (item.to !== "/" && pathname.startsWith(`${item.to}/`)),
      ),
    );
  const [showAdvanced, setShowAdvanced] = useState(inAdvanced);
  const groups = provisionalNavigation.filter(
    (group) => compact || showAdvanced || !ADVANCED_GROUPS.includes(group.label),
  );
  return (
    <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <div className="mb-5" key={group.label}>
          {!compact && (
            <p className="mb-2 px-2.5 text-[0.625rem] font-semibold uppercase tracking-wide text-sidebar-muted/70">
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
                    "relative flex min-h-11 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-foreground before:absolute before:inset-y-2.5 before:left-0 before:w-0.5 before:rounded-full before:bg-territory-accent"
                      : "text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    compact && "justify-center px-0",
                  )}
                >
                  <Icon className="size-[1.125rem] shrink-0" aria-hidden="true" />
                  {!compact && <span className="truncate">{item.label}</span>}
                </div>
              );
              const wrapped = <Link to={item.to}>{content}</Link>;
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
        <div className="mx-4 mb-3 border-l border-sidebar-border pl-3">
          <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-sidebar-muted">
            Prefeitura de Itaperuna
          </p>
          <p className="mt-0.5 text-[0.6875rem] text-sidebar-foreground/75">
            Secretaria Municipal de Educação
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

function SystemSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Para onde você quer ir?" />
      <CommandList>
        <CommandEmpty>Nada encontrado com esse nome.</CommandEmpty>
        {provisionalNavigation.map((group) => (
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
  const session = useSessionAuthority();
  return (
    <header
      className={cn(
        "print:hidden fixed right-0 top-0 z-30 h-[var(--topbar-height)] border-b border-border/80 bg-card/90 backdrop-blur-xl transition-[left] duration-200",
        compact ? "lg:left-[var(--sidebar-collapsed-width)]" : "lg:left-[var(--sidebar-width)]",
        "left-0",
      )}
    >
      <div className="flex h-full items-center gap-2 px-3 sm:px-5">
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

        <p className="min-w-0 truncate font-display text-base font-semibold text-foreground lg:text-lg">
          {pageName}
        </p>

        <button
          type="button"
          onClick={onOpenSearch}
          className="ml-auto hidden h-10 min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted md:flex md:w-64 lg:w-80"
        >
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Buscar no sistema</span>
          <kbd className="ml-auto hidden rounded border border-border bg-card px-1.5 text-[0.625rem] font-semibold lg:block">
            ⌘K
          </kbd>
        </button>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Buscar no sistema"
          onClick={onOpenSearch}
        >
          <Search />
        </Button>

        {session.status === "signed-in" ? <InstitutionalContextBadge /> : session.status === "loading" ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="ml-auto hidden min-h-10 max-w-[18rem] gap-2 px-2 md:ml-0 md:flex"
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


        <Button variant="ghost" size="icon" aria-label="Avisos">
          <Bell />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Ajuda" className="hidden sm:inline-flex">
          <CircleHelp />
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

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (pathname === "/login") return <>{children}</>;

  return (
    <TooltipProvider delayDuration={250}>
      <div className="min-h-screen bg-background" data-density="comfortable">
        <Sidebar compact={compact} onToggle={() => setCompact((value) => !value)} />
        <Topbar
          compact={compact}
          unit={unit}
          onUnitChange={setUnit}
          onOpenSearch={() => setSearchOpen(true)}
        />
        <SystemSearch open={searchOpen} onOpenChange={setSearchOpen} />
        <main
          className={cn(
            "min-h-screen pt-[var(--topbar-height)] transition-[padding] duration-200 print:!p-0",
            compact ? "lg:pl-[var(--sidebar-collapsed-width)]" : "lg:pl-[var(--sidebar-width)]",
          )}
        >
          <div className="app-workspace mx-auto w-full max-w-[var(--container-app)] p-4 sm:p-5 lg:p-6 print:!max-w-none print:!p-0">
            {children}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

function SessionMenu() {
  const authority = useSessionAuthority();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  if (authority.status !== "signed-in")
    return (
      <Button asChild variant="outline" size="sm">
        <Link to="/auth">Entrar</Link>
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
              ? `${authority.capabilities.length} capacidade(s) efetiva(s) pela política homologada.`
              : "Conta ainda não vinculada a pessoa institucional — nenhuma capacidade."}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await queryClient.cancelQueries();
            queryClient.clear();
            await supabase.auth.signOut();
            navigate({ to: "/auth", replace: true });
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
