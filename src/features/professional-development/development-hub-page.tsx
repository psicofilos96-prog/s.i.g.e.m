/** SIGEM Desenvolvimento L03 — painel, catálogo, turmas e agenda. Lê só após a sessão, pela RLS; não grava. */
import { useEffect, useMemo, useState } from "react";
import { SkeletonState } from "@/components/sigem/guidance";
import { PageHeader } from "@/components/sigem/patterns";
import { SignInRequired } from "@/components/sigem/sign-in-required";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { supabase } from "@/integrations/supabase/client";
import { EMPTY_FILTER, FUNCTION_FILTER_UNAVAILABLE, buildHub, type HubFilter, type HubInput } from "./development-hub-model";

const LIMIT = 1000;
const TABS = [["painel", "Painel"], ["catalogo", "Catálogo"], ["turmas", "Turmas"], ["agenda", "Agenda"]] as const;
type Tab = (typeof TABS)[number][0];

function useHubData() {
  const [s, setS] = useState<{ input?: HubInput; truncated?: boolean; err?: string } | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const [p, c, v, k, e, ev, ce, l] = await Promise.all([
        supabase.from("dev_programs").select("id, title").limit(LIMIT),
        supabase.from("dev_courses").select("id, program_id").limit(LIMIT),
        supabase.from("dev_course_versions").select("id, course_id, version, title, hours_minutes, min_attendance_pct").limit(LIMIT),
        supabase.from("dev_classes").select("id, course_version_id, school_id, label, seats, starts_on, ends_on").order("starts_on", { ascending: false }).limit(LIMIT),
        supabase.from("dev_enrollments").select("id, class_id, person_id, functional_link_id").limit(LIMIT),
        supabase.from("dev_participation_events").select("enrollment_id, seq, kind, attendance_pct").limit(LIMIT),
        supabase.from("dev_certifications").select("enrollment_id, created_at").limit(LIMIT),
        supabase.from("professional_functional_links").select("id, position_id").limit(LIMIT),
      ]);
      if (!live) return;
      if (p.error || c.error || v.error || k.error || e.error || ev.error || ce.error) { setS({ err: "Dados de formação não disponíveis para a sua conta." }); return; }
      const lens = [p, c, v, k, e, ev, ce].map((r) => r.data?.length ?? 0);
      setS({
        truncated: lens.some((n) => n >= LIMIT),
        input: {
          programs: (p.data ?? []).map((r) => ({ id: r.id, title: r.title })),
          courses: (c.data ?? []).map((r) => ({ id: r.id, programId: r.program_id })),
          versions: (v.data ?? []).map((r) => ({ id: r.id, courseId: r.course_id, version: r.version, title: r.title, hoursMinutes: r.hours_minutes, minAttendancePct: r.min_attendance_pct == null ? null : Number(r.min_attendance_pct) })),
          classes: (k.data ?? []).map((r) => ({ id: r.id, courseVersionId: r.course_version_id, schoolId: r.school_id, label: r.label, seats: r.seats, startsOn: r.starts_on, endsOn: r.ends_on })),
          enrollments: (e.data ?? []).map((r) => ({ id: r.id, classId: r.class_id, personId: r.person_id, functionalLinkId: r.functional_link_id })),
          events: (ev.data ?? []).map((r) => ({ enrollmentId: r.enrollment_id, seq: r.seq, kind: r.kind as never, attendancePct: r.attendance_pct == null ? null : Number(r.attendance_pct) })),
          certs: (ce.data ?? []).map((r) => ({ enrollmentId: r.enrollment_id, createdAt: r.created_at })),
          links: l.error ? null : (l.data ?? []).map((r) => ({ id: r.id, positionId: r.position_id })),
        },
      });
    })();
    return () => { live = false; };
  }, []);
  return s;
}

export function DevelopmentHubPage() {
  const a = useSessionAuthority();
  if (a.status === "signed-out") return <SignInRequired title="SIGEM Desenvolvimento" what="a formação continuada" />;
  if (a.status === "loading") return <SkeletonState label="Verificando sua sessão" />;
  return <Hub />;
}

