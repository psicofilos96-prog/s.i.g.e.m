import { confirmAction } from "@/components/sigem/confirm-action";
import { FactValue } from "@/components/sigem/states";
import { useCalendarRepository, useCentralMode, useSupervisionMode } from "./calendar-supervision-context";
import { centralEntryOf, loadCentral, useCentralState } from "./calendar-central-state";
import { alignPeriodKeys, mirrorTargets } from "./calendar-mirror";
import { CalendarApplicabilityPanel } from "./calendar-applicability-panel";
import { centralErrorText, homologateCentralCalendar, saveCentralCalendar, type CentralEntry } from "./calendar-central";
import { formatAcademicDate, civilDateOf } from "@/lib/academic-date";
import { useSessionUser } from "@/features/authority/session-authority";
import { CalendarPresentationAccess } from "./institutional-calendar-management";
/**
 * Telas do Calendário Escolar da rede.
 * - Supervisão: elabora, revisa, homologa, duplica, arquiva.
 * - Escola/professor: consulta o calendário publicado; nenhuma edição.
 */
import { DayMark } from "./calendar-mark";
import { SymbologyEditor } from "./calendar-symbology-editor";
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
import { DAY_TYPES as DT, EDITABLE_TYPES, typeInfo, dayTypesOf } from "./calendar-catalog";
const DAY_TYPES = new Proxy(DT, { get: (t, k: string) => typeInfo(t, k) }) as Record<string, import("./calendar-types").DayTypeInfo>;
import { CalendarDocument, DocumentFrame, observationLines } from "./calendar-document";
import { DEFAULT_INFO_PLACE, INFO_PLACES, parseInfoLine, serializeInfoLine, type InfoLine, type InfoPlace } from "./calendar-info-lines";
import { CalendarPrintView } from "./calendar-print-view";
import { CalendarAppearanceEditor } from "./calendar-layout-editor";
import { A4OverflowNotice } from "./calendar-a4-notice";
import {
  brDate,
  deriveCalendarProjection,
  dayType,
  resolveCalendar,
  WEEKDAY_NAMES,
} from "./calendar-engine";
import { calendarCapabilities, type CalendarMutation } from "./calendar-governance";
import { useNetworkCalendars, useProvenance, useStorageState, useUnsavedChanges, type CalendarProvenance } from "./calendar-store";

