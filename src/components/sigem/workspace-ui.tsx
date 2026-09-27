/**
 * SIGEM Design System 2.0 — primitivas de experiência (Etapa 13UX).
 *
 * Regras desta camada:
 *  - Caixa só existe quando há agrupamento semântico real; hierarquia vem de
 *    espaço, tipografia e alinhamento antes de borda.
 *  - Composição expressiva (hero, paisagem) pertence às páginas iniciais;
 *    telas de trabalho permanecem silenciosas.
 *  - Nenhum número aqui é indicador: é resumo derivado do contexto e, quando
 *    indisponível, permanece explicitamente indisponível.
 *  - Cor nunca é o único portador de significado: ícone, rótulo e posição
 *    carregam o sentido junto.
 */
import { useId, useState, type ComponentType, type ReactNode } from "react";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  Info,
  Lock,
  OctagonAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------ escala semântica de feedback */

export type FeedbackTone =
  | "informacao"
  | "sucesso"
  | "atencao"
  | "prazo"
  | "impedimento"
  | "erro"
  | "neutro";

const TONE_META: Record<
  FeedbackTone,
  { surface: string; icon: ComponentType<{ className?: string }>; word: string }
> = {
  informacao: { surface: "tone-surface-info", icon: Info, word: "Informação" },
  sucesso: { surface: "tone-surface-success", icon: CircleCheck, word: "Concluído" },
  atencao: { surface: "tone-surface-attention", icon: AlertTriangle, word: "Atenção" },
  prazo: { surface: "tone-surface-deadline", icon: CalendarClock, word: "Prazo" },
  impedimento: { surface: "tone-surface-impediment", icon: Lock, word: "Impedimento" },
  erro: { surface: "tone-surface-error", icon: OctagonAlert, word: "Erro" },
  neutro: { surface: "tone-surface-neutral", icon: Info, word: "" },
};

/** Etiqueta curta com ícone e palavra: compreensível sem depender da cor. */
export function ToneTag({
  tone,
  children,
  icon,
}: {
  tone: FeedbackTone;
  children: ReactNode;
  icon?: LucideIcon;
}) {
  const meta = TONE_META[tone];
  const Icon = icon ?? meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        meta.surface,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="[overflow-wrap:anywhere]">{children}</span>
    </span>
  );
}

