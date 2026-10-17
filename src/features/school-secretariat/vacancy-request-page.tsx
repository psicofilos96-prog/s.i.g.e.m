import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PageHeader, EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/sigem/date-input";
import { callRpc } from "@/lib/rpc-call";
import { operationalToday } from "@/lib/academic-date";
import { institution } from "@/config/institution";
import { downloadBlob, runReport, toPdfFile, toXlsx } from "@/features/reports/report-engine";
import { useOwnSchoolId } from "@/features/authority/own-school";
import { OwnSchoolName } from "@/features/authority/own-school-field";
import {
  ALLOWED, defaultDueOn, isOpen, queuePositions, queueReportRows, requestState, SHIFT_OPTIONS, STAGE_OPTIONS, STATE_LABEL,
  VACANCY_QUEUE_REPORT, VACANCY_REQUEST_MESSAGES, type VacancyRequestAction, type VacancyRequestRow,
} from "./vacancy-request-bank";

const msg = (e: unknown): string => {
  const m = e instanceof Error ? e.message : String(e);
  const k = Object.keys(VACANCY_REQUEST_MESSAGES).find((x) => m.includes(x));
  return (k && VACANCY_REQUEST_MESSAGES[k]) || "Não foi possível concluir. Tente de novo.";
};
const br = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");
const TONE = { aguardando: "info", convocada: "warning", matriculada: "success", desistiu: "neutral", "nao-compareceu": "neutral", cancelada: "neutral" } as const;
const ACTION_LABEL: Record<VacancyRequestAction, string> = {
  convocar: "Convocar", matriculado: "Matriculado", "nao-compareceu": "Não compareceu", desistiu: "Desistiu", cancelar: "Cancelar", "voltar-a-fila": "Voltar à fila",
};

export function VacancyRequestPage() {
  const school = useOwnSchoolId();
  const thisYear = operationalToday().slice(0, 4);
  const [year, setYear] = useState(thisYear);
  const [rows, setRows] = useState<VacancyRequestRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"abertos" | "todos">("abertos");
  const load = () => { setRows(null); setErr(null); callRpc<VacancyRequestRow[]>("secretariat_own_vacancy_requests", { _year: year }).then((r) => setRows(r ?? []), (e) => setErr(msg(e))); };
  useEffect(() => { if (school) load(); }, [school, year]); // eslint-disable-line react-hooks/exhaustive-deps

  const pos = useMemo(() => queuePositions(rows ?? []), [rows]);
  const shown = useMemo(() => (rows ?? []).filter((r) => filter === "todos" || isOpen(requestState(r.last_action))), [rows, filter]);
  const exportFile = async (kind: "pdf" | "xlsx") => {
    const rep = runReport(VACANCY_QUEUE_REPORT, { params: {} }, queueReportRows(shown));
    const brand = { headerLines: [institution.governmentName, institution.departmentName], title: "Fila de solicitações de vaga" };
    const meta = [`Ano ${year}`, "Ordem de protocolo (padrão do sistema). Pedido não é matrícula nem promessa de vaga."];
    if (kind === "xlsx") return downloadBlob(`fila-de-vagas-${year}.xlsx`, new Blob([await toXlsx(rep, brand, meta)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    downloadBlob(`fila-de-vagas-${year}.pdf`, await toPdfFile(rep, brand, meta));
  };

  if (!school) return <EmptyState title="Entre com a conta da Secretaria da escola" description="A fila de vagas é sempre da própria escola." />;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Secretaria Escolar" title="Fila de vagas"
        description="Pedidos de vaga da escola. Quando abrir vaga, convoque o primeiro da etapa e siga para a matrícula." />
      <div className="flex flex-wrap items-end gap-3">
        <OwnSchoolName schoolId={school} />
        <label className="text-sm">Ano
          <select className="mt-1 block rounded-md border border-input bg-background p-2" value={year} onChange={(e) => setYear(e.target.value)}>
            {[String(+thisYear), String(+thisYear + 1)].map((y) => <option key={y}>{y}</option>)}
          </select>
        </label>
        <label className="text-sm">Mostrar
          <select className="mt-1 block rounded-md border border-input bg-background p-2" value={filter} onChange={(e) => setFilter(e.target.value as "abertos" | "todos")}>
            <option value="abertos">Só na fila</option><option value="todos">Todos</option>
          </select>
        </label>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" disabled={!shown.length} onClick={() => exportFile("xlsx")}>Excel</Button>
          <Button variant="outline" disabled={!shown.length} onClick={() => exportFile("pdf")}>PDF</Button>
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Fechar" : "Novo pedido"}</Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Ordem: data e hora do protocolo, separada por etapa — <strong>Padrão do sistema</strong>.</p>
      {showForm && <NewRequestForm year={year} onDone={() => { setShowForm(false); load(); }} />}
      {err ? <StatePanel tone="danger" title="Não foi possível ler a fila" description={err} />
        : rows === null ? <SkeletonState label="Carregando" />
        : shown.length === 0 ? <EmptyState title="Nenhum pedido" description="Use “Novo pedido” para registrar quem procura vaga." />
        : (
          <ul className="space-y-3">
            {shown.map((r) => <RequestCard key={r.id} r={r} position={pos.get(r.id)} onChanged={load} />)}
          </ul>
        )}
    </div>
  );
}

function RequestCard({ r, position, onChanged }: { r: VacancyRequestRow; position: number | undefined; onChanged: () => void }) {
  const st = requestState(r.last_action);
  const [act, setAct] = useState<VacancyRequestAction | null>(null);
  const [due, setDue] = useState(defaultDueOn(operationalToday()));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const send = async () => {
    if (!act) return; setBusy(true); setErr(null);
    try { await callRpc("secretariat_vacancy_request_act", { _request: r.id, _action: act, _due: act === "convocar" ? due : null, _note: note, _expected_seq: r.last_seq }); setAct(null); setNote(""); onChanged(); }
    catch (e) { setErr(msg(e)); } finally { setBusy(false); }
  };
  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{position ? `${position}º · ` : ""}{r.student_name}</p>
          <p className="text-sm text-muted-foreground">{r.desired_stage}{r.desired_shift ? ` · ${r.desired_shift}` : ""} · nasc. {br(r.student_birth_date)} · protocolo {r.protocol_code} em {br(r.recorded_at)}</p>
          <p className="text-sm text-muted-foreground">Responsável: {r.guardian_name}{r.guardian_phone ? ` · ${r.guardian_phone}` : ""}</p>
          {st === "convocada" && r.due_on && <p className="text-sm">Comparecer até <strong>{br(r.due_on)}</strong></p>}
          {r.last_note && <p className="text-xs text-muted-foreground">Obs.: {r.last_note}</p>}
        </div>
        <StatusBadge tone={TONE[st]}>{STATE_LABEL[st]}</StatusBadge>
      </div>
      {ALLOWED[st].length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {ALLOWED[st].map((a) => <Button key={a} size="sm" variant={act === a ? "default" : "outline"} onClick={() => setAct(act === a ? null : a)}>{ACTION_LABEL[a]}</Button>)}
          {st === "convocada" && <Button size="sm" variant="secondary" asChild><Link to="/matriculas/nova">Fazer a matrícula</Link></Button>}
        </div>
      )}
      {act && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {act === "convocar" && <label className="text-sm">Prazo para comparecer (padrão 5 dias)<DateInput value={due} onChange={(e) => setDue(e.target.value)} /></label>}
          <label className="text-sm sm:col-span-2">{act === "cancelar" || act === "voltar-a-fila" ? "Motivo" : "Observação (opcional)"}
            <Input className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></label>
          <div className="sm:col-span-3"><Button size="sm" disabled={busy} onClick={send}>Confirmar: {ACTION_LABEL[act]}</Button></div>
          {err && <p className="text-sm text-destructive sm:col-span-3">{err}</p>}
        </div>
      )}
    </li>
  );
}