/** Estado real do calendário da Supervisão (banco quando houver; senão a origem local). Nunca afirma publicação falsa. */
const provenanceLabel = (p: CalendarProvenance | null, entry: CentralEntry | null = null) => {
  if (entry) {
    const l = entry.latest;
    if (l.lastHomologation?.decision === "homologada") return `Homologado · versão ${l.version}`;
    if (entry.homologated) return `Versão ${l.version} salva · versão ${entry.homologated.version} homologada em vigor`;
    return `Salvo no banco · versão ${l.version} · não homologado`;
  }
  return p === "fonte-projeto" ? "Calendário 2027 do projeto · ainda não salvo no banco" : "Salvo neste navegador · ainda não salvo no banco";
};
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
  const supervision = useSupervisionMode();
  const consulting = useCentralMode();
  if (!supervision && consulting)
    return <p role="status" className="text-sm text-muted-foreground">Calendários homologados da rede · somente consulta</p>;
  if (supervision)
    return (
      <p role="status" data-sigem-build="b4.6.10-fonte-2027" className="text-sm font-medium text-foreground">
        Supervisão Escolar{supervision.displayName && supervision.displayName !== "Supervisão Escolar" ? ` · ${supervision.displayName}` : ""}
      </p>
    );
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
  const repo = useCalendarRepository();
  const actor = actorFor(profile);
  const calendars = useNetworkCalendars(repo);
  const visible = calendars.filter((c) => calendarCapabilities(actor, c).view);
  const sup = actor.role === "supervisao";
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const supervision = useSupervisionMode();
  const storage = useStorageState(repo);
  const central = useCentralState(repo, useCentralMode());
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
      {central?.status === "lendo" ? (
        <p role="status" className="text-sm text-muted-foreground">Lendo o calendário salvo no banco…</p>
      ) : central?.status === "erro" ? (
        <StatePanel tone="danger" title="O calendário do banco não pôde ser lido" description={`${central.message} Nada foi substituído; recarregue a página para tentar de novo.`} />
      ) : null}
      {!supervision && central?.status !== "lido" ? null : supervision && storage === null ? (
        <p role="status" className="text-sm text-muted-foreground">Lendo o calendário salvo neste navegador…</p>
      ) : supervision && storage?.state === "ilegivel" ? (
        <StatePanel
          tone="danger"
          title="O calendário salvo neste navegador não pôde ser lido"
          description={`Motivo: ${storage.reason}. O registro foi preservado sem alteração e nada será gravado sobre ele.`}
          action={
            repo.openProjectSource && calendars.length === 0 ? (
              <Button size="sm" variant="outline" onClick={() => repo.openProjectSource?.()}>
                Abrir o calendário 2027 do projeto (sem gravar)
              </Button>
            ) : undefined
          }
        />
      ) : null}
      {(supervision && storage?.state === "ilegivel" && calendars.length === 0) || (central && central.status !== "lido") ? null : visible.length === 0 ? (
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
            const s = supervision
              ? { tone: "neutral" as const, label: provenanceLabel(repo.provenance?.(c.id) ?? null, central ? centralEntryOf(central, c.id) : null) }
              : STATUS_COPY[c.status];
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
                  {calendarCapabilities(actor, c).deleteDraft && (!supervision || repo.provenance?.(c.id) !== "central") ? (
                    <Button
                      size="sm"
                      variant={confirmDeleteId === c.id ? "destructive" : "outline"}
                      onClick={() => {
                        if (confirmDeleteId !== c.id) {
                          setConfirmDeleteId(c.id);
                          return;
                        }
                        repo.remove(c.id, actor);
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
  const repo = useCalendarRepository();
  const r = useMemo(() => resolveCalendar(cal), [cal]);
  const current = dayType(r, date);
  const override = cal.overrides.find((o) => o.date === date);
  const event = cal.events.find((e) => e.date === date);
  // Select reflete o tipo resolvido pelo motor para a data atual (não a seleção anterior).
  const rawPoint = override?.type ?? event?.type ?? current;
  const pointType: DayTypeCode | "" = rawPoint && rawPoint !== "VAZIO" ? rawPoint : "";
  const [type, setType] = useState<DayTypeCode | "">(pointType);
  useEffect(() => setType(pointType), [date, pointType]);
  const [end, setEnd] = useState(date);
  const [name, setName] = useState("");
  useEffect(() => setEnd(date), [date]);
  const run = (res: { ok: boolean; reason?: string }, okMsg: string) =>
    onMessage(res.ok ? okMsg : (res as { reason: string }).reason);
  const kind = type ? DAY_TYPES[type]!.kind : null;
  const selectableTypes = useMemo(
    () =>
      Object.values(dayTypesOf(cal))
        .filter((t) => t.kind !== "automatico" && t.active !== false)
        .sort((a, b) => a.label.localeCompare(b.label)),
    [cal],
  );
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
          {current ? (current === "VAZIO" ? "Dia letivo" : DAY_TYPES[current]!.label) : "—"}
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
          {type === "FDS" || isWeekend(date) ? (
            <option value="FDS">
              {weekday(date) === 6 ? "Sábado (S)" : weekday(date) === 0 ? "Domingo (D)" : "Sábado / Domingo"}
            </option>
          ) : null}
          {selectableTypes.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
              {t.mark ? ` (${t.mark})` : ""}
            </option>
          ))}
        </select>
        {type === "" ? (
          <span className="mt-1 block text-xs text-muted-foreground">
            Dia comum de aula. Vale para qualquer data, mesmo dentro de férias, recesso, feriado ou fim de semana.
          </span>
        ) : null}
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() =>
            type === ""
              ? run(
                  repo.mutate(cal.id, actor, { kind: "restaurar-dia-letivo", date }),
                  `${brDate(date)} agora é dia letivo.`,
                )
              : event
                ? run(
                    repo.mutate(cal.id, actor, { kind: "editar-evento", id: event.id, type, ...(name ? { name } : {}) }),
                    `Dia ${brDate(date)} alterado.`,
                  )
                : run(
                    repo.mutate(cal.id, actor, { kind: "definir-dia", date, type }),
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
                repo.mutate(cal.id, actor, { kind: "definir-dia", date, type: null }),
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
                repo.mutate(cal.id, actor, {
                  kind: "aplicar-faixa",
                  type,
                  start: date,
                  end,
                }),
                "Faixa aplicada.",
              )
            }
          >
            Aplicar faixa de {DAY_TYPES[type]!.label.toLowerCase()}
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
                repo.mutate(cal.id, actor, {
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
                  repo.mutate(cal.id, actor, {
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
  const repo = useCalendarRepository();
  const proj = useMemo(() => deriveCalendarProjection(cal), [cal]);
  const byId = new Map(proj.periods.map((x) => [x.period.id, x]));
  const blocks = proj.groups.map((g) => ({ ...g, periods: g.periods.map((x) => x.period) }));
  const ordered = [...cal.periods].sort((a, b) => a.order - b.order);
  const groups = cal.periodGroups ?? [];
  const run = (m: CalendarMutation, ok = "Estrutura atualizada.") => {
    const out = repo.mutate(cal.id, actor, m);
    onMessage(out.ok ? ok : out.reason);
  };
  return (
    <div className="min-w-0 space-y-5">
      <div
        aria-hidden
        className={cn(
          "hidden gap-3 border-b border-border/70 pb-1.5 text-micro font-semibold uppercase tracking-wide text-muted-foreground md:grid",
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
                  key={b.group!.name}
                  aria-label={`Nome do agrupamento ${b.group!.name}`}
                  defaultValue={b.group!.name}
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
                {b.start && b.end ? `${brDate(b.start!)} a ${brDate(b.end!)} · ` : ""}
                <b className="font-semibold text-foreground">{b.total}</b> dias letivos
                {editable ? (
                  <button
                    type="button"
                    className="ml-3 text-destructive underline-offset-2 hover:underline"
                    onClick={async () =>
                      (await confirmAction({ title: `Remover o agrupamento "${b.group!.name}"?`, consequence: "Os períodos são mantidos, sem agrupamento.", actionLabel: "Remover", destructive: true })) && run({ kind: "remover-grupo", id: b.group!.id })
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
                        <FactValue value={byId.get(p.id)?.schoolDays} absentLabel="Não calculado" />
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
                            onClick={async () =>
                              (await confirmAction({ title: `Remover "${p.name}"?`, consequence: "Referências da estrutura avaliativa a este período deixarão de resolver.", actionLabel: "Remover", destructive: true })) && run({ kind: "remover-periodo", id: p.id }, "Período removido.")
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
      <span className="block text-micro font-semibold uppercase tracking-wide text-muted-foreground md:sr-only">
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
  const repo = useCalendarRepository();
  const actor = actorFor(profile);
  const navigate = useNavigate();
  const calendars = useNetworkCalendars(repo);
  const cal = calendars.find((c) => c.id === calendarId) ?? null;
  const supervision = useSupervisionMode();
  const baseCaps = calendarCapabilities(actor, cal);
  // Supervisão autenticada: revisar/homologar/arquivar locais simulariam publicação ⇒ desativados.
  // A publicação na rede é feita só pela sincronização institucional (versão no banco + homologação).
  const caps = supervision
    ? { ...baseCaps, submitForReview: false, returnToDraft: false, homologate: false, archive: false,
        deleteDraft: baseCaps.deleteDraft && repo.provenance?.(calendarId) !== "central" }
    : baseCaps;
  const unsaved = useUnsavedChanges(calendarId, repo);
  const provenance = useProvenance(calendarId, repo);
  const central = useCentralState(repo, useCentralMode());
  const entry = central ? centralEntryOf(central, calendarId) : null;
  const sessionUser = useSessionUser();
  const [busy, setBusy] = useState(false);
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
  if (!cal && central && central.status !== "lido")
    return (
      <div className="space-y-4">
        {back}
        {central.status === "lendo" ? (
          <p role="status" className="text-sm text-muted-foreground">Lendo o calendário salvo no banco…</p>
        ) : (
          <StatePanel tone="danger" title="O calendário do banco não pôde ser lido" description={`${central.message} Recarregue a página para tentar de novo.`} />
        )}
      </div>
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
  const s = supervision
    ? {
        tone: "neutral" as const,
        label: provenanceLabel(provenance, entry),
        text: entry?.latest.lastHomologation?.decision === "homologada"
          ? "Calendário oficial da rede: as demais contas consultam esta versão. Alterar e salvar cria nova versão, que só vale depois de homologada."
          : entry
            ? "Salvo no banco; ainda não é o calendário oficial até ser homologado."
            : provenance === "fonte-projeto"
              ? "Calendário registrado no projeto. Salve para guardá-lo no banco."
              : "Salve para guardá-lo no banco.",
      }
    : STATUS_COPY[cal.status];
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

      {central?.status === "lendo" && <p role="status">Lendo o calendário salvo no banco…</p>}
      {central?.status === "erro" && <StatePanel tone="danger" title="O calendário do banco não pôde ser lido" description={`${central.message} A edição na tela foi preservada. Salvar e homologar ficam bloqueados até a leitura ser restabelecida.`} />}

      <div
        role="status"
        className={cn(
          "grid min-w-0 gap-3 border-y border-border/70 py-3",
          supervision ? "" : "md:grid-cols-[minmax(0,1fr)_auto] md:items-center",
        )}
        style={supervision ? { display: "flex", flexDirection: "column" } : undefined}
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
                ? ` Homologado por ${cal.homologatedBy} em ${brDate(civilDateOf(cal.homologatedAt))}.`
                : ""}
            </p>
            {cal.fixtureNote && !supervision ? (
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
                disabled={busy || (!!supervision && central?.status !== "lido")}
                title={supervision && central?.status === "erro" ? "O banco não pôde ser lido; recarregue antes de salvar" : undefined}
                onClick={() => {
                  // Confirma a edição do campo em foco antes de salvar.
                  const el = document.activeElement;
                  if (el instanceof HTMLElement) el.blur();
                  if (supervision) {
                    if (entry && !repo.hasUnsavedChanges(cal.id)) {
                      setMessage("Nenhuma alteração pendente: esta versão já está salva no banco.");
                      return;
                    }
                    const current = repo.get(cal.id)!;
                    setBusy(true);
                    setMessage("Salvando no banco…");
                    void saveCentralCalendar({
                      cal: alignPeriodKeys(current, entry?.calendar), sourceKey: cal.id, expectedBaseVersionId: entry?.latest.versionId ?? null,
                      sourceKind: entry || provenance === "fonte-projeto" ? "edicao-institucional" : "importacao-navegador",
                      reason: entry ? "Alteração salva no editor do calendário" : provenance === "fonte-projeto" ? "Calendário 2027 registrado no projeto, reconhecido pelo usuário como calendário real" : null,
                    }).then(async (r) => {
                      repo.commitCentral?.(cal.id, current);
                      // Espelho (Regular → EJA Fase I): o calendário espelhado também é salvo no banco.
                      const mirrored: string[] = [];
                      for (const t of mirrorTargets(current, repo.list())) {
                        if (!repo.hasUnsavedChanges(t.id)) continue;
                        const tCur = repo.get(t.id)!;
                        const tEntry = central ? centralEntryOf(central, t.id) : null;
                        try {
                          const tr = await saveCentralCalendar({
                            cal: alignPeriodKeys(tCur, tEntry?.calendar), sourceKey: t.id, expectedBaseVersionId: tEntry?.latest.versionId ?? null,
                            sourceKind: "edicao-institucional", reason: "Alteração espelhada do calendário Regular",
                          });
                          repo.commitCentral?.(t.id, tCur);
                          mirrored.push(`${tCur.title} · versão ${tr.version}`);
                        } catch (e) {
                          mirrored.push(`${tCur.title}: não foi salvo (${centralErrorText(e)})`);
                        }
                      }
                      await loadCentral(repo);
                      setMessage(`Salvo no banco · versão ${r.version}.${entry?.homologated ? " A versão homologada continua em vigor até você homologar esta." : " Ainda não homologado."}${mirrored.length ? ` Também salvo: ${mirrored.join("; ")}.` : ""}`);
                    }, (e: unknown) => {
                      setMessage(`Não foi salvo no banco: ${centralErrorText(e)} Suas alterações continuam na tela.`);
                    }).finally(() => setBusy(false));
                    return;
                  }
                  if (!repo.hasUnsavedChanges(cal.id) && provenance !== "fonte-projeto") {
                    setMessage("Nenhuma alteração pendente: o rascunho já está salvo.");
                    return;
                  }
                  act(
                    () => repo.save(cal.id),
                    supervision
                      ? "Salvo neste navegador. Ainda não publicado na rede."
                      : "Alterações do rascunho salvas.",
                  );
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
                      () => repo.discard(cal.id),
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
          {supervision && caps.edit ? (
            <Button
              size="sm"
              variant="outline"
              data-sigem-build="b4.6.10-homologar-central"
              disabled={busy || unsaved || central?.status !== "lido" || !entry || entry.latest.lastHomologation?.decision === "homologada"}
              title={unsaved ? "Salve as alterações antes de homologar" : !entry ? "Salve no banco antes de homologar" : entry.latest.lastHomologation?.decision === "homologada" ? "Esta versão já está homologada. Altere e salve para homologar uma nova versão." : undefined}
              onClick={() => {
                if (!entry) return;
                if (critical && !confirmCritical) {
                  setMessage("Há avisos críticos. Marque a confirmação abaixo para homologar mesmo assim.");
                  return;
                }
                setBusy(true);
                setMessage("Homologando…");
                void homologateCentralCalendar({ versionId: entry.latest.versionId, expectedLastHomologationId: entry.latest.lastHomologation?.recordId ?? null })
                  .then(async () => {
                    await loadCentral(repo);
                    setMessage(`Homologado: a versão ${entry.latest.version} é o calendário oficial da rede e já pode ser consultada pelas demais contas.`);
                  }, (e: unknown) => setMessage(`Não foi homologado: ${centralErrorText(e)}`))
                  .finally(() => setBusy(false));
              }}
            >
              <ShieldCheck /> Homologar e publicar na rede
            </Button>
          ) : null}
          {caps.submitForReview ? (
            <Button
              size="sm"
              disabled={unsaved}
              title={unsaved ? "Salve as alterações antes de enviar" : undefined}
              onClick={() =>
                act(
                  () => repo.transition(cal.id, actor, "enviar-revisao"),
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
                  () => repo.transition(cal.id, actor, "devolver-rascunho"),
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
                    repo.transition(cal.id, actor, "homologar", { confirmCritical }),
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
                  () => repo.transition(cal.id, actor, "arquivar"),
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
                  () => repo.duplicate(cal.id, nextYear, actor),
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
                const res = repo.remove(cal.id, actor);
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
        {(caps.homologate || (supervision && caps.edit)) && critical ? (
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
        {entry && sessionUser.user ? (
          <details className="text-sm md:col-span-2" data-testid="apresentacao-impressao">
            <summary className="cursor-pointer font-medium">Apresentação e impressão (Interno · Panorâmico · Mosaico)</summary>
            <div className="mt-3">
              <CalendarPresentationAccess contextKey={`${sessionUser.user.id}#${sessionUser.revision}`} institutionalCalendarId={entry.calendarId}
                preferredVersionId={entry.homologated?.versionId ?? entry.latest.versionId} canEdit={!!supervision} />
            </div>
          </details>
        ) : null}
        {supervision && entry ? (
          <details className="text-sm md:col-span-2">
            <summary className="cursor-pointer text-muted-foreground">Histórico de versões ({entry.history.length})</summary>
            <ol className="mt-2 space-y-1 text-muted-foreground">
              {[...entry.history].reverse().map((v) => (
                <li key={v.versionId}>
                  Versão {v.version} · salva em {brDate(civilDateOf(v.recordedAt))}
                  {v.lastHomologation ? ` · ${v.lastHomologation.decision === "homologada" ? "homologada" : "revogada"} a partir de ${brDate(v.lastHomologation.effectiveFrom)}` : " · não homologada"}
                </li>
              ))}
            </ol>
            <div className="mt-3">
              <CalendarApplicabilityPanel entry={entry} cal={cal} unsaved={unsaved} onSaved={async (m) => { await loadCentral(repo); setMessage(m); }} />
            </div>
          </details>
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
                    {STATUS_COPY[cal.status].label.toUpperCase()} — NÃO HOMOLOGADO · NÃO É O CALENDÁRIO OFICIAL
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
          <Section
            title="Tipos de dia e eventos"
            aside={
              <span className="text-xs text-muted-foreground">
                Tipos criados aparecem automaticamente na lista usada para classificar o dia.
              </span>
            }
          >
            <DayTypeManager cal={cal} actor={actor} onMessage={setMessage} />
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
      {/* Ctrl+P nesta tela usa o MESMO renderizador oficial do documento. */}
      <CalendarPrintView
        cal={cal}
        {...(isPublished(cal)
          ? {}
          : { notice: `${STATUS_COPY[cal.status].label.toUpperCase()} — NÃO HOMOLOGADO · NÃO É O CALENDÁRIO OFICIAL` })}
      />
    </div>
  );
}

function DayTypeManager({
  cal,
  actor,
  onMessage,
}: {
  cal: NetworkCalendar;
  actor: CalendarActor;
  onMessage: (m: string) => void;
}) {
  const repo = useCalendarRepository();
  const types = dayTypesOf(cal);
  const custom = Object.values(types).filter((t) => !t.native);
  const [label, setLabel] = useState("");
  const [mark, setMark] = useState("");
  const [kind, setKind] = useState<string>("evento");
  const [countsAsSchoolDay, setCountsAsSchoolDay] = useState(false);
  const [background, setBackground] = useState("#FFFFFF");
  const [foreground, setForeground] = useState("#000000");
  const run = (m: CalendarMutation, ok: string) => {
    const out = repo.mutate(cal.id, actor, m);
    onMessage(out.ok ? ok : out.reason);
  };
  return (
    <div className="space-y-3 text-sm">
      {custom.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum tipo personalizado criado.</p>
      ) : (
        <ul className="divide-y divide-border/60 border-y border-border/60">
          {custom.map((t) => (
            <li key={t.code} className="flex flex-wrap items-center gap-3 py-2">
              <span
                className="inline-flex min-w-10 justify-center rounded px-1 text-xs font-bold"
                style={{ backgroundColor: t.background, color: t.foreground }}
              >
                {t.mark}
              </span>
              <span className="min-w-0 flex-1 font-medium">{t.label}</span>
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={t.active !== false}
                  onChange={(e) =>
                    run(
                      { kind: "salvar-tipo", type: { ...t, active: e.target.checked } },
                      e.target.checked ? "Tipo ativado." : "Tipo inativado.",
                    )
                  }
                />
                Ativo
              </label>
              <button
                type="button"
                className="text-xs text-destructive underline-offset-2 hover:underline"
                onClick={() => run({ kind: "remover-tipo", code: t.code }, "Tipo excluído.")}
              >
                Excluir
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid min-w-0 grid-cols-2 items-end gap-2 sm:grid-cols-[6rem_1fr_8rem_6rem_6rem_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!label.trim()) return;
          run(
            {
              kind: "salvar-tipo",
              type: {
                label: label.trim(),
                mark: mark.trim() || label.trim().slice(0, 2).toUpperCase(),
                kind: kind as never,
                countsAsSchoolDay,
                background,
                foreground,
                showInLegend: true,
                legendOrder: 999,
                active: true,
              } as never,
            },
            `Tipo "${label.trim()}" criado.`,
          );
          setLabel("");
          setMark("");
        }}
      >
        <label className="grid gap-1 text-xs">
          Sigla
          <input value={mark} maxLength={6} onChange={(e) => setMark(e.target.value)} className={inputCls} />
        </label>
        <label className="grid gap-1 text-xs">
          Nome / significado
          <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} />
        </label>
        <label className="grid gap-1 text-xs">
          Natureza
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
            <option value="evento">Evento</option>
            <option value="feriado">Feriado</option>
            <option value="feriado-letivo">Feriado letivo</option>
            <option value="ferias">Férias</option>
            <option value="recesso">Recesso</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs">
          Fundo
          <input type="color" value={background} onChange={(e) => setBackground(e.target.value)} className="h-9 w-full" />
        </label>
        <label className="grid gap-1 text-xs">
          Texto
          <input type="color" value={foreground} onChange={(e) => setForeground(e.target.value)} className="h-9 w-full" />
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={countsAsSchoolDay}
            onChange={(e) => setCountsAsSchoolDay(e.target.checked)}
          />
          Conta como letivo
        </label>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={!label.trim()}
          className="col-span-2 sm:col-span-1"
        >
          Adicionar tipo
        </Button>
      </form>
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
  const repo = useCalendarRepository();
  const [kind, setKind] = useState<CalendarRuleKind>("minimo-periodo");
  const run = (m: CalendarMutation, ok: string) => {
    const out = repo.mutate(cal.id, actor, m);
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

const DOC_TOGGLES: Array<[keyof Omit<CalendarDocumentConfig, "headerLines" | "typography" | "layout" | "vacationDisplay">, string]> = [
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
  const repo = useCalendarRepository();
  const run = (patch: Extract<CalendarMutation, { kind: "configurar-documento" }>["patch"]) => {
    const out = repo.mutate(cal.id, actor, { kind: "configurar-documento", patch });
    onMessage(out.ok ? "Documento atualizado." : out.reason);
  };
  const [appearance, setAppearance] = useState(false);
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
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3 md:col-span-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Personalização do Calendário</p>
          <p className="text-xs text-muted-foreground">
            Fontes, espaçamentos, margens, colunas e marcadores de cada bloco, com prévia em tela e em A4.
          </p>
        </div>
        <Button type="button" size="sm" disabled={!editable} onClick={() => setAppearance(true)}>
          Personalizar aparência
        </Button>
        <CalendarAppearanceEditor
          cal={cal}
          open={appearance}
          onOpenChange={setAppearance}
          onSave={(layout, symbology, vacationDisplay) => {
            run({ document: { layout, typography: undefined, vacationDisplay }, symbology });
            setAppearance(false);
          }}
        />
      </div>
      <LegendEditor cal={cal} editable={editable} run={run} />
    </div>
  );
}

/** Informações adicionais do documento: uma linha por item, com lugar, negrito/itálico, ordem, inclusão e remoção. */
function InfoLinesEditor({
  value,
  editable,
  onCommit,
}: {
  value: string | undefined;
  editable: boolean;
  onCommit: (text: string | undefined) => void;
}) {
  const [lines, setLines] = useState<InfoLine[]>(() => observationLines(value).map(parseInfoLine));
  const [newPlace, setNewPlace] = useState<InfoPlace>(DEFAULT_INFO_PLACE);
  const commit = (next: InfoLine[]) => {
    const text = next.map(serializeInfoLine).filter(Boolean).join("\n") || undefined;
    if ((text ?? "") !== observationLines(value).join("\n")) onCommit(text);
  };
  const apply = (next: InfoLine[], save = true) => { setLines(next); if (save) commit(next); };
  const patch = (i: number, p: Partial<InfoLine>, save = true) => apply(lines.map((l, j) => (j === i ? { ...l, ...p } : l)), save);
  const insertAt = (i: number, place: InfoPlace) => apply([...lines.slice(0, i), { text: "", place, bold: false, italic: false }, ...lines.slice(i)], false);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= lines.length) return;
    const next = [...lines]; [next[i], next[j]] = [next[j]!, next[i]!]; apply(next);
  };
  return (
    <fieldset className="grid gap-1.5 md:col-span-2">
      <legend className="mb-1 text-xs font-semibold text-muted-foreground">
        Informações adicionais (aparecem no documento; escolha o lugar de cada linha)
      </legend>
      {lines.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma informação adicional.</p>
      ) : null}
      {lines.map((line, i) => (
        <div key={i} className="flex min-w-0 flex-wrap items-center gap-1.5">
          <input
            aria-label={`Informação ${i + 1}`}
            value={line.text}
            disabled={!editable}
            className={`${inputCls} min-w-0 flex-1 ${line.bold ? "font-bold" : ""} ${line.italic ? "italic" : ""}`}
            onChange={(e) => patch(i, { text: e.target.value }, false)}
            onBlur={() => commit(lines)}
          />
          <select
            aria-label={`Lugar da informação ${i + 1}`}
            className={`${inputCls} w-auto`}
            value={line.place}
            disabled={!editable}
            onChange={(e) => patch(i, { place: e.target.value as InfoPlace })}
          >
            {INFO_PLACES.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
          {editable ? (
            <>
              <Button type="button" size="sm" variant={line.bold ? "default" : "outline"} aria-pressed={line.bold}
                aria-label={`Negrito na informação ${i + 1}`} className="font-bold" onClick={() => patch(i, { bold: !line.bold })}>N</Button>
              <Button type="button" size="sm" variant={line.italic ? "default" : "outline"} aria-pressed={line.italic}
                aria-label={`Itálico na informação ${i + 1}`} className="italic" onClick={() => patch(i, { italic: !line.italic })}>I</Button>
              <Button type="button" size="sm" variant="ghost" aria-label={`Subir informação ${i + 1}`} disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
              <Button type="button" size="sm" variant="ghost" aria-label={`Descer informação ${i + 1}`} disabled={i === lines.length - 1} onClick={() => move(i, 1)}>↓</Button>
              <Button type="button" size="sm" variant="ghost" aria-label={`Inserir linha abaixo da informação ${i + 1}`} onClick={() => insertAt(i + 1, line.place)}>+ abaixo</Button>
              <Button type="button" size="sm" variant="ghost" aria-label={`Remover informação ${i + 1}`} onClick={() => apply(lines.filter((_, j) => j !== i))}>Remover</Button>
            </>
          ) : null}
        </div>
      ))}
      {editable ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground" htmlFor="info-new-place">Adicionar em</label>
          <select id="info-new-place" className={`${inputCls} w-auto`} value={newPlace} onChange={(e) => setNewPlace(e.target.value as InfoPlace)}>
            {INFO_PLACES.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
          <Button type="button" size="sm" variant="outline" onClick={() => insertAt(lines.length, newPlace)}>
            Adicionar linha
          </Button>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Tamanho e fonte destas linhas ficam em “Personalizar aparência”, no bloco “Informações adicionais”.
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
  const repo = useCalendarRepository();
  const actor = actorFor(profile);
  const calendars = useNetworkCalendars(repo);
  const cal = calendars.find((c) => c.id === calendarId) ?? null;
  const central = useCentralState(repo, useCentralMode());
  const entry = central ? centralEntryOf(central, calendarId) : null;
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
      <Button size="sm" disabled={Boolean(central && central.status !== "lido")} onClick={() => window.print()}>
        <Printer /> Imprimir / Baixar PDF
      </Button>
      <span className="text-xs text-muted-foreground">
        A4 paisagem, uma folha. Para PDF, escolha “Salvar como PDF” no destino.
      </span>
    </div>
  );
  if (central && central.status !== "lido")
    return (
      <div className="space-y-4">
        {toolbar}
        {central.status === "lendo" ? (
          <p role="status" className="text-sm text-muted-foreground">Lendo o calendário salvo no banco…</p>
        ) : (
          <StatePanel tone="danger" title="O calendário do banco não pôde ser lido" description={central.message} />
        )}
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
  // Com banco: oficial só se a versão aberta for a homologada; sem banco (laboratório): status local.
  const published = central ? entry?.latest.lastHomologation?.decision === "homologada" || (!entry && isPublished(cal)) : isPublished(cal);
  const notice = published
    ? undefined
    : central
      ? "NÃO HOMOLOGADO · NÃO É O CALENDÁRIO OFICIAL"
      : `${STATUS_COPY[cal.status].label.toUpperCase()} — NÃO HOMOLOGADO · NÃO É O CALENDÁRIO OFICIAL`;
  return (
    <div className="space-y-4">
      {toolbar}
      <A4OverflowNotice cal={cal} notice={notice ? <p className="cd-marca-dagua">{notice}</p> : null} />
      {/* medição acima usa a mesma folha da impressão */}
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

function LegendEditor({ cal, editable, run }: { cal: NetworkCalendar; editable: boolean; run: DocRun }) {
  const types = Object.values(DAY_TYPES).filter((x) => x.showInLegend);
  const custom = cal.customLegend ?? [];
  const [mark, setMark] = useState("");
  const [label, setLabel] = useState("");
  const [bg, setBg] = useState("#FFFF00");
  const [fg, setFg] = useState("#000000");
  const [editing, setEditing] = useState<DayTypeCode | null>(null);
  return (
    <fieldset className="grid min-w-0 gap-2 md:col-span-2">
      <SymbologyEditor
        code={editing}
        overrides={cal.symbology}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        onSave={(code, value) => {
          const next = { ...(cal.symbology ?? {}) };
          if (value) next[code] = value;
          else delete next[code];
          run({ symbology: next });
          setEditing(null);
        }}
      />
      <legend className="mb-1 text-xs font-semibold text-muted-foreground">Legenda do documento</legend>
      <div className="flex flex-wrap gap-2">
        {types.map((x) => {
          const shown = !cal.legendHidden.includes(x.code);
          return (
            <span key={x.code} className="inline-flex items-center gap-1.5 rounded border border-border px-2 py-1">
              <span className="rounded px-1 text-xs font-bold" style={{ backgroundColor: x.background, color: x.foreground }}>
                <DayMark code={x.code} text={x.mark} overrides={cal.symbology} where="legenda" />
              </span>
              <span className={shown ? "" : "text-muted-foreground line-through"}>{x.label}</span>
              {editable ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-primary underline"
                  aria-label={`Personalizar marcador — ${x.label}`}
                  onClick={() => setEditing(x.code)}
                >
                  Personalizar
                </button>
              ) : null}
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
