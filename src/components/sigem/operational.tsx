import { formatAcademicDate } from "@/lib/academic-date";
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
  parent?: {
    label: string;
    to:
      | "/"
      | "/unidades"
      | "/matrizes-curriculares"
      | "/turmas"
      | "/alunos"
      | "/profissionais"
      | "/horarios"
      | "/horarios/turmas"
      | "/horarios/profissionais";
  };
  actions?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-1 items-end gap-4 border-b border-border/70 pb-5 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <Breadcrumb className="mb-3">
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
        <h1 className="break-words font-display text-3xl font-semibold leading-tight text-foreground">
          {title}
        </h1>
        <p className="mt-1.5 max-w-4xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {actions ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:max-w-[min(32rem,48vw)] sm:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function DefinitionList({ items }: { items: Array<{ term: string; detail: ReactNode }> }) {
  return (
    <dl className="info-list divide-y divide-border/70">
      {items.map((item) => (
        <InformationPair key={item.term} label={item.term} value={item.detail} />
      ))}
    </dl>
  );
}

export function InformationPair({
  label,
  value,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("information-pair py-3.5 first:pt-0 last:pb-0", className)}>
      <dt className="min-w-0 break-words text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 [overflow-wrap:anywhere] text-sm text-foreground">{value}</dd>
    </div>
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
    <section className={cn("border-b border-border/70 py-5 first:pt-0 last:border-0", className)}>
      <div className="section-heading mb-4 border-l-2 border-primary/45 pl-3">
        <h2 id={titleId} className="font-display text-base font-semibold text-foreground">
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
                className="absolute bottom-0 left-[0.59375rem] top-4 w-px bg-border/80"
                aria-hidden="true"
              />
            ) : null}
            <span className="relative mt-1 grid size-5 place-items-center rounded-full border border-primary/20 bg-secondary text-primary">
              <Icon className="size-3" aria-hidden="true" />
            </span>
            <div className="min-w-0 [overflow-wrap:anywhere]">
              <div className="text-sm font-medium text-foreground">{item.title}</div>
              {item.description ? (
                <div className="text-xs text-muted-foreground">{item.description}</div>
              ) : null}
              {item.meta ? <div className="text-xs text-muted-foreground">{item.meta}</div> : null}
              {item.timestamp ? (
                <time className="mt-1 block font-mono text-micro text-muted-foreground">
                  {typeof item.timestamp === "string" ? formatAcademicDate(item.timestamp) : item.timestamp}
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
      className="min-h-9 h-auto w-full justify-between px-2 py-2 text-left text-sm font-medium"
      disabled
    >
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
      <ChevronRight className="size-4" />
    </Button>
  );
}
