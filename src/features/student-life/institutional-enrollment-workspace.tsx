import { PageHeader } from "@/components/sigem/patterns";
/**
 * B3 — Interface institucional de inscrição letiva, participação, alocação,
 * capacidade/ocupação e movimentação. Só renderizada com sessão (gate na rota);
 * lê pelos readers bitemporais e grava pelos escritores do banco. Operações
 * cuja norma não está homologada aparecem desabilitadas com o motivo.
 */
import { SkeletonState } from "@/components/sigem/guidance";
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/sigem/date-input";
import { formatAcademicDate as fmt } from "@/lib/academic-date";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BOND_STATUS_SCHEME, CAPACITY_CAPABILITY, CONSULT_CAPABILITY, ENROLLMENT_CAPABILITY, MOVEMENT_CAPABILITY,
  PARTICIPATION_NATURE_SCHEME, academicYearsOn, activeClassesOn, allocationMoveAvailability, b3Message, constituteCycleEnrollment,
  declareCycleParticipation, homologatedMovementTypes, homologatedValues, readCapacityOccupancy,
  readClassAllocations, readCycleEnrollments, readCycleParticipations, recordClassAllocation,
  recordClassAllocationEnding, recordClassCapacity, recordCycleEnrollmentEnding, recordStudentMovement, readMovementsKnown,
  type CatalogValue,
} from "./cycle-enrollment-source";
import {
  SITUATION_LABEL, TRAJECTORY_LABEL, buildTrajectory, deriveAvailability, filterSecretaryRows, secretaryRows,
  type MovementRow, type OperationalSituation,
} from "./secretary-operations";
import { AllocationPositionsPanel } from "./allocation-curricular-position-panel";
import { ClassCurricularResolutionPanel } from "./class-curricular-resolution-panel";
import { ClassJourneyPanel } from "./class-journey-panel";

const today = () => new Date().toISOString().slice(0, 10);
const newId = (p: string) => `${p}-${crypto.randomUUID()}`;

