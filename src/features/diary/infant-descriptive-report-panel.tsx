import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { capabilityFor, useSessionAuthority } from "@/features/authority/session-authority";
import {
  fetchReportChain,
  OFFICIALIZE_REPORT_CAPABILITY,
  officializeReportInCloud,
  snapshotRepository,
} from "./descriptive-report-cloud";
import { Link } from "@tanstack/react-router";
import { ArrowRight, FileText } from "lucide-react";
import { formatAcademicDate } from "@/lib/academic-date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeader, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { curriculumObjectiveRepository } from "@/features/curriculum/curriculum-objectives-repository";
import { getDemonstrationProfessional } from "@/features/professionals/professionals-data";
import { DEFAULT_DIARY_PROFESSIONAL_ID, DIARY_REFERENCE_DATE, type DiarySearch } from "./diary-data";
import {
  admissibleObjectivesForClass,
  conferReport,
  currentReportVersion,
  draftFromCurrent,
  NO_DESCRIPTIVE_REPORT_NOTE,
  officializeReport,
  reportAuthorFor,
  reportPeriodsForClass,
  reportSubsidies,
  useReportChain,
  descriptiveReportRepository,
  type DescriptiveReportDraft,
  type DescriptiveReportRepository,
  type DescriptiveReportVersion,
  type ReportAuthor,
  type ReportConference,
  type ReportFailure,
} from "./infant-descriptive-report";
import { fieldLabel, infantExperienceRecords, useLocalInfantExperiences } from "./infant-experiences";

const objectiveCode = (id: string) => curriculumObjectiveRepository.byId(id)?.code ?? id;
const personName = (id: string) => getDemonstrationProfessional(id)?.personName ?? id;
const authorName = (a: ReportAuthor, sessionName?: string) =>
  a.demonstrative ? `${personName(a.professionalId)} (agente demonstrativo)` : (sessionName ?? "Autor institucional");

