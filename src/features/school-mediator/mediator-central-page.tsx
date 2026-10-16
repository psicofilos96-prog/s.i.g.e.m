import { humanizeForScreen } from "@/config/technical-codes";
import { operationalToday } from "@/lib/academic-date";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { callRpc } from "@/lib/rpc-call";
import { supabase } from "@/integrations/supabase/client";
import { AbsenceState, ErrorState, LoadingState } from "@/components/sigem/states";
import { recoverDraft } from "@/features/teacher-diary/teacher-ux-robustness";
import type { MediatedStudent } from "./mediator-panel";
import { currentGuidance, submitAvailability, validateSupport, DRAFT_KEY, QUICK_TABS, type InclusionRecordRow, type SupportKind } from "./mediator-central";

const today = () => operationalToday();
type Load = { kind: "loading" } | { kind: "error" } | { kind: "denied" } | { kind: "ok"; student: MediatedStudent; rows: InclusionRecordRow[] | null };

export function MediatorCentralPage({ studentId }: { studentId: string }) {
  const [date] = useState(today);
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [tab, setTab] = useState<(typeof QUICK_TABS)[number]["id"]>("orientacao");
  const [account, setAccount] = useState<string | null>(null);
  const [kind, setKind] = useState<SupportKind>("apoio");
  const [note, setNote] = useState("");
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (alive) setAccount(data.user?.id ?? null);
        const list = await callRpc<MediatedStudent[]>("inclusion_my_mediated_students", { _on: date });
        const s = (list ?? []).find((x) => x.student_id === studentId);
        if (!s) { if (alive) setLoad({ kind: "denied" }); return; }
        let rows: InclusionRecordRow[] | null = null;
        try { rows = await callRpc<InclusionRecordRow[]>("inclusion_records_at", { _school: s.school_id, _student: studentId, _known_at: new Date().toISOString(), _logical_id: null }); } catch { rows = null; }
        if (alive) setLoad({ kind: "ok", student: s, rows });
      } catch { if (alive) setLoad({ kind: "error" }); }
    })();
    return () => { alive = false; };
  }, [date, studentId]);

  useEffect(() => {
    if (!account || restored) return;
    const d = recoverDraft<{ kind: SupportKind; note: string }>(sessionStorage.getItem(DRAFT_KEY(account, studentId)), account, studentId, null);
    if (d.draft) { setKind(d.draft.payload.kind); setNote(d.draft.payload.note); }
    setRestored(true);
  }, [account, studentId, restored]);

  useEffect(() => {
    if (!account || !restored) return;
    const t = setTimeout(() => sessionStorage.setItem(DRAFT_KEY(account, studentId), JSON.stringify({ accountId: account, contextKey: studentId, baseVersion: null, savedAt: new Date().toISOString(), payload: { kind, note } })), 400);
    return () => clearTimeout(t);
  }, [account, studentId, kind, note, restored]);

  if (load.kind === "loading") return <LoadingState label="Abrindo acompanhamento…" />;
  if (load.kind === "error") return <ErrorState description="Não foi possível ler suas designações." />;
  if (load.kind === "denied") return <AbsenceState kind="sem-permissao" title="Sem designação vigente" description="Você só acompanha estudantes com designação vigente nesta data." />;

  const { student, rows } = load;
  const guidance = rows === null ? null : currentGuidance(rows, studentId, date);
  const problems = validateSupport({ kind, categoryId: null, note, context: null, at: "" }, null);
  const submit = submitAvailability(null, [], "registro-diario");

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-24">
      <header className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <p className="truncate text-lg font-semibold text-foreground">{student.student_name}</p>
        <p className="text-sm text-muted-foreground">Turma {student.class_id ?? "não registrada"}{student.valid_to ? ` · designação até ${student.valid_to.split("-").reverse().join("/")}` : ""}</p>
      </header>
      <nav aria-label="Seções do acompanhamento" className="grid grid-cols-4 gap-1">
        {QUICK_TABS.map((t) => (
          <button key={t.id} type="button" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}
            className={`min-h-11 rounded-md border text-sm font-medium ${tab === t.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"}`}>{t.label}</button>
        ))}
      </nav>

      {tab === "contexto" && (
        <section className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
          <p><span className="text-muted-foreground">Escola:</span> {student.school_id}</p>
          <p><span className="text-muted-foreground">Desde:</span> {student.valid_from.split("-").reverse().join("/")}</p>
          <p className="text-muted-foreground">Horário e calendário vêm da grade publicada e do calendário oficial (Minha Agenda).</p>
        </section>
      )}

      {tab === "orientacao" && (guidance === null ? (
        <AbsenceState kind="sem-dado" title="Orientações não disponíveis" description="Não foi possível ler as orientações do NEI agora." />
      ) : guidance.length === 0 ? (
        <AbsenceState kind="nenhum-registro" title="Nenhuma orientação vigente" description="O NEI ainda não partilhou orientação para a mediação." />
      ) : (
        <ul className="space-y-2" aria-live="polite">
          {guidance.map((g) => (
            <li key={g.id} className="rounded-lg border border-border bg-card p-4">
              <p className="text-base text-foreground">{g.text ?? "Conteúdo restrito ao NEI."}</p>
              <p className="mt-1 text-xs text-muted-foreground">Versão {g.version}{g.since ? ` · desde ${g.since.split("-").reverse().join("/")}` : ""}</p>
            </li>
          ))}
        </ul>
      ))}

      {tab === "registrar" && (
        <section className="space-y-3">
          <fieldset className="grid grid-cols-3 gap-1">
            <legend className="sr-only">Tipo de registro</legend>
            {(["apoio", "acessibilidade", "barreira"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
                className={`min-h-11 rounded-md border text-sm capitalize ${kind === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"}`}>{k}</button>
            ))}
          </fieldset>
          <label className="block text-sm font-medium text-foreground" htmlFor="med-note">Observação objetiva (opcional)</label>
          <textarea id="med-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} rows={3}
            className="w-full rounded-md border border-input bg-background p-3 text-base text-foreground placeholder:text-muted-foreground" placeholder="O que foi feito, sem diagnóstico" />
          <ul className="space-y-1 text-sm text-muted-foreground" role="status">{problems.map((p) => <li key={p}>{p}</li>)}<li>{humanizeForScreen(submit.reason)}</li></ul>
          <button type="button" disabled className="min-h-11 w-full rounded-md border border-border text-sm text-muted-foreground">Registrar (indisponível)</button>
          <Link to="/inclusao/nei/apoio" className="flex min-h-11 items-center justify-center rounded-md border border-border bg-card text-sm font-medium text-foreground">Solicitar orientação ao NEI</Link>
        </section>
      )}

      {tab === "historico" && (
        <AbsenceState kind="nenhum-registro" title="Sem registros do mediador" description="O histórico aparecerá quando houver gravação oficial do registro diário." />
      )}
    </div>
  );
}
