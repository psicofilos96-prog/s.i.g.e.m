import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b border-border/70 pb-5">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase text-primary">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-semibold leading-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="hidden shrink-0 items-center gap-2 sm:flex">{actions}</div>}
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-base font-semibold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function SearchField({ placeholder = "Pesquisar..." }: { placeholder?: string }) {
  return (
    <div className="relative min-w-0">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input aria-label="Pesquisar" placeholder={placeholder} className="pl-9" />
    </div>
  );
}

export function DateField() {
  return (
    <div className="relative">
      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input aria-label="Data de referência" type="date" className="pl-9" />
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-muted/25 p-3">
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  trend,
  direction = "up",
  helper,
}: {
  label: string;
  value: string;
  trend?: string;
  direction?: "up" | "down";
  helper?: string;
}) {
  const TrendIcon = direction === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <article className="border-r border-border/70 px-4 py-3 last:border-r-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {trend && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs font-semibold",
              direction === "up" ? "text-success" : "text-warning-foreground",
            )}
          >
            <TrendIcon className="size-3.5" /> {trend}
          </span>
        )}
      </div>
      <p className="mt-2 font-display text-2xl font-semibold text-foreground tabular-nums">{value}</p>
      {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
    </article>
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "info" | "neutral";
  children: ReactNode;
}) {
  return <Badge className={cn("font-medium", `badge-${tone}`)}>{children}</Badge>;
}

export function EmptyState({
  icon: Icon = CircleHelp,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: typeof CircleHelp;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "min-h-40 p-4" : "min-h-64 p-8",
      )}
    >
      <div className="mb-3 grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatePanel({
  tone = "neutral",
  title,
  description,
  action,
}: {
  tone?: "neutral" | "danger" | "warning" | "success" | "info";
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className={cn("flex min-h-28 gap-3 rounded-md border p-4", `state-${tone}`)}>
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-card/65">
        <AlertCircle className="size-4" />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed opacity-80">{description}</p>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

export function InlineLink({ children }: { children: ReactNode }) {
  return (
    <Button variant="ghost" size="sm" className="h-7 px-2 text-primary">
      {children}
      <ChevronRight className="size-3.5" />
    </Button>
  );
}
