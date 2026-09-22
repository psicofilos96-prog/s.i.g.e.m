import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Clock3, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export function OperationalPageHeader({
  title,
  description,
  parent,
  actions,
}: {
  title: string;
  description: string;
  parent?: { label: string; to: "/" | "/unidades" | "/matrizes-curriculares" };
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <Breadcrumb className="mb-2">
          <BreadcrumbList className="text-xs">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Início</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            {parent ? (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to={parent.to}>{parent.label}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            ) : null}
            <BreadcrumbItem>
              <BreadcrumbPage>{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="truncate text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function DefinitionList({ items }: { items: Array<{ term: string; detail: ReactNode }> }) {
  return (
    <dl className="divide-y divide-border">
      {items.map((item) => (
        <div
          key={item.term}
          className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[9rem_1fr]"
        >
          <dt className="text-xs font-medium text-muted-foreground">{item.term}</dt>
          <dd className="min-w-0 text-sm text-foreground">{item.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DetailSection({
  title,
  description,
  children,
  className,
  titleId,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Permite associar o título a um contêiner externo via aria-labelledby. */
  titleId?: string;
}) {
  return (
    <section className={cn("border-b border-border py-5 first:pt-0 last:border-0", className)}>
      <div className="mb-4">
        <h2 id={titleId} className="text-sm font-semibold text-foreground">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * AuditTimeline — padrão visual/estrutural genérico.
 *
 * Não assume tipos fixos de evento, atores obrigatórios nem o formato
 * definitivo de auditoria do backend. Todo conteúdo é fornecido pelo
 * consumidor; apenas `title` é obrigatório.
 */
export type AuditTimelineItem = {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Ator, origem ou qualquer metadado opcional. */
  meta?: ReactNode;
  timestamp?: ReactNode;
  icon?: LucideIcon;
};

export function AuditTimeline({
  items,
  label = "Histórico",
  icon: DefaultIcon = Clock3,
  emptyMessage = "Nenhum registro disponível.",
}: {
  items: AuditTimelineItem[];
  label?: string;
  icon?: LucideIcon;
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <ol className="space-y-0" aria-label={label}>
      {items.map((item, index) => {
        const Icon = item.icon ?? DefaultIcon;
        return (
          <li
            key={item.id ?? index}
            className="relative grid grid-cols-[1.25rem_1fr] gap-3 pb-4 last:pb-0"
          >
            {index < items.length - 1 ? (
              <span
                className="absolute bottom-0 left-[0.59375rem] top-4 w-px bg-border"
                aria-hidden="true"
              />
            ) : null}
            <span className="relative mt-1 grid size-5 place-items-center rounded-full border border-border bg-card text-muted-foreground">
              <Icon className="size-3" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              {item.description ? (
                <p className="text-xs text-muted-foreground">{item.description}</p>
              ) : null}
              {item.meta ? <p className="text-xs text-muted-foreground">{item.meta}</p> : null}
              {item.timestamp ? (
                <time className="mt-1 block font-mono text-[0.6875rem] text-muted-foreground">
                  {item.timestamp}
                </time>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function FutureAreaLink({ children }: { children: ReactNode }) {
  return (
    <Button
      variant="ghost"
      className="h-9 w-full justify-between px-2 text-sm font-medium"
      disabled
    >
      <span>{children}</span>
      <ChevronRight className="size-4" />
    </Button>
  );
}