/** Aviso em linha, com a natureza escrita por extenso. */
export function FeedbackNote({
  tone,
  title,
  children,
}: {
  tone: FeedbackTone;
  title: string;
  children?: ReactNode;
}) {
  const meta = TONE_META[tone];
  const Icon = meta.icon;
  return (
    <div className={cn("flex gap-3 rounded-lg p-3.5", meta.surface)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 text-sm">
        <p className="font-semibold [overflow-wrap:anywhere]">{title}</p>
        {children ? <div className="mt-1 opacity-90">{children}</div> : null}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- hero da home */

export function WorkspaceHero({
  greeting,
  personName,
  dateLine,
  contextLine,
  imageUrl,
  children,
}: {
  greeting: string;
  personName: string;
  dateLine: string;
  contextLine: string;
  imageUrl?: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-2xl bg-institutional text-hero-foreground shadow-panel print:hidden">
      {imageUrl ? (
        <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
      ) : null}
      <div className="home-hero-mask absolute inset-0" />
      <div className="relative px-6 py-7 sm:px-8 sm:py-9">
        <p className="text-xs font-semibold uppercase tracking-wide text-hero-muted">
          {contextLine}
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
          {greeting}, {personName}!
        </h1>
        <p className="mt-1.5 text-sm text-hero-muted">{dateLine}</p>
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
    </section>
  );
}

/* --------------------------------------------------- resumos operacionais (4) */

export type OperationalSummaryItem = {
  key: string;
  label: string;
  /** Número derivado do contexto; `null` significa indisponível de verdade. */
  value: number | null;
  helper: string;
  icon: LucideIcon;
  tone?: FeedbackTone | undefined;
  unavailableReason?: string | undefined;
};

export function OperationalSummaryStrip({ items }: { items: readonly OperationalSummaryItem[] }) {
  const available = items.filter((item) => item.value !== null);
  const unavailable = items.filter((item) => item.value === null);
  return (
    <section aria-label="Resumo do que está em suas mãos hoje" className="calm-stack gap-2">
      <ul className="grid gap-3 sm:grid-cols-3">
        {available.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key} className="surface-panel flex items-center gap-3 px-4 py-3">
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-xl",
                  TONE_META[item.tone ?? "neutro"].surface,
                )}
              >
                <Icon className="size-4.5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="ux-number text-2xl leading-tight text-foreground">{item.value}</p>
                <p className="text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
                  {item.label}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {unavailable.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1">
          {unavailable.map((item) => (
            <li key={item.key} className="min-w-0 text-xs text-muted-foreground">
              <span className="font-semibold">{item.label}:</span> indisponível —{" "}
              <span>
                {item.unavailableReason ?? "nenhuma fonte autorizada informou este número."}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}


/* --------------------------------------------------------- caixa de trabalho */

export function WorkTabs({
  tabs,
  activeId,
  onSelect,
}: {
  tabs: ReadonlyArray<{ id: string; label: string; count: number }>;
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div role="tablist" aria-label="Filtros da caixa de trabalho" className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onSelect(tab.id)}
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors",
              active
                ? "bg-institutional text-institutional-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <span>{tab.label}</span>
            <span
              className={cn(
                "rounded-full px-1.5 text-xs font-semibold",
                active ? "bg-institutional-foreground/20" : "bg-card text-foreground",
              )}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Uma linha de trabalho: assunto, quem se aguarda, prazo e ação principal. */
export function WorkRow({
  categoryLabel,
  categoryIcon,
  title,
  personLine,
  statusLine,
  deadlineSlot,
  primaryAction,
  secondarySlot,
  detailsSlot,
}: {
  categoryLabel: string;
  categoryIcon: LucideIcon;
  title: string;
  personLine?: string | undefined;
  statusLine: string;
  deadlineSlot?: ReactNode | undefined;
  primaryAction?: ReactNode | undefined;
  secondarySlot?: ReactNode | undefined;
  detailsSlot?: ReactNode | undefined;
}) {
  const Icon = categoryIcon;
  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-3 border-b border-border/60 py-4 last:border-b-0">
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl tone-surface-neutral">
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      <div className="min-w-[12rem] flex-1 basis-64">
        <p className="text-[0.9375rem] font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">
          <span className="text-muted-foreground">{categoryLabel} · </span>
          {title}
        </p>
        {personLine ? (
          <p className="mt-0.5 text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {personLine}
          </p>
        ) : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
          <span className="[overflow-wrap:anywhere]">{statusLine}</span>
          {deadlineSlot}
        </div>
        {secondarySlot ? <div className="mt-2.5">{secondarySlot}</div> : null}
        {detailsSlot ? <div className="mt-1.5">{detailsSlot}</div> : null}
      </div>
      {primaryAction ? (
        <div className="flex w-full items-center sm:w-auto sm:self-center">{primaryAction}</div>
      ) : null}
    </li>
  );
}


/* ----------------------------------------- ação: disponível, bloqueada ou não */

/**
 * Apresenta uma ação em linguagem humana. A explicação institucional completa
 * fica atrás de "Por que não posso fazer isso?" — simplificar não é esconder.
 */
export function ActionDisclosure({
  label,
  available,
  reason,
  details,
  onAct,
}: {
  label: string;
  available: boolean;
  /** Frase curta e humana: por que não é possível agora. */
  reason?: string | undefined;
  /** Diagnóstico institucional completo, sob demanda. */
  details?: ReactNode | undefined;
  onAct?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (available) {
    return (
      <Button size="sm" className="min-h-10 w-full justify-center sm:w-auto" onClick={onAct}>
        {label}
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
    );
  }
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-muted/60 px-3 text-sm font-medium text-muted-foreground">
          <Lock className="size-3.5" aria-hidden="true" />
          {label}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-10 px-2 text-xs"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <CircleHelp className="size-3.5" aria-hidden="true" />
          Por que não posso fazer isso?
        </Button>
      </div>
      {open ? (
        <div id={panelId} className="mt-2 rounded-lg tone-surface-impediment p-3 text-sm">
          <p className="[overflow-wrap:anywhere]">
            {reason ?? "Esta etapa não está liberada para você neste momento."}
          </p>
          {details ? (
            <div className="mt-2 border-t border-current/15 pt-2 text-xs opacity-90">{details}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------- colunas e seções calmas */

/** Seção de página sem caixa: título, apoio e conteúdo, separados por espaço. */
export function QuietSection({
  title,
  support,
  action,
  children,
}: {
  title: string;
  support?: string | undefined;
  action?: ReactNode | undefined;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
          {support ? (
            <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">{support}</p>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/**
 * Coluna de apoio — NÃO é estrutural. Só aparece onde há espaço e utilidade;
 * telas de trabalho intensivo usam a largura inteira.
 */
export function SideRail({ children }: { children: ReactNode }) {
  return (
    <aside className="calm-stack min-w-0 gap-4 self-start xl:sticky xl:top-24">{children}</aside>
  );

}

export function RailCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: LucideIcon | undefined;
  children: ReactNode;
}) {
  const Icon = icon;
  return (
    <section className="surface-panel p-4">
      <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
        {Icon ? <Icon className="size-4 text-muted-foreground" aria-hidden="true" /> : null}
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function QuickActionGrid({
  actions,
}: {
  actions: ReadonlyArray<{ key: string; label: string; icon: LucideIcon; render: (content: ReactNode) => ReactNode }>;
}) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {actions.map((action) => {
        const Icon = action.icon;
        const content = (
          <span className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-accent/40">
            <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0">{action.label}</span>
          </span>
        );
        return <li key={action.key}>{action.render(content)}</li>;
      })}
    </ul>
  );
}

/** Lista simples de pares rótulo/valor, sem caixa por item. */
export function PlainFacts({
  items,
}: {
  items: ReadonlyArray<{ term: string; detail: ReactNode }>;
}) {
  return (
    <dl className="calm-stack gap-2">
      {items.map((item) => (
        <div key={item.term} className="min-w-0">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {item.term}
          </dt>
          <dd className="text-sm text-foreground [overflow-wrap:anywhere]">{item.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Detalhes institucionais sob demanda: proveniência, versão, política. */
export function InstitutionalDetails({
  summary = "Ver detalhes institucionais",
  children,
}: {
  summary?: string;
  children: ReactNode;
}) {
  return (
    <details className="group">
      <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden="true" />
        {summary}
      </summary>
      <div className="mt-2 border-l-2 border-border pl-3 text-xs text-muted-foreground">
        {children}
      </div>
    </details>
  );
}
