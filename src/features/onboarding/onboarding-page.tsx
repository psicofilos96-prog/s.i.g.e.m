import { operationalToday } from "@/lib/academic-date";
import { SkeletonState } from "@/components/sigem/guidance";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/sigem/date-input";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { listSchools, loadSchoolFacts } from "./onboarding-source";
import {
  EMPTY_PROGRESS, STEPS, classChecklist, isReady, loadProgress, pendings, saveProgress, selectSchool, stepStatus,
  type FactState, type Progress, type StepId,
} from "./onboarding-model";

const LABEL: Record<FactState, string> = { sim: "Concluído", nao: "Pendente", "nao-verificavel": "Não verificável" };
const today = () => operationalToday();

export function OnboardingPage() {
  const authority = useSessionAuthority();
  const userId = authority.status === "signed-in" ? authority.user.id : null;
  const [progress, setProgress] = useState<Progress>(EMPTY_PROGRESS);
  const [conflict, setConflict] = useState(false);
  const [validOn, setValidOn] = useState(today());
  useEffect(() => { if (userId) setProgress(loadProgress(localStorage, userId)); }, [userId]);

  const schools = useQuery({ queryKey: ["onboarding-schools", userId], enabled: !!userId, queryFn: listSchools });
  const school = schools.data?.find((s) => s.id === progress.schoolId) ?? null;
  const facts = useQuery({
    queryKey: ["onboarding-facts", userId, progress.schoolId, validOn], enabled: !!userId && !!school && !!validOn,
    queryFn: () => loadSchoolFacts(school!.id, school!.name, validOn),
  });

  function commit(next: Omit<Progress, "v" | "updatedAt">) {
    if (!userId) return;
    const r = saveProgress(localStorage, userId, progress, next);
    setConflict(!r.ok); setProgress(r.progress);
  }
  const go = (step: StepId) => commit({ schoolId: progress.schoolId, step, reviewed: [...progress.reviewed, progress.step] });
  const idx = STEPS.findIndex((s) => s.id === progress.step);
  const step = STEPS[idx]!;
  const status = useMemo(() => Object.fromEntries(STEPS.map((s) => [s.id, stepStatus(s.id, facts.data ?? null)])) as Record<StepId, FactState>, [facts.data]);

  if (authority.status === "signed-out") return <EmptyState title="Entre para configurar uma escola" description="A configuração usa só o que sua conta pode ver e gravar." />;
  if (authority.status === "loading" || schools.isLoading) return <SkeletonState label="Carregando" />;
  if (schools.isError) return <EmptyState title="Não foi possível ler as unidades" description="Tente novamente em instantes." />;

  return (
    <div className="space-y-6">
      <PageHeader title="Configuração inicial da escola" description="Roteiro para preparar a primeira escola. Esta tela só confere fatos e leva à tela oficial de cada cadastro; nada é preenchido automaticamente." />
      {conflict && <p role="alert" className="rounded-md border border-border bg-muted p-3 text-sm">O progresso foi alterado em outra aba; carregamos a versão mais recente.</p>}
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="Etapas"><ol className="space-y-1">
          {STEPS.map((s, i) => (
            <li key={s.id}><button type="button" onClick={() => go(s.id)} aria-current={s.id === step.id ? "step" : undefined}
              className={`w-full rounded-md px-3 py-2 text-left text-sm ${s.id === step.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {i + 1}. {s.title}<span className="block text-xs opacity-80">{school ? LABEL[status[s.id]] : "—"}{progress.reviewed.includes(s.id) ? " · revisada" : ""}</span>
            </button></li>))}
        </ol></nav>

        <section aria-labelledby="etapa" className="min-w-0 space-y-4 rounded-md border border-border p-4">
          <h2 id="etapa" className="text-lg font-semibold">{idx + 1}. {step.title}</h2>
          <p className="text-sm text-muted-foreground">{step.explain}</p>
          <label className="block text-sm">Data de referência<DateInput value={validOn} onChange={(e) => setValidOn(e.target.value)} /></label>

          {step.id === "unidade" ? (
            schools.data!.length === 0 ? <EmptyState title="Nenhuma unidade visível" description="Cadastre a unidade pela tela de unidades, com sua permissão." action={<Link to="/unidades" className="text-primary underline">Ir para unidades</Link>} /> : (
              <ul className="space-y-1">{schools.data!.map((s) => (
                <li key={s.id}><Button variant={s.id === progress.schoolId ? "default" : "outline"} onClick={() => commit(selectSchool(progress, s.id))}>{s.name}</Button></li>))}</ul>)
          ) : !school ? <p className="text-sm">Selecione a unidade na primeira etapa.</p>
            : facts.isLoading ? <p role="status">Conferindo fatos…</p>
            : facts.isError ? <p role="alert">Não foi possível conferir os fatos desta unidade.</p>
            : step.id === "prontidao-diario" || ["matriz", "jornada", "grade", "regencias", "ano-periodos", "turmas", "oferta-turno", "alocacoes-posicoes", "calendario"].includes(step.id) ? (
              (facts.data!.classes ?? []).length === 0 ? <p className="text-sm">{facts.data!.classes == null ? "Turmas não verificáveis com sua conta." : "Nenhuma turma registrada nesta unidade."}</p> : (
                <ul className="space-y-3">{facts.data!.classes!.map((c) => { const cl = classChecklist(c, facts.data!.calendars); const p = pendings(cl);
                  return (<li key={c.classId} className="rounded-md border border-border p-3">
                    <p className="font-medium">{c.name ?? c.classId} — {isReady(cl) ? "pronta para o Diário" : `${p.length} pendência(s)`}</p>
                    <ul className="mt-1 grid gap-1 text-sm sm:grid-cols-2">{cl.map((k) => (
                      <li key={k.id}>{k.state === "sim" ? "✓" : k.state === "nao" ? "✗" : "?"} {k.label}{k.required ? "" : " (informativo)"}{k.detail ? ` — ${k.detail}` : ""}
                        {k.state !== "sim" && <> · <a href={k.fix} className="text-primary underline">corrigir</a></>}</li>))}</ul>
                  </li>); })}</ul>)
            ) : (
              <dl className="grid gap-1 text-sm">
                <div><dt className="inline font-medium">Unidade: </dt><dd className="inline">{facts.data!.schoolName}</dd></div>
                <div><dt className="inline font-medium">Matrículas vigentes: </dt><dd className="inline">{facts.data!.enrollments ?? "não verificável"}</dd></div>
                <div><dt className="inline font-medium">Atuações vigentes na escola: </dt><dd className="inline">{facts.data!.engagements ?? "não verificável"}</dd></div>
              </dl>)}

          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <Button variant="outline" disabled={idx === 0} onClick={() => go(STEPS[idx - 1]!.id)}>Voltar</Button>
            <a href={step.fix} className="inline-flex min-h-9 items-center rounded-md border border-border px-4 text-sm">Abrir tela oficial</a>
            {step.id === "alunos-matriculas" && <Link to="/importacoes" className="inline-flex min-h-9 items-center rounded-md border border-border px-4 text-sm">Importação governada</Link>}
            <Button disabled={idx === STEPS.length - 1 || !school} onClick={() => go(STEPS[idx + 1]!.id)}>Marcar como revisada e avançar</Button>
          </div>
        </section>
      </div>
    </div>
  );
}