export function InfantDescriptiveReportPanel({
  studentId,
  classId,
  search,
}: {
  studentId: string;
  classId: string;
  search: DiarySearch;
}) {
  const periods = reportPeriodsForClass(classId);
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? "");
  const period = periods.find((p) => p.id === periodId);
  if (!period)
    return (
      <section className="surface-panel p-4 sm:p-5">
        <SectionHeader title="Parecer descritivo" description="Nenhum período letivo configurado para esta turma." />
      </section>
    );
  return (
    <section className="surface-panel space-y-4 p-4 sm:p-5">
      <SectionHeader
        title="Parecer descritivo"
        description="Documento pedagógico individual por período letivo. Não é nota, conceito nem classificação."
      />
      {periods.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Período letivo">
          {periods.map((p) => (
            <Button key={p.id} size="sm" variant={p.id === periodId ? "default" : "outline"} onClick={() => setPeriodId(p.id)}>
              {p.label}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{period.label}</p>
      )}
      <ReportSource key={periodId} studentId={studentId} classId={classId} period={period} search={search} />
    </section>
  );
}

type EditorProps = {
  studentId: string;
  classId: string;
  period: { id: string; start: string; end: string };
  search: DiarySearch;
};

function ReportSource(props: EditorProps) {
  const authority = useSessionAuthority();
  if (authority.status === "loading") return <p className="text-sm text-muted-foreground">Verificando sua sessão…</p>;
  if (authority.status === "signed-out") return <DemoReportEditor {...props} />;
  return <CloudReportEditor {...props} authority={authority} />;
}

function DemoReportEditor(props: EditorProps) {
  const key = { studentId: props.studentId, classId: props.classId, periodId: props.period.id };
  const chain = useReportChain(key);
  const professionalId = props.search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID;
  const author = reportAuthorFor(professionalId, props.classId, props.search.data ?? DIARY_REFERENCE_DATE);
  return (
    <>
      <ReportEditor
        {...props}
        chain={chain}
        repo={descriptiveReportRepository}
        author={author}
        professionalId={professionalId}
        noAuthorNote="Sem atuação pedagógica vigente nesta turma para preparar o parecer."
        onOfficialize={async (conference) => officializeReport({ conference })}
      />
      <p className="text-xs text-muted-foreground">
        Laboratório sem login: o parecer existe só nesta sessão e não permanece após recarregar. <Link to="/auth" className="text-primary underline">Entrar</Link> para registrar de verdade.
      </p>
    </>
  );
}

function CloudReportEditor(props: EditorProps & { authority: Extract<ReturnType<typeof useSessionAuthority>, { status: "signed-in" }> }) {
  const key = { studentId: props.studentId, classId: props.classId, periodId: props.period.id };
  const qc = useQueryClient();
  const queryKey = ["descriptive-report", key.studentId, key.classId, key.periodId];
  const q = useQuery({ queryKey, queryFn: () => fetchReportChain(key) });
  const cap = capabilityFor(props.authority.capabilities, OFFICIALIZE_REPORT_CAPABILITY, { classId: key.classId, periodId: key.periodId });
  const author: ReportAuthor | null = cap && props.authority.person
    ? { personId: props.authority.person.id, engagementId: cap.engagementId, demonstrative: false }
    : null;
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Carregando parecer…</p>;
  if (q.error) return <StatePanel tone="warning" title="Não foi possível carregar o parecer" description="Tente recarregar a página." />;
  const chain = q.data ?? [];
  const noAuthorNote = !props.authority.person
    ? "Sua conta ainda não está vinculada a uma pessoa institucional. Nenhuma capacidade foi concedida."
    : "Sua atuação vigente não recebe, por política homologada, a capacidade de oficializar pareceres nesta turma e período.";
  return (
    <>
      <ReportEditor
        {...props}
        chain={chain}
        repo={snapshotRepository(chain)}
        author={author}
        sessionName={props.authority.person?.displayName}
        noAuthorNote={noAuthorNote}
        onOfficialize={async (conference) => {
          const r = await officializeReportInCloud(conference);
          await qc.invalidateQueries({ queryKey });
          return r;
        }}
      />
      <p className="text-xs text-muted-foreground">Registro institucional: as versões oficiais ficam guardadas e não podem ser alteradas.</p>
    </>
  );
}

function ReportEditor({
  studentId,
  classId,
  period,
  search,
  chain,
  repo,
  author,
  professionalId,
  sessionName,
  noAuthorNote,
  onOfficialize,
}: EditorProps & {
  chain: readonly DescriptiveReportVersion[];
  repo: DescriptiveReportRepository;
  author: ReportAuthor | null;
  professionalId?: string;
  sessionName?: string;
  noAuthorNote: string;
  onOfficialize: (c: ReportConference) => Promise<{ ok: true } | ReportFailure>;
}) {
  const key = { studentId, classId, periodId: period.id };
  const current = currentReportVersion(chain);
  const records = infantExperienceRecords(professionalId ?? search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID, useLocalInfantExperiences());
  const subsidies = reportSubsidies(key, period, records);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<DescriptiveReportDraft | null>(null);
  const [conference, setConference] = useState<ReportConference | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const base = draftFromCurrent(key, current);
  const changes = draft
    ? Number(draft.text !== base.text) + Number([...draft.objectiveIds].sort().join() !== [...base.objectiveIds].sort().join())
    : 0;
  const update = (patch: Partial<DescriptiveReportDraft>) => {
    setConference(null);
    setError(null);
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };

  return (
    <div className="space-y-4">
      <details className="rounded-lg border border-border p-3" open={Boolean(draft)}>
        <summary className="cursor-pointer text-sm font-semibold">
          Registros do período ({subsidies.length})
        </summary>
        <p className="mt-1 text-xs text-muted-foreground">
          Subsídio de escrita. Nada é copiado automaticamente para o parecer.
        </p>
        <ul className="mt-3 space-y-2">
          {subsidies.map((s) => (
            <li key={s.recordId} className="rounded-md bg-muted/40 p-2 text-sm">
              <p className="text-xs text-muted-foreground">
                {formatAcademicDate(s.date)} · {s.title}
              </p>
              {s.observation ? <p className="mt-1">{s.observation}</p> : null}
              <p className="mt-1 text-xs text-muted-foreground">
                {s.fieldIds.map(fieldLabel).join(" · ")}
                {s.objectiveIds.length ? ` · ${s.objectiveIds.map(objectiveCode).join(", ")}` : ""}
              </p>
              <Link to="/diario/registros/$registroId" params={{ registroId: s.recordId }} search={search} className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
                Ver registro <ArrowRight className="size-3" />
              </Link>
            </li>
          ))}
          {!subsidies.length ? <li className="text-sm text-muted-foreground">Sem registros desta criança neste período.</li> : null}
        </ul>
      </details>

      {!draft ? (
        <div className="rounded-lg border border-border p-3">
          {current ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone="success">Versão oficial {current.versionNumber}</StatusBadge>
                <span className="text-xs text-muted-foreground">
                  {authorName(current.author, sessionName)} · {formatAcademicDate(current.officializedAt.slice(0, 10))}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{current.text}</p>
              {current.objectiveIds.length ? (
                <p className="mt-2 text-xs text-muted-foreground">Objetivos relacionados: {current.objectiveIds.map(objectiveCode).join(", ")}</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{NO_DESCRIPTIVE_REPORT_NOTE}</p>
          )}
          {author ? (
            <Button className="mt-3" size="sm" variant={current ? "outline" : "default"} onClick={() => setDraft(draftFromCurrent(key, current))}>
              <FileText /> {current ? "Corrigir parecer" : "Escrever parecer"}
            </Button>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">{noAuthorNote}</p>
          )}
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="warning">Rascunho — ainda não oficial</StatusBadge>
            {changes ? <span className="text-xs text-muted-foreground">{changes} alteração(ões) local(is)</span> : null}
          </div>
          <label className="block text-sm font-medium" htmlFor="parecer-texto">Texto do parecer</label>
          <Textarea id="parecer-texto" rows={9} value={draft.text} onChange={(e) => update({ text: e.target.value })} />
          {current ? (
            <>
              <label className="block text-sm font-medium" htmlFor="parecer-motivo">Motivo da nova versão</label>
              <Input id="parecer-motivo" value={draft.correctionReason ?? ""} onChange={(e) => update({ correctionReason: e.target.value })} />
            </>
          ) : null}
          <div>
            <p className="text-sm font-medium">Objetivos relacionados (Matriz BNCC)</p>
            <p className="text-xs text-muted-foreground">Referência pedagógica, não “atingiu/não atingiu”.</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {draft.objectiveIds.map((id) => (
                <Button key={id} size="sm" variant="secondary" aria-label={`Remover ${objectiveCode(id)}`} onClick={() => update({ objectiveIds: draft.objectiveIds.filter((x) => x !== id) })}>
                  {objectiveCode(id)} ×
                </Button>
              ))}
            </div>
            <Input className="mt-2" placeholder="Buscar por código ou texto" aria-label="Buscar objetivo" value={query} onChange={(e) => setQuery(e.target.value)} />
            {query.trim() ? (
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
                {admissibleObjectivesForClass(classId, query)
                  .filter((o) => !draft.objectiveIds.includes(o.id))
                  .slice(0, 8)
                  .map((o) => (
                    <li key={o.id}>
                      <button type="button" className="w-full rounded-md p-2 text-left text-sm hover:bg-muted" onClick={() => { update({ objectiveIds: [...draft.objectiveIds, o.id] }); setQuery(""); }}>
                        <span className="font-medium">{o.code}</span> {o.officialText}
                      </button>
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>
          {error ? <StatePanel tone="warning" title="Não foi possível prosseguir" description={error} /> : null}
          {conference ? (
            <div className="space-y-2 rounded-md bg-muted/40 p-3 text-sm">
              <p className="font-semibold">Conferência — ainda não oficializado</p>
              <p className="text-xs text-muted-foreground">Autor: {authorName(conference.author, sessionName)}</p>
              {conference.before ? (
                <div>
                  <p className="text-xs font-medium">Antes (versão {conference.before.versionNumber})</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{conference.before.text}</p>
                  <p className="mt-2 text-xs font-medium">Depois</p>
                </div>
              ) : null}
              <p className="whitespace-pre-wrap">{conference.draft.text}</p>
              <p className="text-xs text-muted-foreground">
                Objetivos: {conference.draft.objectiveIds.map(objectiveCode).join(", ") || "nenhum"}
              </p>
              <Button size="sm" disabled={busy} onClick={async () => {
                setBusy(true);
                const r = await onOfficialize(conference);
                setBusy(false);
                if (!r.ok) { setConference(null); setError(r.message); return; }
                setDraft(null); setConference(null);
              }}>
                Oficializar
              </Button>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => {
              const r = conferReport({ draft, author, repo });
              if (r.ok) { setConference(r.conference); setError(null); } else setError(r.message);
            }}>
              Conferir
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraft(null); setConference(null); setError(null); }}>
              Descartar rascunho
            </Button>
          </div>
        </div>
      )}

      {chain.length > 1 ? (
        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-semibold">Histórico ({chain.length} versões)</summary>
          <ol className="mt-2 space-y-2">
            {[...chain].reverse().map((v) => (
              <li key={v.id} className="text-sm">
                <p className="text-xs text-muted-foreground">
                  Versão {v.versionNumber} · {formatAcademicDate(v.officializedAt.slice(0, 10))}
                  {v.correctionReason ? ` · Motivo: ${v.correctionReason}` : ""}
                </p>
                <p className="whitespace-pre-wrap">{v.text}</p>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}
