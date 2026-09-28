import { formatAcademicDate } from "@/lib/academic-date";
/**
 * Telas do Calendário Escolar da rede.
 * - Supervisão: elabora, revisa, homologa, duplica, arquiva.
 * - Escola/professor: consulta o calendário publicado; nenhuma edição.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DateInput } from "@/components/sigem/date-input";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CopyPlus,
  Plus,
  Trash2,
  FileText,
  Lock,
  Printer,
  ShieldCheck,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { cn } from "@/lib/utils";
import { DAY_TYPES, EDITABLE_TYPES } from "./calendar-catalog";
import { CalendarDocument, DocumentFrame, observationLines } from "./calendar-document";
import { CalendarPrintView } from "./calendar-print-view";
import { FONT_OPTIONS, TEXT_ROLES } from "./calendar-typography";
import type { CalendarTextRole, CalendarTextStyle } from "./calendar-types";
import {
  brDate,
  deriveCalendarProjection,
  dayType,
  resolveCalendar,
  WEEKDAY_NAMES,
} from "./calendar-engine";
import { calendarCapabilities, type CalendarMutation } from "./calendar-governance";
import { calendarRepository, useNetworkCalendars, useUnsavedChanges } from "./calendar-store";
import { isPublished } from "./calendar-queries";
import { demoActors } from "./calendar-fixtures";
import { actorFor, STATUS_COPY, type CalendarProfile } from "./calendar-view-copy";
export type { CalendarProfile } from "./calendar-view-copy";
import type {
  CalendarActor,
  CalendarDocumentConfig,
  CalendarRule,
  CalendarRuleKind,
  ReviewSeverity,
  CalendarStatus,
  DayTypeCode,
  NetworkCalendar,
  ReviewItem,
} from "./calendar-types";

const MODALITY = { regular: "Ensino Regular", eja: "EJA", "eja-fase-1": "EJA Fase I" } as const;

function ProfileSwitch({
  profile,
  to,
  params,
}: {
  profile: CalendarProfile;
  to: string;
  params?: Record<string, string>;
}) {
  return (
    <nav aria-label="Perfil de demonstração" className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Ver como:</span>
      {(Object.keys(demoActors) as CalendarProfile[]).map((p) => (
        <Link
          key={p}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          to={to as any}
          params={params as never}
          search={{ perfil: p } as never}
          aria-current={p === profile ? "true" : undefined}
          className={cn(
            "rounded-md border px-2.5 py-1 font-medium",
            p === profile
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-foreground hover:bg-muted",
          )}
        >
          {{ supervisao: "Supervisão", escola: "Escola", professor: "Professor" }[p]}
        </Link>
      ))}
      <span className="text-xs text-muted-foreground">
        Sem autenticação real — permissões definitivas dependem do backend.
      </span>
    </nav>
  );
}

// ------------------------------------------------------------------ Lista

export function CalendarListPage({ profile }: { profile: CalendarProfile }) {
  const actor = actorFor(profile);
  const calendars = useNetworkCalendars();
  const visible = calendars.filter((c) => calendarCapabilities(actor, c).view);
  const sup = actor.role === "supervisao";
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={sup ? "Supervisão de Ensino" : "Calendário da rede"}
        title="Calendário escolar"
        description={
          sup
            ? "Calendários centrais da rede, um por ano letivo e modalidade. Somente a Supervisão elabora e homologa."
            : "Calendário oficial publicado pela Supervisão de Ensino. As unidades apenas consultam."
        }
      />
      <ProfileSwitch profile={profile} to="/calendario-escolar" />
      {visible.length === 0 ? (
        <StatePanel
          title="Nenhum calendário publicado"
          description="A Supervisão de Ensino ainda não homologou um calendário para a rede. Quando publicado, ele aparecerá aqui para consulta."
        />
      ) : (
        <ul
          className="divide-y divide-border/70 border-y border-border/70"
          aria-label="Calendários da rede"
        >
          {visible.map((c) => {
            const proj = deriveCalendarProjection(c);
            const s = STATUS_COPY[c.status];
            return (
              <li
                key={c.id}
                className="grid min-w-0 gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold text-foreground">
                    {c.year} · {MODALITY[c.modality]}
                  </p>
                  <p className="break-words text-sm text-muted-foreground">
                    {c.title} · {proj.annualSchoolDays} dias letivos · {c.periods.length} períodos
                    {c.duplicatedFrom
                      ? ` · duplicado de ${formatAcademicDate(c.duplicatedFrom)}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to="/calendario-escolar/$calendarioId"
                      params={{ calendarioId: c.id }}
                      search={{ perfil: profile }}
                    >
                      Abrir
                    </Link>
                  </Button>
                  {calendarCapabilities(actor, c).deleteDraft ? (
                    <Button
                      size="sm"
                      variant={confirmDeleteId === c.id ? "destructive" : "outline"}
                      onClick={() => {
                        if (confirmDeleteId !== c.id) {
                          setConfirmDeleteId(c.id);
                          return;
                        }
                        calendarRepository.remove(c.id, actor);
                        setConfirmDeleteId(null);
                      }}
                    >
                      <Trash2 />{" "}
                      {confirmDeleteId === c.id ? "Confirmar exclusão" : "Excluir"}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// -------------------------------------------------------------- Workspace

function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="min-w-0 border-t border-border/70 pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

const selectCls = "h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm";
const inputCls = selectCls;

function ReviewList({ items, label }: { items: ReviewItem[]; label: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">Nenhum aviso.</p>;
  const tone = { erro: "danger", critico: "danger", atencao: "warning", info: "info" } as const;
  return (
    <ul aria-label={label} className="space-y-1.5 text-sm">
      {items.map((i, n) => (
        <li key={n} className="flex min-w-0 items-start gap-2">
          <StatusBadge tone={tone[i.severity]}>
            {{ erro: "Erro", critico: "Crítico", atencao: "Atenção", info: "Info" }[i.severity]}
          </StatusBadge>
          <span className="min-w-0 break-words">{i.message}</span>
        </li>
      ))}
    </ul>
  );
}

function DayEditor({
  cal,
  actor,
  date,
  setDate,
  onMessage,
}: {
  cal: NetworkCalendar;
  actor: CalendarActor;
  date: string;
  setDate: (d: string) => void;
  onMessage: (m: string) => void;
}) {
  const r = useMemo(() => resolveCalendar(cal), [cal]);
  const current = dayType(r, date);
  const override = cal.overrides.find((o) => o.date === date);
  const event = cal.events.find((e) => e.date === date);
  // Select reflete o tipo resolvido pelo motor para a data atual (não a seleção anterior).
  const pointType: DayTypeCode | "" =
    override?.type ?? event?.type ?? (current && current !== "VAZIO" ? current : "");
  const [type, setType] = useState<DayTypeCode | "">(pointType);
  useEffect(() => setType(pointType), [date, pointType]);
  const [end, setEnd] = useState(date);
  const [name, setName] = useState("");
  useEffect(() => setEnd(date), [date]);
  const run = (res: { ok: boolean; reason?: string }, okMsg: string) =>
    onMessage(res.ok ? okMsg : (res as { reason: string }).reason);
  const kind = type ? DAY_TYPES[type].kind : null;
  return (
    <div className="space-y-3 text-sm">
      <label className="block">
        <span className="mb-1 block font-medium">Dia selecionado</span>
        <DateInput
          className={inputCls}
          value={date}
          min={`${cal.year}-01-01`}
          max={`${cal.year}-12-31`}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
      </label>
      <p className="text-muted-foreground">
        {brDate(date)}:{" "}
        <strong className="text-foreground">
          {current ? (current === "VAZIO" ? "Dia letivo" : DAY_TYPES[current].label) : "—"}
        </strong>
        {override ? " (ajuste manual)" : ""}
        {event?.name ? ` · ${event.name}` : ""}
      </p>
      <label className="block">
        <span className="mb-1 block font-medium">Tipo</span>
        <select
          className={selectCls}
          value={type}
          onChange={(e) => setType(e.target.value as DayTypeCode | "")}
        >
          <option value="">Dia letivo</option>
          {type === "FDS" ? (
            <option value="FDS" disabled>
              Sábado / Domingo (automático)
            </option>
          ) : null}
          {EDITABLE_TYPES.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
              {t.mark ? ` (${t.mark})` : ""}
            </option>
          ))}
        </select>
        {type === "" ? (
          <span className="mt-1 block text-xs text-muted-foreground">
            Dia comum de aula, sem evento especial. Fins de semana e faixas (férias, recesso)
            continuam valendo.
          </span>
        ) : null}
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() =>
            type === ""
              ? run(
                  calendarRepository.mutate(cal.id, actor, { kind: "restaurar-dia-letivo", date }),
                  `Classificação especial de ${brDate(date)} removida.`,
                )
              : run(
                  calendarRepository.mutate(cal.id, actor, { kind: "definir-dia", date, type }),
                  `Dia ${brDate(date)} definido.`,
                )
          }
        >
          Definir o dia
        </Button>
        {override ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              run(
                calendarRepository.mutate(cal.id, actor, { kind: "definir-dia", date, type: null }),
                "Ajuste manual removido.",
              )
            }
          >
            Voltar ao automático
          </Button>
        ) : null}
      </div>
      {type && (kind === "ferias" || kind === "recesso") ? (
        <div className="grid gap-2 border-t border-border/70 pt-3">
          <label className="block">
            <span className="mb-1 block font-medium">Aplicar faixa até</span>
            <DateInput
              className={inputCls}
              value={end}
              min={date}
              max={`${cal.year}-12-31`}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              run(
                calendarRepository.mutate(cal.id, actor, {
                  kind: "aplicar-faixa",
                  type,
                  start: date,
                  end,
                }),
                "Faixa aplicada.",
              )
            }
          >
            Aplicar faixa de {DAY_TYPES[type].label.toLowerCase()}
          </Button>
        </div>
      ) : (
        <div className="grid gap-2 border-t border-border/70 pt-3">
          <label className="block">
            <span className="mb-1 block font-medium">Nome no rodapé (opcional)</span>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: TIRADENTES"
            />
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={Boolean(event) || !type}
            onClick={() =>
              type &&
              run(
                calendarRepository.mutate(cal.id, actor, {
                  kind: "adicionar-evento",
                  event: { type, date, ...(name ? { name, showInHolidays: true } : {}) },
                }),
                "Evento cadastrado.",
              )
            }
          >
            Cadastrar como evento
          </Button>
          {event ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                run(
                  calendarRepository.mutate(cal.id, actor, {
                    kind: "remover-evento",
                    id: event.id,
                  }),
                  "Evento removido.",
                )
              }
            >
              Remover evento deste dia
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

const COLS = "md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_5.5rem_auto]";

/**
 * Estrutura de períodos. Colunas: Período · Início · Término · Conselho de
 * Classe · Dias letivos. O Conselho é LIDO do dia marcado como CC no
 * calendário (fonte única) — não é campo do período. Dias são derivados.
 */
