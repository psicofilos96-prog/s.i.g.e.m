import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, CircleHelp, Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import sigemLogo from "@/assets/logo-sigem.png.asset.json";
import { brand } from "@/config/branding";
import { provisionalNavigation } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3.5 overflow-hidden">
      <div className="grid size-9 shrink-0 place-items-center overflow-hidden">
        <img
          src={sigemLogo.url}
          alt=""
          className="h-8 w-[6.5rem] max-w-none object-contain object-left brightness-0 invert"
        />
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="truncate font-display text-base font-bold text-sidebar-foreground">
            {brand.name}
          </p>
          <p className="truncate text-[0.625rem] font-semibold uppercase text-sidebar-muted">
            Educação · Itaperuna
          </p>
        </div>
      )}
    </div>
  );
}

function SidebarNavigation({
  compact = false,
  closeOnNavigate = false,
}: {
  compact?: boolean;
  closeOnNavigate?: boolean;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-3 py-5">
      {provisionalNavigation.map((group) => (
        <div className="mb-6" key={group.label}>
          {!compact && (
            <p className="mb-2.5 px-2 text-[0.625rem] font-semibold uppercase text-sidebar-muted/65">
              {group.label}
            </p>
          )}
          <ul className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.to === pathname ||
                (Boolean(item.to) && item.to !== "/" && pathname.startsWith(`${item.to}/`));
              const content = (
                <div
                  className={cn(
                    "group relative flex h-9 items-center gap-3 rounded-md px-2.5 text-[0.8125rem] font-medium transition-colors duration-150",
                    isActive
                      ? "bg-sidebar-accent/85 text-sidebar-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-territory-accent"
                      : "text-sidebar-muted hover:bg-sidebar-accent/45 hover:text-sidebar-foreground",
                    compact && "justify-center px-0",
                    !item.to && "cursor-default opacity-80",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {!compact && <span className="truncate">{item.label}</span>}
                </div>
              );
              const wrapped = item.to ? <Link to={item.to}>{content}</Link> : content;
              const navigable =
                item.to && closeOnNavigate ? <SheetClose asChild>{wrapped}</SheetClose> : wrapped;
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
        <div className="mx-4 mb-4 border-l border-sidebar-border pl-3">
          <p className="text-[0.625rem] font-semibold uppercase text-sidebar-muted">
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
            "w-full text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
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

function Topbar({ compact }: { compact: boolean }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const pageName = pathname.startsWith("/unidades")
    ? "Unidades escolares"
    : pathname.startsWith("/alunos")
      ? "Alunos"
      : pathname.startsWith("/diario")
        ? "Diário Inteligente"
        : pathname.startsWith("/atuacoes-pedagogicas")
          ? "Atuações pedagógicas"
          : pathname.startsWith("/horarios")
            ? "Horários escolares"
            : pathname.startsWith("/calendario-escolar")
              ? "Calendário escolar"
              : pathname.startsWith("/profissionais")
                ? "Profissionais"
                : pathname.startsWith("/matrizes-curriculares")
                  ? "Matrizes curriculares"
                  : pathname.startsWith("/turmas")
                    ? "Turmas"
                    : pathname === "/design-system"
                      ? "Design System"
                      : "Centro de situação";
  return (
    <header
      className={cn(
        "print:hidden fixed right-0 top-0 z-30 h-[var(--topbar-height)] border-b border-border/80 bg-card/88 backdrop-blur-xl transition-[left] duration-200",
        compact ? "lg:left-[var(--sidebar-collapsed-width)]" : "lg:left-[var(--sidebar-width)]",
        "left-0",
      )}
    >
      <div className="grid h-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,22rem)_auto]">
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
        <div className="hidden min-w-0 items-center gap-2 md:flex">
          <span className="truncate text-xs font-semibold text-foreground">{brand.name}</span>
          <span className="text-border">/</span>
          <span className="truncate text-xs text-muted-foreground">{pageName}</span>
        </div>
        <div className="relative hidden max-w-xs justify-self-end lg:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            aria-label="Pesquisa futura"
            disabled
            placeholder={`Pesquisar no ${brand.name} (em breve)`}
            className="h-8 w-full rounded-md border border-transparent bg-muted/55 pl-9 pr-3 text-xs text-muted-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
        </div>
        <span className="truncate text-sm font-semibold md:hidden">{pageName}</span>
        <div className="flex items-center gap-1 justify-self-end">
          <Button variant="ghost" size="icon" aria-label="Ajuda">
            <CircleHelp />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="ml-1 gap-2 px-2" aria-label="Abrir menu do perfil">
                <span className="grid size-7 place-items-center rounded-md bg-institutional text-xs font-bold text-institutional-foreground">
                  SME
                </span>
                <span className="hidden text-left xl:block">
                  <span className="block text-xs font-semibold">Usuário demonstrativo</span>
                  <span className="block text-[0.6875rem] font-normal text-muted-foreground">
                    Contexto visual
                  </span>
                </span>
                <ChevronDown className="hidden size-3.5 xl:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Perfil demonstrativo</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>Preferências (em breve)</DropdownMenuItem>
              <DropdownMenuItem disabled>Sair (indisponível)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [compact, setCompact] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname === "/login") return <>{children}</>;
  return (
    <TooltipProvider delayDuration={250}>
      <div className="min-h-screen bg-background">
        <Sidebar compact={compact} onToggle={() => setCompact((value) => !value)} />
        <Topbar compact={compact} />
        <main
          className={cn(
            "min-h-screen pt-[var(--topbar-height)] transition-[padding] duration-200 print:!p-0",
            compact ? "lg:pl-[var(--sidebar-collapsed-width)]" : "lg:pl-[var(--sidebar-width)]",
          )}
        >
          <div className="app-workspace mx-auto w-full max-w-[var(--container-app)] print:!max-w-none print:!p-0 p-3 sm:p-4 lg:p-5 xl:p-6">
            {children}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