function NewRequestForm({ year, onDone }: { year: string; onDone: () => void }) {
  const [f, setF] = useState({ stage: "", shift: "", student: "", birth: "", guardian: "", phone: "", note: "" });
  const [key] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const ok = f.stage && f.student.trim().length >= 5 && f.birth && f.guardian.trim().length >= 5;
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await callRpc<{ id: string; protocol_code: string }[]>("secretariat_register_vacancy_request", {
        _year: year, _stage: f.stage, _shift: f.shift, _student_name: f.student, _birth: f.birth, _guardian_name: f.guardian, _phone: f.phone, _note: f.note, _key: key });
      setDone(r?.[0]?.protocol_code ?? "");
    } catch (e) { setErr(msg(e)); } finally { setBusy(false); }
  };
  if (done !== null) return (
    <StatePanel tone="success" title={`Pedido registrado — protocolo ${done}`}
      description="Informe o número ao responsável. Pedido não é matrícula nem garante vaga."
      action={<Button onClick={onDone}>Voltar à fila</Button>} />
  );
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <section aria-label="Novo pedido" className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
      <label className="text-sm">Etapa pretendida
        <select className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={f.stage} onChange={set("stage")}>
          <option value="">Escolha</option>{STAGE_OPTIONS.map((s) => <option key={s}>{s}</option>)}
        </select></label>
      <label className="text-sm">Turno de preferência
        <select className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={f.shift} onChange={set("shift")}>
          <option value="">Sem preferência</option>{SHIFT_OPTIONS.map((s) => <option key={s}>{s}</option>)}
        </select></label>
      <label className="text-sm">Nome do estudante<Input className="mt-1" value={f.student} onChange={set("student")} /></label>
      <label className="text-sm">Nascimento<DateInput value={f.birth} onChange={set("birth")} /></label>
      <label className="text-sm">Nome do responsável<Input className="mt-1" value={f.guardian} onChange={set("guardian")} /></label>
      <label className="text-sm">Telefone (com DDD)<Input className="mt-1" inputMode="numeric" value={f.phone} onChange={set("phone")} /></label>
      <label className="text-sm sm:col-span-2">Observação<Input className="mt-1" value={f.note} onChange={set("note")} maxLength={500} /></label>
      {err && <p className="text-sm text-destructive sm:col-span-2">{err}</p>}
      <div className="sm:col-span-2"><Button disabled={!ok || busy} onClick={save}>Registrar pedido</Button></div>
    </section>
  );
}