function Unavailable({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">{children}</p>;
}

export type EnrollmentFocus = "matriculas" | "enturmacoes" | "movimentacoes";

export function InstitutionalEnrollmentWorkspace({ focus }: { focus: EnrollmentFocus }) {
  const authority = useSessionAuthority();
  const qc = useQueryClient();
  const [validOn, setValidOn] = useState(today());
  const [school, setSchool] = useState<string>("");
  // knownAt opcional: vazio = conhecimento atual; preenchido = "o que se sabia até" (fim do dia informado).
  const [knownOn, setKnownOn] = useState("");
  const knownAt = knownOn ? `${knownOn}T23:59:59.999999Z` : null;
  const [feedback, setFeedback] = useState<string | null>(null);

  const caps = authority.status === "signed-in" ? authority.capabilities : [];
  const schoolsWith = (cap: string) => new Set(caps.filter((c) => c.capabilityId === cap && c.schoolId).map((c) => c.schoolId!));
  const consult = schoolsWith(CONSULT_CAPABILITY);
  const maintain = schoolsWith(ENROLLMENT_CAPABILITY);
  const movement = schoolsWith(MOVEMENT_CAPABILITY);
  const capacity = schoolsWith(CAPACITY_CAPABILITY);
  const schools = [...new Set([...consult, ...maintain])];
  const activeSchool = school || schools[0] || "";
  const canMaintain = maintain.has(activeSchool);

  const key = ["b3", activeSchool, validOn, knownAt];
  const data = useQuery({
    queryKey: key,
    enabled: Boolean(activeSchool),
    queryFn: async () => {
      const t = { validOn, knownAt };
      const h = { validOn: null, knownAt };
      const [enrollments, participations, allocations, hEnrollments, hParticipations, hAllocations, movements, natures, bondStatuses, movementTypes, years, classes] = await Promise.all([
        readCycleEnrollments(activeSchool, t),
        readCycleParticipations(activeSchool, t),
        readClassAllocations({ school: activeSchool }, t),
        readCycleEnrollments(activeSchool, h),
        readCycleParticipations(activeSchool, h),
        readClassAllocations({ school: activeSchool }, h),
        readMovementsKnown(activeSchool, knownAt) as Promise<MovementRow[]>,
        homologatedValues(PARTICIPATION_NATURE_SCHEME, validOn),
        homologatedValues(BOND_STATUS_SCHEME, validOn),
        homologatedMovementTypes(validOn),
        supabase.from("institutional_academic_year_versions").select("academic_year_id, official_name, version, valid_from, is_active"),
        supabase.from("institutional_classes").select("id, academic_year_id").eq("school_id", activeSchool),
      ]);
      if (years.error) throw new Error(years.error.message);
      if (classes.error) throw new Error(classes.error.message);
      return {
        enrollments, participations, allocations, natures,
        history: { enrollments: hEnrollments, participations: hParticipations, allocations: hAllocations, movements }, bondStatuses, movementTypes,
        years: academicYearsOn(years.data ?? [], validOn),
        classes: await activeClassesOn(classes.data ?? [], validOn),
      };
    },
  });
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setFeedback(null);
    try { await fn(); setFeedback(ok); await qc.invalidateQueries({ queryKey: ["b3"] }); }
    catch (e) { setFeedback(b3Message(e)); }
  };

  if (authority.status === "loading") return <SkeletonState label="Carregando" />;
  if (!schools.length) return <Unavailable>Sua atuação não tem capacidade de consultar ou manter matrícula em nenhuma escola.</Unavailable>;
  const d = data.data;

  return (
    <div className="space-y-6">
      <PageHeader title="Matrícula, participação e enturmação" description="Fonte institucional. Datas explícitas; ausência permanece ausência." />
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor="b3-school">Escola</Label>
          <select id="b3-school" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={activeSchool} onChange={(e) => setSchool(e.target.value)}>
            {schools.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="b3-date">Data de referência</Label>
          <DateInput id="b3-date" value={validOn} onChange={(e) => setValidOn(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="b3-known">Conhecido até (opcional)</Label>
          <DateInput id="b3-known" value={knownOn} onChange={(e) => setKnownOn(e.target.value)} />
        </div>
      </div>
      {feedback && <p role="status" className="text-sm">{feedback}</p>}
      {data.isLoading && <p className="text-sm text-muted-foreground" role="status">Lendo os registros oficiais…</p>}
      {data.error && <Unavailable>Fonte indisponível: {b3Message(data.error)}</Unavailable>}
      {d && (
        <>
          {focus === "matriculas" && <SearchSection d={d} validOn={validOn} />}
          {focus === "matriculas" && <EnrollmentSection d={d} school={activeSchool} validOn={validOn} canMaintain={canMaintain} run={run} />}
          {focus !== "movimentacoes" && <ParticipationSection d={d} validOn={validOn} canMaintain={canMaintain} run={run} />}
          {focus === "enturmacoes" && <AllocationSection d={d} validOn={validOn} canMaintain={canMaintain} canCapacity={capacity.has(activeSchool)} run={run} />}
          {focus === "enturmacoes" && <AllocationPositionsPanel school={activeSchool} validOn={validOn} canMaintain={canMaintain} />}
          {focus === "enturmacoes" && <ClassCurricularResolutionPanel school={activeSchool} validOn={validOn} classes={d.classes} />}
          {focus === "enturmacoes" && <ClassJourneyPanel validOn={validOn} classes={d.classes} />}
          {focus === "movimentacoes" && <MovementSection d={d} school={activeSchool} validOn={validOn} canRegister={movement.has(activeSchool)} run={run} />}
        </>
      )}
    </div>
  );
}

type Data = {
  enrollments: Awaited<ReturnType<typeof readCycleEnrollments>>;
  participations: Awaited<ReturnType<typeof readCycleParticipations>>;
  allocations: Awaited<ReturnType<typeof readClassAllocations>>;
  history: { enrollments: Data["enrollments"]; participations: Data["participations"]; allocations: Data["allocations"]; movements: MovementRow[] };
  natures: CatalogValue[]; bondStatuses: CatalogValue[]; movementTypes: CatalogValue[];
  years: { id: string; name: string }[]; classes: { id: string; academic_year_id: string; name: string }[];
};
type Run = (fn: () => Promise<unknown>, ok: string) => Promise<void>;

function EnrollmentSection({ d, school, validOn, canMaintain, run }: { d: Data; school: string; validOn: string; canMaintain: boolean; run: Run }) {
  const [kind, setKind] = useState("cpf");
  const [value, setValue] = useState("");
  const [found, setFound] = useState<{ student_id: string; display_name: string }[]>([]);
  const [year, setYear] = useState("");
  const [ending, setEnding] = useState<Record<string, { date: string; status: string }>>({});
  return (
    <Card>
      <CardHeader><CardTitle>Inscrições letivas vigentes em {fmt(validOn)}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {d.enrollments.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma inscrição registrada vigente nesta data.</p> : (
          <ul className="space-y-2 text-sm">
            {d.enrollments.map((e) => {
              const st = ending[e.logical_id] ?? { date: "", status: "" };
              return (
                <li key={e.id} className="rounded-md border border-border p-2">
                  <div>{e.student_id} · ano {e.academic_year_id ?? "não registrado"} · desde {e.opened_on ? fmt(e.opened_on) : "não registrada"} {e.ended_on ? `· até ${fmt(e.ended_on)}` : ""}</div>
                  {canMaintain && (d.bondStatuses.length === 0
                    ? <Unavailable>Encerrar indisponível: nenhuma situação do vínculo homologada.</Unavailable>
                    : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <DateInput aria-label="Data de término" value={st.date} onChange={(ev) => setEnding({ ...ending, [e.logical_id]: { ...st, date: ev.target.value } })} />
                        <select aria-label="Situação do vínculo" className="h-9 rounded-md border border-input bg-background px-2" value={st.status} onChange={(ev) => setEnding({ ...ending, [e.logical_id]: { ...st, status: ev.target.value } })}>
                          <option value="">Situação…</option>
                          {d.bondStatuses.map((b) => <option key={b.valueId} value={b.valueId}>{b.label}</option>)}
                        </select>
                        <Button size="sm" variant="outline" disabled={!st.date || !st.status} onClick={() => run(() => recordCycleEnrollmentEnding({
                          enrollmentLogicalId: e.logical_id, baseVersionId: e.ending_version_id, endedOn: st.date,
                          bondStatus: d.bondStatuses.find((b) => b.valueId === st.status) ?? null,
                          correctionReason: e.ending_version_id ? "Retificação do término" : null,
                        }), "Término registrado.")}>Encerrar</Button>
                      </div>
                    ))}
                </li>
              );
            })}
          </ul>
        )}
        {canMaintain && (
          <div className="space-y-2 border-t border-border pt-4">
            <h3 className="font-medium">Constituir inscrição</h3>
            <div className="flex flex-wrap gap-2">
              <Input aria-label="Tipo de identificador" className="w-32" value={kind} onChange={(e) => setKind(e.target.value)} />
              <Input aria-label="Identificador do estudante" className="w-56" value={value} onChange={(e) => setValue(e.target.value)} />
              <Button size="sm" variant="outline" onClick={async () => {
                const { data } = await supabase.rpc("locate_student_for_enrollment", { _kind: kind, _value: value });
                setFound(data ?? []);
              }}>Localizar</Button>
            </div>
            {d.years.length === 0 ? <Unavailable>Nenhum ano letivo oficial registrado.</Unavailable> : (
              <select aria-label="Ano letivo" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="">Ano letivo…</option>
                {d.years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            )}
            <p className="text-xs text-muted-foreground">Oferta educacional: não registrada — não há definição homologada de qual eixo a representa.</p>
            {found.map((s) => (
              <Button key={s.student_id} size="sm" disabled={!year} onClick={() => run(() => constituteCycleEnrollment({
                id: newId("insc"), studentId: s.student_id, schoolId: school, academicYearId: year, openedOn: validOn,
              }), "Inscrição constituída.")}>Inscrever {s.display_name} em {fmt(validOn)}</Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ParticipationSection({ d, validOn, canMaintain, run }: { d: Data; validOn: string; canMaintain: boolean; run: Run }) {
  const [enrollment, setEnrollment] = useState("");
  const [nature, setNature] = useState("");
  return (
    <Card>
      <CardHeader><CardTitle>Participações educacionais vigentes</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        {d.participations.length === 0 ? <p className="text-muted-foreground">Nenhuma participação registrada vigente nesta data.</p> : (
          <ul className="space-y-1">
            {d.participations.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <span>{p.student_id} · natureza {p.nature_value_id} v{p.nature_version} · {fmt(p.valid_from)}{p.valid_until ? ` a ${fmt(p.valid_until)}` : ""}</span>
                {canMaintain && !p.valid_until && (
                  <Button size="sm" variant="outline" onClick={() => run(() => declareCycleParticipation({
                    logicalId: p.logical_id, baseVersionId: p.id, enrollmentLogicalId: p.enrollment_logical_id,
                    nature: { valueId: p.nature_value_id, version: p.nature_version, label: "" },
                    validFrom: p.valid_from, validUntil: validOn, changeReason: "Encerramento da participação",
                  }), "Participação encerrada.")}>Encerrar em {fmt(validOn)}</Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canMaintain && (d.natures.length === 0
          ? <Unavailable>Declarar participação indisponível: nenhuma natureza de participação homologada.</Unavailable>
          : (
            <div className="flex flex-wrap gap-2">
              <select aria-label="Inscrição" className="h-9 rounded-md border border-input bg-background px-2" value={enrollment} onChange={(e) => setEnrollment(e.target.value)}>
                <option value="">Inscrição…</option>
                {d.enrollments.map((e) => <option key={e.logical_id} value={e.logical_id}>{e.student_id} · {e.academic_year_id}</option>)}
              </select>
              <select aria-label="Natureza" className="h-9 rounded-md border border-input bg-background px-2" value={nature} onChange={(e) => setNature(e.target.value)}>
                <option value="">Natureza…</option>
                {d.natures.map((n) => <option key={n.valueId} value={n.valueId}>{n.label}</option>)}
              </select>
              <Button size="sm" disabled={!enrollment || !nature} onClick={() => run(() => declareCycleParticipation({
                logicalId: newId("part"), baseVersionId: null, enrollmentLogicalId: enrollment,
                nature: d.natures.find((n) => n.valueId === nature)!, validFrom: validOn,
              }), "Participação declarada.")}>Declarar desde {fmt(validOn)}</Button>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

function AllocationSection({ d, validOn, canMaintain, canCapacity, run }: { d: Data; validOn: string; canMaintain: boolean; canCapacity: boolean; run: Run }) {
  const [participation, setParticipation] = useState("");
  const [cls, setCls] = useState("");
  const [allocEnd, setAllocEnd] = useState("");
  const [limit, setLimit] = useState("");
  const enrollmentYear = (pl: string) => {
    const p = d.participations.find((x) => x.logical_id === pl);
    return d.enrollments.find((e) => e.logical_id === p?.enrollment_logical_id)?.academic_year_id ?? null;
  };
  const cap = useQuery({
    queryKey: ["b3", "capacity", cls, validOn],
    enabled: Boolean(cls),
    queryFn: () => readCapacityOccupancy(cls, { validOn }),
  });
  return (
    <Card>
      <CardHeader><CardTitle>Alocações em turma vigentes</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        {d.allocations.length === 0 ? <p className="text-muted-foreground">Nenhuma alocação registrada vigente nesta data.</p> : (
          <ul className="space-y-1">
            {d.allocations.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2">
                <span>{a.student_id} · turma {a.class_id} · desde {fmt(a.valid_from)}{a.ended_on ? ` até ${fmt(a.ended_on)}` : ""}</span>
                {canMaintain && (
                  <Button size="sm" variant="outline" onClick={() => run(() => recordClassAllocationEnding({
                    allocationLogicalId: a.logical_id, baseVersionId: a.ending_version_id, endedOn: validOn,
                    correctionReason: a.ending_version_id ? "Retificação do término" : null,
                  }), "Alocação encerrada.")}>Encerrar em {fmt(validOn)}</Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canMaintain && (
          <div className="flex flex-wrap gap-2">
            <select aria-label="Participação" className="h-9 rounded-md border border-input bg-background px-2" value={participation} onChange={(e) => setParticipation(e.target.value)}>
              <option value="">Participação…</option>
              {d.participations.map((p) => <option key={p.logical_id} value={p.logical_id}>{p.student_id} · {p.nature_value_id}</option>)}
            </select>
            <select aria-label="Turma" className="h-9 rounded-md border border-input bg-background px-2" value={cls} onChange={(e) => setCls(e.target.value)}>
              <option value="">Turma…</option>
              {d.classes.filter((c) => !participation || c.academic_year_id === enrollmentYear(participation)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <DateInput aria-label="Término da alocação (opcional)" className="w-44" value={allocEnd} onChange={(e) => setAllocEnd(e.target.value)} />
            <Button size="sm" disabled={!participation || !cls} onClick={() => run(() => recordClassAllocation({
              id: newId("aloc"), participationLogicalId: participation, classId: cls, validFrom: validOn,
              endedOn: allocEnd || null,
            }), "Alocação registrada.")}>Alocar desde {fmt(validOn)}{allocEnd ? ` até ${fmt(allocEnd)}` : ""}</Button>
          </div>
        )}
        {cls && (
          <div className="rounded-md border border-border p-3">
            <h3 className="font-medium">Capacidade e ocupação da turma {cls} em {fmt(validOn)}</h3>
            {cap.error ? <p>{b3Message(cap.error)}</p> : cap.data && (
              <p>
                {(() => {
                  const av = deriveAvailability(cap.data);
                  return av.kind === "desconhecida"
                    ? `Capacidade: não registrada · Ocupação: ${av.occupancy} alocação(ões) vigente(s) · Vagas: desconhecidas (sem capacidade registrada não há como calcular).`
                    : `Capacidade registrada: ${av.limit} · Ocupação: ${av.occupancy} · Vagas derivadas: ${av.remaining}${av.exceededBy ? ` · ocupação acima da capacidade em ${av.exceededBy}` : ""}.`;
                })()}
                {" "}Nenhum efeito por lotação é aplicado sem política homologada.
              </p>
            )}
            {canCapacity && (
              <div className="mt-2 flex gap-2">
                <Input aria-label="Limite de referência" type="number" min={0} className="w-32" value={limit} onChange={(e) => setLimit(e.target.value)} />
                <Button size="sm" variant="outline" disabled={limit === ""} onClick={() => run(() => recordClassCapacity({
                  logicalId: newId("cap"), baseVersionId: null, classId: cls, referenceLimit: Number(limit), validFrom: validOn,
                }), "Capacidade registrada.")}>Registrar capacidade desde {fmt(validOn)}</Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function SearchSection({ d, validOn }: { d: Data; validOn: string }) {
  const [text, setText] = useState("");
  const [cls, setCls] = useState("");
  const [year, setYear] = useState("");
  const [situation, setSituation] = useState<OperationalSituation | "">("");
  const [student, setStudent] = useState<string | null>(null);
  const rows = filterSecretaryRows(secretaryRows(validOn, d.history), {
    text, classId: cls || undefined, academicYearId: year || undefined, situation: situation || undefined,
  });
  const className = (id: string) => d.classes.find((c) => c.id === id)?.name ?? id;
  const trajectory = student ? buildTrajectory(student, d.history) : [];
  return (
    <Card>
      <CardHeader><CardTitle>Busca da Secretaria em {fmt(validOn)}</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <Input aria-label="Buscar estudante" placeholder="Estudante…" className="w-56" value={text} onChange={(e) => setText(e.target.value)} />
          <select aria-label="Turma" className="h-9 rounded-md border border-input bg-background px-2" value={cls} onChange={(e) => setCls(e.target.value)}>
            <option value="">Todas as turmas</option>
            {d.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select aria-label="Ano letivo" className="h-9 rounded-md border border-input bg-background px-2" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">Todos os anos</option>
            {d.years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
          <select aria-label="Situação na data" className="h-9 rounded-md border border-input bg-background px-2" value={situation} onChange={(e) => setSituation(e.target.value as OperationalSituation | "")}>
            <option value="">Qualquer situação</option>
            {(Object.keys(SITUATION_LABEL) as OperationalSituation[]).map((k) => <option key={k} value={k}>{SITUATION_LABEL[k]}</option>)}
          </select>
        </div>
        {d.history.enrollments.length === 0 ? <p className="text-muted-foreground">Nenhuma inscrição letiva registrada nesta escola.</p>
          : rows.length === 0 ? <p className="text-muted-foreground">Nenhum resultado para os filtros escolhidos.</p> : (
          <ul className="space-y-1">
            {rows.map((r) => (
              <li key={r.enrollmentLogicalId} className="flex flex-wrap items-center gap-2">
                <span>{r.studentId} · ano {r.academicYearId ?? "não registrado"} · {SITUATION_LABEL[r.situation]}{r.classIds.length ? ` · ${r.classIds.map(className).join(", ")}` : ""}</span>
                <Button size="sm" variant="ghost" onClick={() => setStudent(r.studentId)} aria-pressed={student === r.studentId}>Trajetória</Button>
              </li>
            ))}
          </ul>
        )}
        {student && (
          <div className="rounded-md border border-border p-3">
            <h3 className="font-medium">Trajetória de {student}</h3>
            {trajectory.length === 0 ? <p className="text-muted-foreground">Nenhum fato datado registrado.</p> : (
              <ol className="mt-2 space-y-1">
                {trajectory.map((t, i) => (
                  <li key={`${t.ref}-${t.kind}-${i}`}>
                    {fmt(t.date)} · {TRAJECTORY_LABEL[t.kind]}
                    {Object.entries(t.detail).filter(([, v]) => v !== null && v !== "").map(([k, v]) => ` · ${k}: ${v}`).join("")}
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Correções aparecem como nova versão; nada é apagado.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MovementSection({ d, school, validOn, canRegister, run }: { d: Data; school: string; validOn: string; canRegister: boolean; run: Run }) {
  const [enrollment, setEnrollment] = useState("");
  const [type, setType] = useState("");
  const [destination, setDestination] = useState("");
  const [reason, setReason] = useState("");
  const [fix, setFix] = useState<{ row: MovementRow; date: string; reason: string } | null>(null);
  const enr = d.history.enrollments.find((e) => e.logical_id === enrollment);
  const typeOf = (id: string) => d.movementTypes.find((t) => t.valueId === id);
  return (
    <Card>
      <CardHeader><CardTitle>Movimentações</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">Movimentação é registro próprio: não apaga nem encerra a inscrição de origem. Transferência entre escolas: encerre a inscrição na origem e constitua nova no destino.</p>
        {d.history.movements.length === 0 ? <p className="text-muted-foreground">Nenhuma movimentação registrada para esta escola.</p> : (
          <ul className="space-y-1">
            {d.history.movements.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2">
                <span>{fmt(m.effective_on)} · {m.student_id} · {typeOf(m.movement_type_id)?.label ?? m.movement_type_id} v{m.version}{m.correction_reason ? ` · retificada: ${m.correction_reason}` : ""}</span>
                {canRegister && <Button size="sm" variant="ghost" onClick={() => setFix({ row: m, date: m.effective_on, reason: "" })}>Retificar data</Button>}
              </li>
            ))}
          </ul>
        )}
        {fix && (
          <div className="flex flex-wrap gap-2 rounded-md border border-border p-2">
            <DateInput aria-label="Nova data de efeito" value={fix.date} onChange={(e) => setFix({ ...fix, date: e.target.value })} />
            <Input aria-label="Motivo da retificação" className="w-64" placeholder="Motivo da retificação" value={fix.reason} onChange={(e) => setFix({ ...fix, reason: e.target.value })} />
            <Button size="sm" disabled={!fix.date || !fix.reason.trim() || !typeOf(fix.row.movement_type_id)} onClick={() => run(() => recordStudentMovement({
              logicalId: fix.row.logical_id, baseVersionId: fix.row.id, studentId: fix.row.student_id, enrollmentId: fix.row.enrollment_id,
              type: typeOf(fix.row.movement_type_id)!, effectiveOn: fix.date,
              origin: (fix.row.origin ?? {}) as Record<string, string>, destination: (fix.row.destination ?? {}) as Record<string, string>,
              reasonCode: fix.row.reason_code, reasonText: fix.row.reason_text, actRef: fix.row.originating_act_ref, correctionReason: fix.reason,
            }).then(() => setFix(null)), "Retificação registrada como nova versão.")}>Gravar retificação</Button>
            <Button size="sm" variant="outline" onClick={() => setFix(null)}>Cancelar</Button>
            {!typeOf(fix.row.movement_type_id) && <Unavailable>O tipo desta movimentação não está homologado na data atual; retificação indisponível.</Unavailable>}
          </div>
        )}
        {!canRegister ? <Unavailable>Sua atuação não pode registrar movimentação nesta escola.</Unavailable>
          : d.movementTypes.length === 0 ? <Unavailable>Nenhum tipo de movimentação homologado; o registro fica indisponível até a rede homologar os tipos.</Unavailable>
          : (
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <select aria-label="Inscrição" className="h-9 rounded-md border border-input bg-background px-2" value={enrollment} onChange={(e) => setEnrollment(e.target.value)}>
                <option value="">Inscrição…</option>
                {d.history.enrollments.map((e) => <option key={e.logical_id} value={e.logical_id}>{e.student_id} · {e.academic_year_id}</option>)}
              </select>
              <select aria-label="Tipo de movimentação" className="h-9 rounded-md border border-input bg-background px-2" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">Tipo…</option>
                {d.movementTypes.map((t) => <option key={t.valueId} value={t.valueId}>{t.label}</option>)}
              </select>
              <Input aria-label="Escola de destino na rede (opcional)" placeholder="Escola de destino (opcional)" className="w-56" value={destination} onChange={(e) => setDestination(e.target.value)} />
              <Input aria-label="Motivo (opcional)" placeholder="Motivo (opcional)" className="w-56" value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button size="sm" disabled={!enr || !type} onClick={() => run(() => recordStudentMovement({
                logicalId: newId("mov"), baseVersionId: null, studentId: enr!.student_id, enrollmentId: enr!.id,
                type: typeOf(type)!, effectiveOn: validOn, origin: { schoolId: school },
                destination: destination.trim() ? { schoolId: destination.trim() } : {}, reasonText: reason.trim() || null,
              }), "Movimentação registrada.")}>Registrar com efeito em {fmt(validOn)}</Button>
            </div>
          )}
        <Unavailable>{allocationMoveAvailability().reason}</Unavailable>
      </CardContent>
    </Card>
  );
}
