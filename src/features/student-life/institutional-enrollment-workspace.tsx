/**
 * B3 — Interface institucional de inscrição letiva, participação, alocação,
 * capacidade/ocupação e movimentação. Só renderizada com sessão (gate na rota);
 * lê pelos readers bitemporais e grava pelos escritores do banco. Operações
 * cuja norma não está homologada aparecem desabilitadas com o motivo.
 */
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
  recordClassAllocationEnding, recordClassCapacity, recordCycleEnrollmentEnding, type CatalogValue,
} from "./cycle-enrollment-source";

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

  const key = ["b3", activeSchool, validOn];
  const data = useQuery({
    queryKey: key,
    enabled: Boolean(activeSchool),
    queryFn: async () => {
      const t = { validOn, knownAt: null };
      const [enrollments, participations, allocations, natures, bondStatuses, movementTypes, years, classes] = await Promise.all([
        readCycleEnrollments(activeSchool, t),
        readCycleParticipations(activeSchool, t),
        readClassAllocations({ school: activeSchool }, t),
        homologatedValues(PARTICIPATION_NATURE_SCHEME, validOn),
        homologatedValues(BOND_STATUS_SCHEME, validOn),
        homologatedMovementTypes(validOn),
        supabase.from("institutional_academic_year_versions").select("academic_year_id, official_name, version, valid_from, is_active"),
        supabase.from("institutional_classes").select("id, academic_year_id").eq("school_id", activeSchool),
      ]);
      if (years.error) throw new Error(years.error.message);
      if (classes.error) throw new Error(classes.error.message);
      return {
        enrollments, participations, allocations, natures, bondStatuses, movementTypes,
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

  if (authority.status === "loading") return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!schools.length) return <Unavailable>Sua atuação não tem capacidade de consultar ou manter matrícula em nenhuma escola.</Unavailable>;
  const d = data.data;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Matrícula, participação e enturmação</h1>
        <p className="text-sm text-muted-foreground">Fonte institucional. Datas explícitas; ausência permanece ausência.</p>
      </header>
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
      </div>
      {feedback && <p role="status" className="text-sm">{feedback}</p>}
      {data.error && <Unavailable>Fonte indisponível: {b3Message(data.error)}</Unavailable>}
      {d && (
        <>
          {focus === "matriculas" && <EnrollmentSection d={d} school={activeSchool} validOn={validOn} canMaintain={canMaintain} run={run} />}
          {focus !== "movimentacoes" && <ParticipationSection d={d} validOn={validOn} canMaintain={canMaintain} run={run} />}
          {focus === "enturmacoes" && <AllocationSection d={d} validOn={validOn} canMaintain={canMaintain} canCapacity={capacity.has(activeSchool)} run={run} />}
          {focus === "movimentacoes" && (
            <Card>
              <CardHeader><CardTitle>Movimentação</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {d.movementTypes.length === 0
                  ? <Unavailable>Nenhum tipo de movimentação homologado; o registro de movimentação está indisponível.</Unavailable>
                  : <p className="text-sm">{d.movementTypes.length} tipo(s) homologado(s). {movement.has(activeSchool) ? "" : "Sua atuação não pode registrar movimentação nesta escola."}</p>}
                <Unavailable>{allocationMoveAvailability().reason}</Unavailable>
                <p className="text-sm text-muted-foreground">Transferência entre escolas: encerre a inscrição na origem e constitua nova inscrição no destino; a mesma inscrição nunca muda de escola.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

type Data = {
  enrollments: Awaited<ReturnType<typeof readCycleEnrollments>>;
  participations: Awaited<ReturnType<typeof readCycleParticipations>>;
  allocations: Awaited<ReturnType<typeof readClassAllocations>>;
  natures: CatalogValue[]; bondStatuses: CatalogValue[]; movementTypes: CatalogValue[];
  years: { id: string; name: string }[]; classes: { id: string; academic_year_id: string }[];
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
              {d.classes.filter((c) => !participation || c.academic_year_id === enrollmentYear(participation)).map((c) => <option key={c.id} value={c.id}>{c.id}</option>)}
            </select>
            <Button size="sm" disabled={!participation || !cls} onClick={() => run(() => recordClassAllocation({
              id: newId("aloc"), participationLogicalId: participation, classId: cls, validFrom: validOn,
            }), "Alocação registrada.")}>Alocar desde {fmt(validOn)}</Button>
          </div>
        )}
        {cls && (
          <div className="rounded-md border border-border p-3">
            <h3 className="font-medium">Capacidade e ocupação da turma {cls} em {fmt(validOn)}</h3>
            {cap.error ? <p>{b3Message(cap.error)}</p> : cap.data && (
              <p>
                Capacidade de referência: {cap.data.capacity.status === "registrada" ? cap.data.capacity.referenceLimit : "não registrada (desconhecida)"} ·
                Ocupação derivada: {cap.data.occupancy} alocação(ões) vigente(s). Nenhum efeito por lotação é aplicado sem política homologada.
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