function PeriodsTable({
  cal,
  editable,
  actor,
  onMessage,
}: {
  cal: NetworkCalendar;
  editable: boolean;
  actor: CalendarActor;
  onMessage: (m: string) => void;
}) {
  const proj = useMemo(() => deriveCalendarProjection(cal), [cal]);
  const byId = new Map(proj.periods.map((x) => [x.period.id, x]));
  const blocks = proj.groups.map((g) => ({ ...g, periods: g.periods.map((x) => x.period) }));
  const ordered = [...cal.periods].sort((a, b) => a.order - b.order);
  const groups = cal.periodGroups ?? [];
  const run = (m: CalendarMutation, ok = "Estrutura atualizada.") => {
    const out = calendarRepository.mutate(cal.id, actor, m);
    onMessage(out.ok ? ok : out.reason);
  };
  return (
    <div className="min-w-0 space-y-5">
      <div
        aria-hidden
        className={cn(
          "hidden gap-3 border-b border-border/70 pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground md:grid",
          COLS,
        )}
      >
        <span>Período</span>
        <span>Início</span>
        <span>Término</span>
        <span>Conselho de Classe</span>
        <span className="text-right">Dias letivos</span>
        <span className="w-[4.5rem]">
          {editable ? <span className="sr-only">Ações</span> : null}
        </span>
      </div>
      {blocks.map((b) => (
        <div key={b.group?.id ?? "sem-grupo"} className="min-w-0">
          {b.group ? (
            <div className="mb-1.5 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              {editable ? (
                <input
                  key={b.group.name}
                  aria-label={`Nome do agrupamento ${b.group.name}`}
                  defaultValue={b.group.name}
                  className={cn(inputCls, "max-w-xs font-semibold")}
                  onBlur={(e) =>
                    e.target.value !== b.group!.name &&
                    run({ kind: "salvar-grupo", group: { id: b.group!.id, name: e.target.value } })
                  }
                />
              ) : (
                <p className="text-sm font-semibold text-foreground">{b.group.name}</p>
              )}
              {editable ? (
                <input
                  key={`tl-${b.group.totalLabel ?? ""}`}
                  aria-label={`Rótulo do total na grade — ${b.group.name}`}
                  placeholder="Rótulo da linha de total na grade"
                  defaultValue={b.group.totalLabel ?? ""}
                  className={cn(inputCls, "max-w-sm text-xs")}
                  onBlur={(e) =>
                    e.target.value !== (b.group!.totalLabel ?? "") &&
                    run({
                      kind: "salvar-grupo",
                      group: { id: b.group!.id, name: b.group!.name, totalLabel: e.target.value },
                    })
                  }
                />
              ) : (
                <p className="text-sm font-semibold text-foreground">{b.group.name}</p>
              )}
              <p className="text-xs tabular-nums text-muted-foreground">
                {b.start && b.end ? `${brDate(b.start)} a ${brDate(b.end)} · ` : ""}
                <b className="font-semibold text-foreground">{b.total}</b> dias letivos
                {editable ? (
                  <button
                    type="button"
                    className="ml-3 text-destructive underline-offset-2 hover:underline"
                    onClick={() =>
                      window.confirm(
                        `Remover o agrupamento "${b.group!.name}"? Os períodos são mantidos, sem agrupamento.`,
                      ) && run({ kind: "remover-grupo", id: b.group!.id })
                    }
                  >
                    Remover agrupamento
                  </button>
                ) : null}
                {editable ? (
                  <>
                    <button
                      type="button"
                      className="ml-3 underline-offset-2 hover:underline"
                      aria-label={`Antecipar agrupamento ${b.group.name}`}
                      onClick={() => run({ kind: "mover-grupo", id: b.group!.id, direction: -1 })}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="ml-2 underline-offset-2 hover:underline"
                      aria-label={`Adiar agrupamento ${b.group.name}`}
                      onClick={() => run({ kind: "mover-grupo", id: b.group!.id, direction: 1 })}
                    >
                      ↓
                    </button>
                  </>
                ) : null}
              </p>
            </div>
          ) : blocks.length > 1 && b.periods.length ? (
            <p className="mb-1.5 text-sm font-semibold text-muted-foreground">Sem agrupamento</p>
          ) : null}
          {b.periods.length === 0 ? (
            <p className="border-y border-border/60 py-3 text-sm text-muted-foreground">
              Nenhum período neste agrupamento.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 border-y border-border/60">
              {b.periods.map((p) => {
                const council = byId.get(p.id)?.council ?? null;
                const idx = ordered.findIndex((x) => x.id === p.id);
                return (
                  <li
                    key={p.id}
                    className={cn(
                      "grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 py-2.5 text-sm md:items-center",
                      COLS,
                    )}
                  >
                    <div className="col-span-2 min-w-0 md:col-span-1">
                      {editable ? (
                        <input
                          key={p.name}
                          aria-label={`Nome do período ${p.name}`}
                          defaultValue={p.name}
                          className={cn(inputCls, "w-full font-medium")}
                          onBlur={(e) =>
                            e.target.value !== p.name &&
                            run({ kind: "salvar-periodo", period: { ...p, name: e.target.value } })
                          }
                        />
                      ) : (
                        <span className="break-words font-medium text-foreground">{p.name}</span>
                      )}
                      {editable && groups.length ? (
                        <select
                          aria-label={`Agrupamento de ${p.name}`}
                          value={p.groupId ?? ""}
                          className={cn(selectCls, "mt-1.5 w-full text-xs")}
                          onChange={(e) =>
                            run({
                              kind: "salvar-periodo",
                              period: { ...p, groupId: e.target.value || undefined },
                            })
                          }
                        >
                          <option value="">Sem agrupamento</option>
                          {groups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                    <Cell label="Início">
                      {editable ? (
                        <DateInput
                          key={p.start}
                          aria-label={`Início de ${p.name}`}
                          className={cn(inputCls, "w-full")}
                          defaultValue={p.start}
                          onBlur={(e) =>
                            e.target.value &&
                            e.target.value !== p.start &&
                            run({ kind: "salvar-periodo", period: { ...p, start: e.target.value } })
                          }
                        />
                      ) : (
                        brDate(p.start)
                      )}
                    </Cell>
                    <Cell label="Término">
                      {editable ? (
                        <DateInput
                          key={p.end}
                          aria-label={`Término de ${p.name}`}
                          className={cn(inputCls, "w-full")}
                          defaultValue={p.end}
                          onBlur={(e) =>
                            e.target.value &&
                            e.target.value !== p.end &&
                            run({ kind: "salvar-periodo", period: { ...p, end: e.target.value } })
                          }
                        />
                      ) : (
                        brDate(p.end)
                      )}
                    </Cell>
                    <Cell label="Conselho de Classe">
                      {council ? (
                        <span title="Dia marcado como CC no calendário">{brDate(council)}</span>
                      ) : (
                        <span className="text-muted-foreground">Não marcado</span>
                      )}
                      {editable ? (
                        <input
                          key={`${p.id}-${p.councilLabel ?? ""}`}
                          aria-label={`Texto do Conselho de Classe de ${p.name}`}
                          defaultValue={p.councilLabel ?? ""}
                          placeholder={`Conselho de Classe do ${p.name}`}
                          title="Texto exibido no documento; vazio usa o rótulo derivado do nome do período"
                          className={cn(inputCls, "mt-1.5 w-full text-xs")}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v !== (p.councilLabel ?? ""))
                              run({
                                kind: "salvar-periodo",
                                period: { ...p, councilLabel: v || undefined },
                              });
                          }}
                        />
                      ) : null}
                    </Cell>
                    <Cell label="Dias letivos" className="md:text-right">
                      <span className="font-semibold tabular-nums text-foreground">
                        {byId.get(p.id)?.schoolDays ?? 0}
                      </span>
                    </Cell>
                    <div className="col-span-2 flex items-center justify-end gap-0.5 md:col-span-1 md:w-[4.5rem]">
                      {editable ? (
                        <>
                          <IconAction
                            label={`Mover ${p.name} para cima`}
                            disabled={idx === 0}
                            onClick={() => run({ kind: "mover-periodo", id: p.id, direction: -1 })}
                          >
                            <ArrowUp className="size-3.5" />
                          </IconAction>
                          <IconAction
                            label={`Mover ${p.name} para baixo`}
                            disabled={idx === ordered.length - 1}
                            onClick={() => run({ kind: "mover-periodo", id: p.id, direction: 1 })}
                          >
                            <ArrowDown className="size-3.5" />
                          </IconAction>
                          <IconAction
                            label={`Remover ${p.name}`}
                            onClick={() =>
                              window.confirm(
                                `Remover "${p.name}"? Referências da estrutura avaliativa a este período deixarão de resolver.`,
                              ) && run({ kind: "remover-periodo", id: p.id }, "Período removido.")
                            }
                          >
                            <Trash2 className="size-3.5" />
                          </IconAction>
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Dias letivos são calculados pelo calendário. A data do Conselho de Classe vem do dia marcado
        como “CC” dentro do período; altere-a no próprio calendário.
      </p>
      {editable ? <AddPeriod cal={cal} run={run} /> : null}
    </div>
  );
}

function Cell({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <span className="block text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground md:sr-only">
        {label}
      </span>
      <span className="tabular-nums">{children}</span>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-ring"
    >
      {children}
    </button>
  );
}

function AddPeriod({
  cal,
  run,
}: {
  cal: NetworkCalendar;
  run: (m: CalendarMutation, ok?: string) => void;
}) {
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [groupName, setGroupName] = useState("");
  return (
    <div className="flex min-w-0 flex-col gap-4 border-t border-border/60 pt-4 lg:flex-row lg:items-end lg:justify-between">
      <form
        className="flex min-w-0 flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || !start || !end) return;
          run(
            { kind: "adicionar-periodo", period: { name: name.trim(), start, end } },
            `Período "${name.trim()}" adicionado.`,
          );
          setName("");
          setStart("");
          setEnd("");
        }}
      >
        <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
          Novo período
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`${cal.periods.length + 1}º Período`}
            className={cn(inputCls, "w-44")}
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Início
          <DateInput
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Término
          <DateInput value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
        </label>
        <Button type="submit" size="sm" variant="outline" disabled={!name.trim() || !start || !end}>
          <Plus className="size-4" /> Adicionar período
        </Button>
      </form>
      <form
        className="flex min-w-0 flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!groupName.trim()) return;
          run({ kind: "salvar-grupo", group: { name: groupName.trim() } }, "Agrupamento criado.");
          setGroupName("");
        }}
      >
        <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
          Novo agrupamento (opcional)
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Ex.: 1º Semestre"
            className={cn(inputCls, "w-44")}
          />
        </label>
        <Button type="submit" size="sm" variant="ghost" disabled={!groupName.trim()}>
          <Plus className="size-4" /> Agrupamento
        </Button>
      </form>
    </div>
  );
}

export function CalendarWorkspacePage({
  calendarId,
  profile,
}: {
  calendarId: string;
  profile: CalendarProfile;
}) {
  const actor = actorFor(profile);
  const navigate = useNavigate();
  const calendars = useNetworkCalendars();
  const cal = calendars.find((c) => c.id === calendarId) ?? null;
  const caps = calendarCapabilities(actor, cal);
  const unsaved = useUnsavedChanges(calendarId);
  const [date, setDate] = useState<string>("");
  const [message, setMessage] = useState("");
  const [confirmCritical, setConfirmCritical] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const liveRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (cal && !date) setDate(`${cal.year}-02-01`);
  }, [cal, date]);

  const back = (
    <Button asChild variant="ghost" size="sm">
      <Link to="/calendario-escolar" search={{ perfil: profile }}>
        <ArrowLeft /> Calendários
      </Link>
    </Button>
  );
  if (!cal)
    return (
      <div className="space-y-4">
        {back}
        <StatePanel
          tone="neutral"
          title="Calendário não encontrado"
          description="Não há calendário da rede com este identificador."
        />
      </div>
    );
  if (!caps.view)
    return (
      <div className="space-y-4">
        {back}
        <ProfileSwitch
          profile={profile}
          to="/calendario-escolar/$calendarioId"
          params={{ calendarioId: cal.id }}
        />
        <StatePanel
          title="Calendário ainda não publicado"
          description={`O calendário ${cal.year} (${MODALITY[cal.modality]}) está em elaboração pela Supervisão de Ensino. As unidades passam a consultá-lo quando for homologado.`}
        />
      </div>
    );

  const proj = deriveCalendarProjection(cal);
  const issues = proj.validation;
  const s = STATUS_COPY[cal.status];
  const sup = actor.role === "supervisao";
  const published = isPublished(cal);
  const critical = issues.some((i) => i.severity === "critico");
  const act = (fn: () => { ok: boolean; reason?: string }, ok: string) => {
    const out = fn();
    setMessage(out.ok ? ok : (out as { reason: string }).reason);
  };
  const nextYear = cal.year + 1;
  const hasNext = calendars.some((c) => c.id === `cal-rede-${nextYear}-${cal.modality}`);

  return (
    <div className="space-y-5">
      {back}
      <PageHeader
        eyebrow={sup ? "Supervisão de Ensino · calendário da rede" : "Calendário oficial da rede"}
        title={`Calendário Escolar ${cal.year} — ${MODALITY[cal.modality]}`}
        description={
          sup
            ? "Um único calendário para todas as unidades desta modalidade. As escolas consultam; não editam."
            : "Publicado pela Supervisão de Ensino. Consulta apenas — a unidade não altera o calendário."
        }
      />
      <ProfileSwitch
        profile={profile}
        to="/calendario-escolar/$calendarioId"
        params={{ calendarioId: cal.id }}
      />

      <div
        role="status"
        className="grid min-w-0 gap-3 border-y border-border/70 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
      >
        <div className="flex min-w-0 items-start gap-3">
          {published ? (
            <Lock aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
          ) : (
            <FileText aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
          )}
          <div className="min-w-0 text-sm">
            <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
              <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
              {proj.annualSchoolDays} dias letivos · {cal.periods.length} períodos
            </p>
            <p className="mt-1 text-muted-foreground">
              {s.text}
              {cal.homologatedAt
                ? ` Homologado por ${cal.homologatedBy} em ${brDate(cal.homologatedAt.slice(0, 10))}.`
                : ""}
            </p>
            {cal.fixtureNote ? (
              <p className="mt-1 text-xs text-muted-foreground">{cal.fixtureNote}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {caps.edit ? (
            <>
              <Button
                size="sm"
                // Nunca desabilitado: um campo ainda em foco só confirma sua edição
                // ao perder o foco; o clique precisa acontecer para salvá-la.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  // Confirma a edição do campo em foco antes de salvar.
                  const el = document.activeElement;
                  if (el instanceof HTMLElement) el.blur();
                  if (!calendarRepository.hasUnsavedChanges(cal.id)) {
                    setMessage("Nenhuma alteração pendente: o rascunho já está salvo.");
                    return;
                  }
                  act(() => calendarRepository.save(cal.id), "Alterações do rascunho salvas.");
                }}
              >
                <Save /> {unsaved ? "Salvar alterações" : "Salvar"}
              </Button>
              {unsaved ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    act(
                      () => calendarRepository.discard(cal.id),
                      "Alterações descartadas. Rascunho voltou à última versão salva.",
                    )
                  }
                >
                  Descartar
                </Button>
              ) : null}
            </>
          ) : null}
          <Button asChild size="sm" variant="outline">
            <Link
              to="/calendario-escolar/$calendarioId/documento"
              params={{ calendarioId: cal.id }}
              search={{ perfil: profile }}
            >
              <Printer /> Documento / imprimir
            </Link>
          </Button>
          {caps.submitForReview ? (
            <Button
              size="sm"
              disabled={unsaved}
              title={unsaved ? "Salve as alterações antes de enviar" : undefined}
              onClick={() =>
                act(
                  () => calendarRepository.transition(cal.id, actor, "enviar-revisao"),
                  "Enviado para revisão. Edição bloqueada.",
                )
              }
            >
              Enviar para revisão
            </Button>
          ) : null}
          {caps.returnToDraft ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                act(
                  () => calendarRepository.transition(cal.id, actor, "devolver-rascunho"),
                  "Devolvido para rascunho.",
                )
              }
            >
              Devolver para rascunho
            </Button>
          ) : null}
          {caps.homologate ? (
            <Button
              size="sm"
              onClick={() =>
                act(
                  () =>
                    calendarRepository.transition(cal.id, actor, "homologar", { confirmCritical }),
                  "Calendário homologado e publicado. Conteúdo imutável.",
                )
              }
            >
              <ShieldCheck /> Homologar
            </Button>
          ) : null}
          {caps.archive ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                act(
                  () => calendarRepository.transition(cal.id, actor, "arquivar"),
                  "Calendário arquivado.",
                )
              }
            >
              Arquivar
            </Button>
          ) : null}
          {caps.duplicate && !hasNext ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                act(
                  () => calendarRepository.duplicate(cal.id, nextYear, actor),
                  `Rascunho ${nextYear} criado. Revise os avisos antes de homologar.`,
                )
              }
            >
              <CopyPlus /> Duplicar para {nextYear}
            </Button>
          ) : null}
          {caps.deleteDraft ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  setMessage(
                    "Confirme a exclusão: o rascunho será removido definitivamente e não poderá ser recuperado.",
                  );
                  return;
                }
                const res = calendarRepository.remove(cal.id, actor);
                if (!res.ok) {
                  setConfirmDelete(false);
                  setMessage(res.reason);
                  return;
                }
                void navigate({
                  to: "/calendario-escolar",
                  search: { perfil: profile },
                });
              }}
            >
              <Trash2 /> {confirmDelete ? "Confirmar exclusão" : "Excluir rascunho"}
            </Button>
          ) : null}
        </div>
        {caps.homologate && critical ? (
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={confirmCritical}
              onChange={(e) => setConfirmCritical(e.target.checked)}
            />
            Confirmo a homologação mesmo com avisos críticos.
          </label>
        ) : null}
        {caps.edit && unsaved ? (
          <p className="text-sm font-medium text-muted-foreground md:col-span-2" role="note">
            Há alterações não salvas neste rascunho.
          </p>
        ) : null}
        <p
          ref={liveRef}
          aria-live="polite"
          className="text-sm font-medium text-foreground md:col-span-2"
        >
          {message}
        </p>
      </div>

      <div className={cn("grid min-w-0 gap-5", caps.edit && "xl:grid-cols-[minmax(0,1fr)_18rem]")}>
        <div className="min-w-0 overflow-hidden rounded-md border border-border/70 bg-muted/30 p-2">
          <DocumentFrame>
            <CalendarDocument
              cal={cal}
              projection={proj}
              editable={caps.edit}
              selectedDate={caps.edit ? date : null}
              onSelect={setDate}
              notice={
                published ? null : (
                  <p className="cd-marca-dagua">
                    {s.label.toUpperCase()} — NÃO HOMOLOGADO · NÃO É O CALENDÁRIO OFICIAL
                  </p>
                )
              }
            />
          </DocumentFrame>
        </div>
        {caps.edit && date ? (
          <aside
            aria-label="Edição do dia"
            className="min-w-0 rounded-md border border-border/70 bg-card p-4 xl:sticky xl:top-[calc(var(--topbar-height)+1rem)] xl:self-start"
          >
            <h2 className="mb-3 font-display text-base font-semibold">Editar calendário</h2>
            <DayEditor
              cal={cal}
              actor={actor}
              date={date}
              setDate={setDate}
              onMessage={setMessage}
            />
          </aside>
        ) : null}
      </div>

      <Section
        title="Períodos letivos oficiais"
        aside={
          <span className="text-xs text-muted-foreground">
            A estrutura avaliativa referencia estes períodos por identificador.
          </span>
        }
      >
        <PeriodsTable cal={cal} editable={caps.edit} actor={actor} onMessage={setMessage} />
      </Section>

      {sup ? (
        <>
          {cal.duplicationReview?.length ? (
            <Section
              title="Revisão pós-duplicação"
              aside={
                <span className="text-xs text-muted-foreground">
                  O sistema informa; a Supervisão decide. Nada foi alterado automaticamente.
                </span>
              }
            >
              <ReviewList
                items={cal.duplicationReview}
                label="Pontos para decisão após duplicação"
              />
            </Section>
          ) : null}
          <Section
            title="Regras de validação deste calendário"
            aside={
              <span className="text-xs text-muted-foreground">
                Definidas pela Supervisão. Regra ausente não valida nada; nenhuma regra altera os
                totais calculados.
              </span>
            }
          >
            <RulesEditor cal={cal} editable={caps.edit} actor={actor} onMessage={setMessage} />
          </Section>
          <Section title="Conteúdo do documento">
            <DocumentConfigEditor
              cal={cal}
              editable={caps.edit}
              actor={actor}
              onMessage={setMessage}
            />
          </Section>
          <Section title="Validação">
            <ReviewList items={issues} label="Avisos de validação" />
          </Section>
          <Section title="Histórico de alterações">
            <ol className="space-y-1 text-sm" aria-label="Auditoria do calendário">
              {[...cal.audit].reverse().map((a, i) => (
                <li key={i} className="break-words">
                  <span className="tabular-nums text-muted-foreground">
                    {brDate(a.at.slice(0, 10))} {a.at.slice(11, 16)}
                  </span>{" "}
                  · <strong>{a.actorName}</strong> · {a.detail}
                </li>
              ))}
            </ol>
          </Section>
        </>
      ) : null}
    </div>
  );
}

