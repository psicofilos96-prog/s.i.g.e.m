import { formatAcademicDate } from "@/lib/academic-date";
import { Link } from "@tanstack/react-router";
import { DateInput } from "@/components/sigem/date-input";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
import { CalendarCheck2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { diaryToday, type DiarySearch } from "./diary-data";
import { plannedLessonsResolution, shiftDate } from "./lesson-records";
import { useJourneySources } from "./diary-journey-hooks";
import {
  journeyAgenda,
  pendingWithoutResume,
  resumeItems,
  temporalityOf,
  type JourneyAction,
  type JourneyItem,
  type JourneyState,
  type PendingItem,
} from "./diary-journey";

export function JourneyLink({
  action,
  variant = "outline",
  label,
  ariaLabel,
}: {
  action: JourneyAction;
  variant?: "default" | "outline" | "ghost";
  label?: string;
  ariaLabel?: string;
}) {
  return (
    <Button asChild size="sm" variant={variant}>
      <Link
        to={action.to}
        params={action.params as never}
        search={action.search as never}
        {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
      >
        {label ?? action.label}
      </Link>
    </Button>
  );
}

const STATE_TONE: Record<JourneyState, "neutral" | "warning" | "success" | "info"> = {
  "Na grade · não confirmada pelo calendário": "neutral",
  Prevista: "neutral",
  "Prevista · sem registro": "neutral",
  "Registro em elaboração": "warning",
  "Chamada pendente": "info",
  "Chamada em elaboração": "warning",
  "Chamada concluída": "success",
};

/** Navegação temporal simples: anterior, hoje, próximo e seletor. */
export function DateStepper({
  date,
  search,
  to = "/diario",
}: {
  date: string;
  search: DiarySearch;
  to?: "/diario";
}) {
  const navigate = useNavigate();
  const temporality = temporalityOf(date);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button asChild variant="ghost" size="icon" aria-label="Dia anterior">
        <Link to={to} search={{ ...search, data: shiftDate(date, -1) }}>
          <ChevronLeft />
        </Link>
      </Button>
      <Button
        asChild
        variant="ghost"
        size="sm"
        aria-current={temporality === "hoje" ? "date" : undefined}
      >
        <Link to={to} search={{ ...search, data: diaryToday() }}>
          Hoje
        </Link>
      </Button>
      <Button asChild variant="ghost" size="icon" aria-label="Próximo dia">
        <Link to={to} search={{ ...search, data: shiftDate(date, 1) }}>
          <ChevronRight />
        </Link>
      </Button>
      <DateInput
        aria-label="Data consultada"
        className="h-8 w-40"
        value={date}
        onChange={(event) =>
          event.target.value &&
          void navigate({ to, search: { ...search, data: event.target.value } })
        }
      />
      {temporality === "histórica" ? (
        <span className="text-xs font-medium text-muted-foreground">Consulta histórica</span>
      ) : temporality === "futura" ? (
        <span className="text-xs font-medium text-muted-foreground">Data futura · previsão</span>
      ) : null}
    </div>
  );
}

function JourneyRow({ item }: { item: JourneyItem }) {
  const secondary =
    item.entryId &&
    item.action.kind !== "ver-registro" &&
    item.journeyState !== "Registro em elaboração"
      ? item.entryId
      : undefined;
  const isAttendance =
    item.action.kind === "fazer-chamada" || item.action.kind === "continuar-chamada";
  return (
    <li className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[5.5rem_minmax(0,1fr)_auto] md:items-center md:gap-4">
      <span className="font-semibold tabular-nums text-foreground">
        {formatAcademicDate(item.block.start)}
        <span className="text-muted-foreground">–{item.block.end}</span>
      </span>
      <div className="min-w-0">
        <p className="break-words font-medium text-foreground">
          {item.className} <span className="font-normal text-muted-foreground">· {item.field}</span>
        </p>
        <p className="break-words text-xs text-muted-foreground">
          {item.unitName}
          {item.infant ? " · experiência pedagógica" : ""}
          {item.plan ? " · possui planejamento" : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <StatusBadge tone={STATE_TONE[item.journeyState]}>{item.journeyState}</StatusBadge>
        {secondary ? (
          <Button asChild size="sm" variant="ghost">
            <Link
              to="/diario/registros/$registroId"
              params={{ registroId: secondary }}
              search={{ ...item.action.search }}
            >
              Ver
            </Link>
          </Button>
        ) : null}
        {item.journeyState === "Chamada concluída" && item.entryId ? (
          <Button asChild size="sm" variant="ghost">
            <Link
              to="/diario/chamada/$registroId"
              params={{ registroId: item.entryId }}
              search={{ ...item.action.search }}
              aria-label={`Chamada das ${item.block.start} em ${item.className}`}
            >
              Chamada
            </Link>
          </Button>
        ) : null}
        <JourneyLink
          action={item.action}
          variant={item.action.kind === "ver-registro" ? "ghost" : "outline"}
          ariaLabel={
            isAttendance
              ? `Chamada das ${item.block.start} em ${item.className}`
              : `${item.action.label} das ${item.block.start} em ${item.className}`
          }
        />
      </div>
    </li>
  );
}

/** Área dominante "Hoje": linha do tempo cronológica da data consultada. */
export function JourneyAgenda({ search, date }: { search: DiarySearch; date: string }) {
  const professionalId = search.professor;
  const sources = useJourneySources();
  const items = professionalId ? journeyAgenda(professionalId, date, sources, search) : [];
  const temporality = temporalityOf(date);
  // B4.6.3d — mesma data/knownAt do contexto aceito; sem calendário resolvido, grade ≠ previsão.
  const calendar = professionalId ? plannedLessonsResolution(professionalId, date) : null;
  return (
    <section aria-labelledby="agenda-title">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 pb-2">
        <div>
          <h2 id="agenda-title" className="font-display text-xl font-semibold text-foreground">
            {temporality === "hoje" ? "Hoje" : "Agenda do dia"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {calendar?.kind === "indeterminado"
              ? `${formatAcademicDate(date)} · horários da grade; o calendário não confirma aulas previstas nesta data.`
              : `${formatAcademicDate(date)} · aulas previstas no horário; o registro depende da sua confirmação.`}
          </p>
          {calendar?.kind === "indeterminado" ? (
            <p className="text-xs text-muted-foreground" data-testid="agenda-calendar-notice">
              {calendar.reason} Nenhuma aula é prevista nem ausência é gerada a partir da grade.
            </p>
          ) : null}
        </div>
        <DateStepper date={date} search={search} />
      </div>
      {items.length ? (
        <ol className="divide-y divide-border" aria-label="Aulas do dia">
          {items.map((item) => (
            <JourneyRow key={item.key} item={item} />
          ))}
        </ol>
      ) : (
        <div className="mt-3">
          <EmptyState
            icon={CalendarCheck2}
            title={calendar?.kind === "indeterminado" ? "Sem horários da grade nesta data" : "Sem aulas previstas para esta data"}
            description="Situação legítima. Se uma atividade ocorreu fora do horário, registre-a como aula fora da previsão."
            compact
          />
        </div>
      )}
    </section>
  );
}

function PendingRow({ item }: { item: PendingItem }) {
  return (
    <li className="flex flex-col items-start gap-1.5 py-2.5">
      <div className="min-w-0">
        <p className="break-words text-sm font-medium text-foreground">
          <span className="mr-2 text-xs font-semibold uppercase text-muted-foreground">
            {item.label}
          </span>
          {item.title}
        </p>
        <p className="break-words text-xs text-muted-foreground">{item.description}</p>
      </div>
      <JourneyLink action={item.action} variant="ghost" />
    </li>
  );
}

export function ResumeSection({ search }: { search: DiarySearch }) {
  const sources = useJourneySources();
  const items = search.professor ? resumeItems(search.professor, sources, search) : [];
  if (!items.length) return null;
  return (
    <section aria-labelledby="resume-title" className="border-l-2 border-primary/50 pl-4">
      <h2 id="resume-title" className="text-sm font-semibold text-foreground">
        Continuar de onde parei
      </h2>
      <ul className="divide-y divide-border/70">
        {items.map((item) => (
          <PendingRow key={item.id} item={item} />
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Trabalhos desta sessão ficam apenas na memória da aba e são perdidos ao recarregar.
      </p>
    </section>
  );
}

export function PendingSection({ search }: { search: DiarySearch }) {
  const sources = useJourneySources();
  const items = search.professor ? pendingWithoutResume(search.professor, sources, search) : [];
  return (
    <section aria-labelledby="pending-title">
      <div className="flex items-baseline justify-between gap-2 border-b border-border/70 pb-2">
        <h2 id="pending-title" className="text-base font-semibold text-foreground">
          Pendências do Diário
        </h2>
        <span className="text-xs text-muted-foreground">{items.length} item(ns)</span>
      </div>
      {items.length ? (
        <ul className="divide-y divide-border/70" aria-label="Pendências">
          {items.map((item) => (
            <PendingRow key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <p className="py-3 text-sm text-muted-foreground">
          Nada a concluir. Aulas futuras ou ainda não ocorridas não são pendências.
        </p>
      )}
      <Link
        to="/diario/aulas"
        search={search}
        className="mt-1 inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
      >
        Histórico de aulas e experiências <ArrowRight className="size-3.5" />
      </Link>
    </section>
  );
}
