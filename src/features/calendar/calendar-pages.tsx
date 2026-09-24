/**
 * Telas do Calendário Escolar da rede.
 * - Supervisão: elabora, revisa, homologa, duplica, arquiva.
 * - Escola/professor: consulta o calendário publicado; nenhuma edição.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CopyPlus, FileText, Lock, Printer, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { cn } from "@/lib/utils";
import { DAY_TYPES, EDITABLE_TYPES } from "./calendar-catalog";
import { CalendarDocument, DocumentFrame } from "./calendar-document";
import {
  brDate,
  dayType,
  periodBlocks,
  periodSchoolDays,
  resolveCalendar,
  totalSchoolDays,
  validateCalendar,
} from "./calendar-engine";
import { calendarCapabilities } from "./calendar-governance";
import { calendarRepository, useNetworkCalendars } from "./calendar-store";
import { isPublished } from "./calendar-queries";
import type {
  CalendarActor,
  CalendarStatus,
  DayTypeCode,
  NetworkCalendar,
  ReviewItem,
} from "./calendar-types";

const MODALITY = { regular: "Ensino Regular", eja: "EJA" } as const;

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
            const r = resolveCalendar(c);
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
                    {c.title} · {totalSchoolDays(r)} dias letivos · {c.periods.length} períodos
                    {c.duplicatedFrom ? ` · duplicado de ${c.duplicatedFrom}` : ""}
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
  const [type, setType] = useState<DayTypeCode>("RECESSO");
  const [end, setEnd] = useState(date);
  const [name, setName] = useState("");
  useEffect(() => setEnd(date), [date]);
  const run = (res: { ok: boolean; reason?: string }, okMsg: string) =>
    onMessage(res.ok ? okMsg : (res as { reason: string }).reason);
  const kind = DAY_TYPES[type].kind;
  return (
    <div className="space-y-3 text-sm">
      <label className="block">
        <span className="mb-1 block font-medium">Dia selecionado</span>
        <input
          type="date"
          className={inputCls}
          value={date}
          min={`${cal.year}-01-01`}
          max={`${cal.year}-12-31`}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
      </label>
      <p className="text-muted-foreground">
        {brDate(date)}:{" "}
        <strong className="text-foreground">{current ? DAY_TYPES[current].label : "—"}</strong>
        {override ? " (ajuste manual)" : ""}
        {event?.name ? ` · ${event.name}` : ""}
      </p>
      <label className="block">
        <span className="mb-1 block font-medium">Tipo</span>
        <select
          className={selectCls}
          value={type}
          onChange={(e) => setType(e.target.value as DayTypeCode)}
        >
          {EDITABLE_TYPES.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
              {t.mark ? ` (${t.mark})` : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() =>
            run(
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
      {kind === "ferias" || kind === "recesso" ? (
        <div className="grid gap-2 border-t border-border/70 pt-3">
          <label className="block">
            <span className="mb-1 block font-medium">Aplicar faixa até</span>
            <input
              type="date"
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
            disabled={Boolean(event)}
            onClick={() =>
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
  const r = useMemo(() => resolveCalendar(cal), [cal]);
  return (
    <div className="min-w-0 space-y-3">
      {periodBlocks(cal, r).map((b) => (
        <div key={b.block} className="min-w-0">
          {b.block ? (
            <p className="mb-1 text-sm font-semibold text-foreground">
              {b.block} · {b.total} dias letivos
            </p>
          ) : null}
          <ul className="divide-y divide-border/60 border-y border-border/60">
            {b.periods.map((p) => (
              <li
                key={p.id}
                className="grid min-w-0 gap-2 py-2 text-sm md:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))_auto] md:items-center"
              >
                <span className="font-medium text-foreground">{p.name}</span>
                {editable ? (
                  <>
                    <input
                      aria-label={`Início de ${p.name}`}
                      type="date"
                      className={inputCls}
                      defaultValue={p.start}
                      onBlur={(e) =>
                        e.target.value !== p.start &&
                        onMessage(
                          res(
                            calendarRepository.mutate(cal.id, actor, {
                              kind: "salvar-periodo",
                              period: { ...p, start: e.target.value },
                            }),
                          ),
                        )
                      }
                    />
                    <input
                      aria-label={`Término de ${p.name}`}
                      type="date"
                      className={inputCls}
                      defaultValue={p.end}
                      onBlur={(e) =>
                        e.target.value !== p.end &&
                        onMessage(
                          res(
                            calendarRepository.mutate(cal.id, actor, {
                              kind: "salvar-periodo",
                              period: { ...p, end: e.target.value },
                            }),
                          ),
                        )
                      }
                    />
                    <input
                      aria-label={`Conselho de ${p.name}`}
                      type="date"
                      className={inputCls}
                      defaultValue={p.councilDate}
                      onBlur={(e) =>
                        e.target.value !== (p.councilDate ?? "") &&
                        onMessage(
                          res(
                            calendarRepository.mutate(cal.id, actor, {
                              kind: "salvar-periodo",
                              period: { ...p, councilDate: e.target.value || undefined },
                            }),
                          ),
                        )
                      }
                    />
                  </>
                ) : (
                  <>
                    <span>{brDate(p.start)}</span>
                    <span>{brDate(p.end)}</span>
                    <span>{p.councilDate ? `Conselho ${brDate(p.councilDate)}` : "—"}</span>
                  </>
                )}
                <span className="tabular-nums font-semibold text-foreground">
                  {periodSchoolDays(r, p)} dias
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
const res = (r: { ok: boolean; reason?: string }) =>
  r.ok ? "Período atualizado." : (r as { reason: string }).reason;

export function CalendarWorkspacePage({
  calendarId,
  profile,
}: {
  calendarId: string;
  profile: CalendarProfile;
}) {
  const actor = actorFor(profile);
  const calendars = useNetworkCalendars();
  const cal = calendars.find((c) => c.id === calendarId) ?? null;
  const caps = calendarCapabilities(actor, cal);
  const [date, setDate] = useState<string>("");
  const [message, setMessage] = useState("");
  const [confirmCritical, setConfirmCritical] = useState(false);
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

  const r = resolveCalendar(cal);
  const issues = validateCalendar(cal, r);
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
              {totalSchoolDays(r)} dias letivos · {cal.periods.length} períodos
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
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // A folha precisa caber em 1 página A4 paisagem (≈ 736px úteis de altura).
    const h = el.scrollHeight;
    el.style.setProperty("--cd-print-zoom", String(Math.min(1, 736 / h)));
  }, [cal]);
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
        <Printer /> Imprimir / salvar PDF
      </Button>
      <span className="text-xs text-muted-foreground">A4 paisagem, uma página.</span>
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
  return (
    <div className="space-y-4">
      {toolbar}
      <div className="overflow-x-auto print:overflow-visible">
        <div ref={ref} className="cd-print-fit w-[1058px] print:w-auto">
          <CalendarDocument
            cal={cal}
            notice={
              published ? null : (
                <p className="cd-marca-dagua">
                  {STATUS_COPY[cal.status].label.toUpperCase()} — NÃO HOMOLOGADO · NÃO É O
                  CALENDÁRIO OFICIAL
                </p>
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
