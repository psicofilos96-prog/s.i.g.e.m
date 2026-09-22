import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Clock3 } from "lucide-react";
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
  parent?: { label: string; to: "/" | "/unidades" };
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
        <div key={item.term} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[9rem_1fr]">
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
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-b border-border py-5 first:pt-0 last:border-0", className)}>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export type AuditItem = { title: string; detail: string; time: string };

export function AuditTimeline({ items }: { items: AuditItem[] }) {
  return (
    <ol className="space-y-0" aria-label="Histórico demonstrativo">
      {items.map((item, index) => (
        <li key={`${item.title}-${item.time}`} className="relative grid grid-cols-[1.25rem_1fr] gap-3 pb-4 last:pb-0">
          {index < items.length - 1 ? (
            <span className="absolute bottom-0 left-[0.59375rem] top-4 w-px bg-border" aria-hidden="true" />
          ) : null}
          <span className="relative mt-1 grid size-5 place-items-center rounded-full border border-border bg-card text-muted-foreground">
            <Clock3 className="size-3" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.detail}</p>
            <time className="mt-1 block font-mono text-[0.6875rem] text-muted-foreground">{item.time}</time>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function FutureAreaLink({ children }: { children: ReactNode }) {
  return (
    <Button variant="ghost" className="h-9 w-full justify-between px-2 text-sm font-medium" disabled>
      <span>{children}</span>
      <ChevronRight className="size-4" />
    </Button>
  );
}