// ------------------------------------------------ Regras e documento

const RULE_LABEL: Record<CalendarRuleKind, string> = {
  "minimo-anual": "Mínimo de dias letivos no ano",
  "minimo-agrupamento": "Mínimo de dias letivos no agrupamento",
  "minimo-periodo": "Mínimo de dias letivos por período",
  "minimo-ferias": "Mínimo de dias de férias",
  "conselho-por-periodo": "Todo período tem Conselho de Classe",
  "conselho-dia-semana": "Conselho de Classe em dia da semana definido",
  "feriado-local-esperado": "Feriado local esperado",
};
const SEVERITY_LABEL: Record<ReviewSeverity, string> = {
  erro: "Impeditivo",
  critico: "Crítico",
  atencao: "Atenção",
  info: "Informativo",
};

function RulesEditor({
  cal,
  editable,
  actor,
  onMessage,
}: {
  cal: NetworkCalendar;
  editable: boolean;
  actor: CalendarActor;
  onMessage: (m: string) => void;
}) {
  const [kind, setKind] = useState<CalendarRuleKind>("minimo-periodo");
  const run = (m: CalendarMutation, ok: string) => {
    const out = calendarRepository.mutate(cal.id, actor, m);
    onMessage(out.ok ? ok : out.reason);
  };
  const target = (r: CalendarRule) =>
    cal.periodGroups.find((g) => g.id === r.targetId)?.name ??
    cal.periods.find((p) => p.id === r.targetId)?.name;
  const describeRule = (r: CalendarRule) =>
    r.kind === "conselho-dia-semana"
      ? WEEKDAY_NAMES[r.value ?? 0]
      : r.kind === "feriado-local-esperado"
        ? `${r.name ?? ""} (${r.monthDay})`
        : r.kind === "conselho-por-periodo"
          ? ""
          : `${r.value} dias${target(r) ? ` · ${target(r)}` : ""}${r.basis ? ` · ${r.basis}` : ""}`;
  return (
    <div className="space-y-3">
      {cal.rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma regra configurada.</p>
      ) : (
        <ul className="divide-y divide-border/60 border-y border-border/60">
          {cal.rules.map((r) => (
            <li
              key={r.id}
              className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 break-words">
                <b className="font-semibold">{RULE_LABEL[r.kind]}</b>{" "}
                <span className="text-muted-foreground">{describeRule(r)}</span>
              </span>
              {editable && r.value !== undefined && r.kind !== "conselho-dia-semana" ? (
                <input
                  key={`${r.id}-${r.value}`}
                  type="number"
                  min={0}
                  aria-label={`Valor — ${RULE_LABEL[r.kind]}`}
                  defaultValue={r.value}
                  className={cn(inputCls, "w-20")}
                  onBlur={(e) =>
                    Number(e.target.value) !== r.value &&
                    run(
                      { kind: "salvar-regra", rule: { ...r, value: Number(e.target.value) } },
                      "Regra atualizada.",
                    )
                  }
                />
              ) : null}
              {editable ? (
                <select
                  aria-label={`Severidade — ${RULE_LABEL[r.kind]}`}
                  value={r.severity}
                  className={cn(inputCls, "w-auto")}
                  onChange={(e) =>
                    run(
                      {
                        kind: "salvar-regra",
                        rule: { ...r, severity: e.target.value as ReviewSeverity },
                      },
                      "Severidade atualizada.",
                    )
                  }
                >
                  {Object.entries(SEVERITY_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              ) : (
                <StatusBadge tone="neutral">{SEVERITY_LABEL[r.severity]}</StatusBadge>
              )}
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  disabled={!editable}
                  onChange={(e) =>
                    run(
                      { kind: "salvar-regra", rule: { ...r, enabled: e.target.checked } },
                      e.target.checked ? "Regra ativada." : "Regra desativada.",
                    )
                  }
                />
                Ativa
              </label>
              {editable ? (
                <button
                  type="button"
                  className="text-xs text-destructive underline-offset-2 hover:underline"
                  onClick={() => run({ kind: "remover-regra", id: r.id }, "Regra removida.")}
                >
                  Remover
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {editable ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Tipo de regra"
            value={kind}
            className={cn(inputCls, "w-auto")}
            onChange={(e) => setKind(e.target.value as CalendarRuleKind)}
          >
            {(
              ["minimo-periodo", "minimo-anual", "conselho-por-periodo", "minimo-ferias"] as const
            ).map((k) => (
              <option key={k} value={k}>
                {RULE_LABEL[k]}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              run(
                {
                  kind: "salvar-regra",
                  rule: {
                    kind,
                    enabled: true,
                    severity: "atencao",
                    ...(kind === "conselho-por-periodo" ? {} : { value: 0 }),
                  },
                },
                "Regra adicionada. Defina o valor.",
              )
            }
          >
            Adicionar regra
          </Button>
        </div>
      ) : null}
    </div>
  );
}

const DOC_TOGGLES: Array<[keyof Omit<CalendarDocumentConfig, "headerLines" | "typography">, string]> = [
  ["showHolidays", "Lista de feriados"],
  ["showPeriods", "Períodos"],
  ["showGroupSummaries", "Resumo por agrupamento"],
  ["showCouncils", "Conselhos de Classe"],
  ["showAnnualTotal", "Total de dias letivos"],
];

function DocumentConfigEditor({
  cal,
  editable,
  actor,
  onMessage,
}: {
  cal: NetworkCalendar;
  editable: boolean;
  actor: CalendarActor;
  onMessage: (m: string) => void;
}) {
  const run = (patch: Extract<CalendarMutation, { kind: "configurar-documento" }>["patch"]) => {
    const out = calendarRepository.mutate(cal.id, actor, { kind: "configurar-documento", patch });
    onMessage(out.ok ? "Documento atualizado." : out.reason);
  };
  return (
    <div className="grid min-w-0 gap-3 text-sm md:grid-cols-2">
      <label className="grid gap-1">
        <span className="text-xs font-semibold text-muted-foreground">Título</span>
        <input
          key={cal.title}
          defaultValue={cal.title}
          disabled={!editable}
          className={inputCls}
          onBlur={(e) => e.target.value !== cal.title && run({ title: e.target.value })}
        />
      </label>
      <InfoLinesEditor
        key={cal.observations ?? ""}
        value={cal.observations}
        editable={editable}
        onCommit={(observations) => run({ observations })}
      />
      <label className="grid gap-1 md:col-span-2">
        <span className="text-xs font-semibold text-muted-foreground">
          Assinaturas (uma por linha)
        </span>
        <textarea
          key={cal.signatures.join("|")}
          defaultValue={cal.signatures.join("\n")}
          disabled={!editable}
          rows={2}
          className={inputCls}
          onBlur={(e) => {
            const v = e.target.value
              .split("\n")
              .map((x) => x.trim())
              .filter(Boolean);
            if (v.join("|") !== cal.signatures.join("|")) run({ signatures: v });
          }}
        />
      </label>
      <fieldset className="flex flex-wrap gap-x-4 gap-y-2 md:col-span-2">
        <legend className="mb-1 text-xs font-semibold text-muted-foreground">
          Blocos exibidos no documento
        </legend>
        {DOC_TOGGLES.map(([k, label]) => (
          <label key={k} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={cal.document[k]}
              disabled={!editable}
              onChange={(e) => run({ document: { [k]: e.target.checked } })}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <TypographyEditor cal={cal} editable={editable} run={run} />
      <LegendEditor cal={cal} editable={editable} run={run} />
    </div>
  );
}

/** Informações adicionais do documento: uma linha por item, com inclusão e remoção. */
function InfoLinesEditor({
  value,
  editable,
  onCommit,
}: {
  value: string | undefined;
  editable: boolean;
  onCommit: (text: string | undefined) => void;
}) {
  const [lines, setLines] = useState<string[]>(() => observationLines(value));
  const commit = (next: string[]) => {
    const text = next.map((l) => l.trim()).filter(Boolean).join("\n") || undefined;
    if ((text ?? "") !== observationLines(value).join("\n")) onCommit(text);
  };
  return (
    <fieldset className="grid gap-1.5 md:col-span-2">
      <legend className="mb-1 text-xs font-semibold text-muted-foreground">
        Informações adicionais (aparecem no documento, abaixo dos Conselhos de Classe)
      </legend>
      {lines.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma informação adicional.</p>
      ) : null}
      {lines.map((line, i) => (
        <div key={i} className="flex min-w-0 gap-2">
          <input
            aria-label={`Informação ${i + 1}`}
            value={line}
            disabled={!editable}
            className={`${inputCls} min-w-0 flex-1`}
            onChange={(e) => setLines(lines.map((l, j) => (j === i ? e.target.value : l)))}
            onBlur={() => commit(lines)}
          />
          {editable ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={`Remover informação ${i + 1}`}
              onClick={() => {
                const next = lines.filter((_, j) => j !== i);
                setLines(next);
                commit(next);
              }}
            >
              Remover
            </Button>
          ) : null}
        </div>
      ))}
      {editable ? (
        <div>
          <Button type="button" size="sm" variant="outline" onClick={() => setLines([...lines, ""])}>
            Adicionar linha
          </Button>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        A fonte, o tamanho e o negrito destas linhas são definidos em “Formatação dos textos”,
        no item “Informações adicionais”.
      </p>
    </fieldset>
  );
}

// ------------------------------------------------------------- Impressão

export function CalendarPrintPage({
  calendarId,
  profile,
}: {
  calendarId: string;
  profile: CalendarProfile;
}) {
  const actor = actorFor(profile);
  const calendars = useNetworkCalendars();
  const cal = calendars.find((c) => c.id === calendarId) ?? null;
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Button asChild variant="ghost" size="sm">
        <Link
          to="/calendario-escolar/$calendarioId"
          params={{ calendarioId: calendarId }}
          search={{ perfil: profile }}
        >
          <ArrowLeft /> Voltar
        </Link>
      </Button>
      <Button size="sm" onClick={() => window.print()}>
        <Printer /> Imprimir / Baixar PDF
      </Button>
      <span className="text-xs text-muted-foreground">
        A4 paisagem, uma folha. Para PDF, escolha “Salvar como PDF” no destino.
      </span>
    </div>
  );
  if (!cal || !calendarCapabilities(actor, cal).view)
    return (
      <div className="space-y-4">
        {toolbar}
        <StatePanel
          title="Documento indisponível"
          description="O calendário não existe ou ainda não foi publicado pela Supervisão."
        />
      </div>
    );
  const published = isPublished(cal);
  const notice = published
    ? undefined
    : `${STATUS_COPY[cal.status].label.toUpperCase()} — NÃO HOMOLOGADO · NÃO É O CALENDÁRIO OFICIAL`;
  return (
    <div className="space-y-4">
      {toolbar}
      <DocumentFrame>
        <CalendarDocument
          cal={cal}
          notice={notice ? <p className="cd-marca-dagua">{notice}</p> : null}
        />
      </DocumentFrame>
      <CalendarPrintView cal={cal} {...(notice ? { notice } : {})} />
    </div>
  );
}

type DocRun = (patch: Extract<CalendarMutation, { kind: "configurar-documento" }>["patch"]) => void;

function TypographyEditor({ cal, editable, run }: { cal: NetworkCalendar; editable: boolean; run: DocRun }) {
  const t = cal.document.typography ?? {};
  const set = (role: CalendarTextRole, patch: Partial<CalendarTextStyle>) => {
    const merged = { ...t[role], ...patch };
    const clean = Object.fromEntries(
      Object.entries(merged).filter(([, v]) => v !== undefined && v !== ""),
    ) as CalendarTextStyle;
    const next = { ...t, [role]: clean };
    if (Object.keys(clean).length === 0) delete next[role];
    run({ document: { typography: next } });
  };
  return (
    <fieldset className="grid min-w-0 gap-2 md:col-span-2">
      <legend className="mb-1 text-xs font-semibold text-muted-foreground">
        Formatação dos textos (fonte, tamanho em pt, negrito)
      </legend>
      {TEXT_ROLES.map(({ role, label }) => {
        const s = t[role] ?? {};
        return (
          <div key={role} className="grid min-w-0 grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_10rem_5.5rem_8rem]">
            <span className="text-sm">{label}</span>
            <select
              aria-label={`Fonte — ${label}`}
              value={s.family ?? ""}
              disabled={!editable}
              className={inputCls}
              onChange={(e) => set(role, { family: e.target.value || undefined })}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <input
              key={`${role}-${s.sizePt ?? ""}`}
              aria-label={`Tamanho — ${label}`}
              type="number"
              min={4}
              max={40}
              step={0.5}
              placeholder="Padrão"
              defaultValue={s.sizePt ?? ""}
              disabled={!editable}
              className={inputCls}
              onBlur={(e) => {
                const v = e.target.value ? Number(e.target.value) : undefined;
                if (v !== s.sizePt) set(role, { sizePt: v && v >= 4 && v <= 40 ? v : undefined });
              }}
            />
            <select
              aria-label={`Negrito — ${label}`}
              value={s.bold === undefined ? "" : s.bold ? "sim" : "nao"}
              disabled={!editable}
              className={inputCls}
              onChange={(e) =>
                set(role, { bold: e.target.value === "" ? undefined : e.target.value === "sim" })
              }
            >
              <option value="">Negrito padrão</option>
              <option value="sim">Negrito</option>
              <option value="nao">Sem negrito</option>
            </select>
          </div>
        );
      })}
    </fieldset>
  );
}

function LegendEditor({ cal, editable, run }: { cal: NetworkCalendar; editable: boolean; run: DocRun }) {
  const types = Object.values(DAY_TYPES).filter((x) => x.showInLegend);
  const custom = cal.customLegend ?? [];
  const [mark, setMark] = useState("");
  const [label, setLabel] = useState("");
  const [bg, setBg] = useState("#FFFF00");
  const [fg, setFg] = useState("#000000");
  return (
    <fieldset className="grid min-w-0 gap-2 md:col-span-2">
      <legend className="mb-1 text-xs font-semibold text-muted-foreground">Legenda do documento</legend>
      <div className="flex flex-wrap gap-2">
        {types.map((x) => {
          const shown = !cal.legendHidden.includes(x.code);
          return (
            <span key={x.code} className="inline-flex items-center gap-1.5 rounded border border-border px-2 py-1">
              <span className="rounded px-1 text-xs font-bold" style={{ backgroundColor: x.background, color: x.foreground }}>
                {x.legendMark ?? x.mark}
              </span>
              <span className={shown ? "" : "text-muted-foreground line-through"}>{x.label}</span>
              {editable ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-primary underline"
                  onClick={() =>
                    run({
                      legendHidden: shown
                        ? [...cal.legendHidden, x.code]
                        : cal.legendHidden.filter((c) => c !== x.code),
                    })
                  }
                >
                  {shown ? "Excluir" : "Incluir"}
                </button>
              ) : null}
            </span>
          );
        })}
        {custom.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1.5 rounded border border-border px-2 py-1">
            <span className="rounded px-1 text-xs font-bold" style={{ backgroundColor: c.background, color: c.foreground }}>
              {c.mark}
            </span>
            <span>{c.label}</span>
            {editable ? (
              <button
                type="button"
                className="text-xs font-semibold text-destructive underline"
                onClick={() => run({ customLegend: custom.filter((x) => x.id !== c.id) })}
              >
                Excluir
              </button>
            ) : null}
          </span>
        ))}
      </div>
      {editable ? (
        <div className="grid min-w-0 grid-cols-2 items-end gap-2 sm:grid-cols-[6rem_1fr_4rem_4rem_auto]">
          <label className="grid gap-1 text-xs">Sigla<input value={mark} maxLength={4} onChange={(e) => setMark(e.target.value)} className={inputCls} /></label>
          <label className="grid gap-1 text-xs">Descrição<input value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} /></label>
          <label className="grid gap-1 text-xs">Fundo<input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-9 w-full" /></label>
          <label className="grid gap-1 text-xs">Texto<input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="h-9 w-full" /></label>
          <Button
            type="button"
            size="sm"
            disabled={!label.trim()}
            onClick={() => {
              run({
                customLegend: [
                  ...custom,
                  { id: `leg-${Date.now()}`, mark: mark.trim(), label: label.trim(), background: bg.toUpperCase(), foreground: fg.toUpperCase() },
                ],
              });
              setMark("");
              setLabel("");
            }}
          >
            Adicionar legenda
          </Button>
        </div>
      ) : null}
    </fieldset>
  );
}