const hours = (m: number | null) => (m == null ? "não configurada" : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`);
const fmt = (n: number | null) => (n == null ? "não informado" : String(n));

function Hub() {
  const data = useHubData();
  const [tab, setTab] = useState<Tab>("painel");
  const [f, setF] = useState<HubFilter>(EMPTY_FILTER);
  const today = new Date().toISOString().slice(0, 10);
  const view = useMemo(() => (data?.input ? buildHub(data.input, f, today) : null), [data, f, today]);
  const sel = "min-h-11 rounded-md border bg-background px-2 text-sm";

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="SIGEM" title="SIGEM Desenvolvimento" description="Formação continuada: catálogo, turmas, inscrições, conclusões e certificados, só com dados registrados." />
      {!data ? <SkeletonState label="Carregando formação" /> : data.err ? <p role="alert" className="text-destructive">{data.err}</p> : view && (
        <>
          <fieldset className="flex flex-wrap gap-2" aria-label="Filtros">
            <select aria-label="Ano" className={sel} value={f.year ?? ""} onChange={(e) => setF({ ...f, year: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Todos os anos</option>{view.options.years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
            <select aria-label="Escola" className={sel} value={f.schoolId ?? ""} onChange={(e) => setF({ ...f, schoolId: e.target.value || null })}>
              <option value="">Todas as escolas</option>{view.options.schools.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <select aria-label="Programa" className={sel} value={f.programId ?? ""} onChange={(e) => setF({ ...f, programId: e.target.value || null })}>
              <option value="">Todos os programas</option>{view.options.programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
            <select aria-label="Cargo" className={sel} disabled={!view.options.positions} value={f.positionId ?? ""} onChange={(e) => setF({ ...f, positionId: e.target.value || null })}>
              <option value="">{view.options.positions ? "Todos os cargos" : "Cargo não visível"}</option>{(view.options.positions ?? []).map((p) => <option key={p} value={p}>{p}</option>)}</select>
            <select aria-label="Função" className={sel} disabled title={FUNCTION_FILTER_UNAVAILABLE}><option>Função: sem fonte</option></select>
          </fieldset>
          {view.notes.map((n) => <p key={n} className="text-xs text-muted-foreground">{n}</p>)}
          {data.truncated && <p className="text-xs text-muted-foreground">Mostrando até {LIMIT} registros por tipo; o total pode ser maior.</p>}

          <div role="tablist" aria-label="Seções" className="flex flex-wrap gap-2">{TABS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-11 rounded-md border px-3 py-1.5 text-sm ${tab === k ? "bg-primary text-primary-foreground" : ""}`}>{l}</button>))}</div>

          {tab === "painel" && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {([["Turmas", view.totals.classes], ["Inscrições", view.totals.enrolled], ["Vagas livres", view.totals.seatsLeft], ["Conclusões", view.totals.concluded], ["Certificados", view.totals.certified]] as const).map(([l, n]) => (
                <div key={l} className="rounded-md border p-3"><dt className="text-xs text-muted-foreground">{l}</dt><dd className="text-2xl font-semibold">{fmt(n)}</dd></div>))}
            </dl>)}

          {tab === "catalogo" && (view.catalog.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum curso registrado.</p> : (
            <ul className="divide-y rounded-md border">{view.catalog.map((c) => (
              <li key={c.courseId} className="p-3 text-sm"><p className="font-medium">{c.title} <span className="text-xs text-muted-foreground">v{c.version}</span></p>
                <p className="text-xs text-muted-foreground">{c.programTitle ?? "Programa não visível"} · carga {hours(c.hoursMinutes)}</p></li>))}</ul>))}

          {tab === "turmas" && (view.classes.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma turma registrada.</p> : (
            <ul className="divide-y rounded-md border">{view.classes.map((c) => (
              <li key={c.id} className="grid gap-1 p-3 text-sm sm:grid-cols-[2fr_1fr_1fr_1fr]">
                <div><p className="font-medium">{c.label}</p><p className="text-xs text-muted-foreground">{c.courseTitle} · {c.startsOn} a {c.endsOn}{c.schoolId ? ` · ${c.schoolId}` : " · rede"}</p></div>
                <p>Vagas: {c.seats == null ? "não configuradas" : `${c.seatsLeft} livres de ${c.seats}`}</p>
                <p>Inscrições: {c.enrolled}</p>
                <p>Concluídas: {c.concluded} · Certificados: {c.certified}</p>
              </li>))}</ul>))}

          {tab === "agenda" && (view.agenda.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma data futura registrada.</p> : (
            <ul className="divide-y rounded-md border">{view.agenda.map((a) => (
              <li key={`${a.classId}-${a.kind}`} className="flex justify-between p-3 text-sm"><span>{a.label} — {a.kind === "inicio" ? "início" : "término"}</span><time dateTime={a.date}>{a.date}</time></li>))}</ul>))}
        </>
      )}
    </div>
  );
}
