/** N5.3.1 — assistente "Nova turma" em 7 passos. Escola vem do escopo; nada é gravado antes de "Criar turma". */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OperationalPageHeader } from "@/components/sigem/operational";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/sigem/date-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { readYears } from "@/features/year-transition/year-transition-source";
import { formatAcademicDate } from "@/lib/academic-date";
import { CLASS_REGISTRY_CAPABILITY } from "./institutional-class-contract";
import { schoolNames, schoolsWithCapability, todayIso } from "./institutional-class-source";
import {
  CLASS_WIZARD_STEPS, classCreateError, compositionKindOf, createArgs, emptyClassWizard, parseCapacity, stepProblems, yearAcceptsNewClass,
  type CatalogPosition, type ClassWizardState,
} from "./class-wizard-model";
import { classNamesFor, createClassWithSetup, positionCatalogs, shiftOptions } from "./class-wizard-source";

const YEAR_STATE: Record<string, string> = {
  "historico-importado": "histórico importado — não recebe turma nova",
  "em-preparacao": "em preparação",
  operacional: "em andamento",
  encerrado: "encerrado — não recebe turma nova",
};

export function ClassCreateWizardPage() {
  const auth = useSessionAuthority();
  const caps = auth.status === "signed-in" ? auth.capabilities : [];
  const schoolIds = schoolsWithCapability(caps, CLASS_REGISTRY_CAPABILITY);
  const school = schoolIds.length === 1 ? schoolIds[0]! : "";
  const [chosenSchool, setChosenSchool] = useState("");
  const schoolId = school || chosenSchool;
  const names = useQuery({ queryKey: ["inst-school-names", schoolIds], queryFn: () => schoolNames(schoolIds), enabled: schoolIds.length > 0 });
  const years = useQuery({ queryKey: ["wizard-years"], queryFn: readYears });
  const [s, setS] = useState<ClassWizardState>(emptyClassWizard);
  const [step, setStep] = useState(0);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const on = s.validFrom || todayIso();
  const catalogs = useQuery({ queryKey: ["wizard-positions", on], queryFn: () => positionCatalogs(on) });
  const shifts = useQuery({ queryKey: ["wizard-shifts", on], queryFn: () => shiftOptions(on) });
  const existing = useQuery({ queryKey: ["wizard-names", schoolId, s.yearId], queryFn: () => classNamesFor(schoolId, s.yearId), enabled: !!schoolId && !!s.yearId });
  const yearState = years.data?.find((y) => y.id === s.yearId)?.state ?? null;
  const set = (p: Partial<ClassWizardState>) => setS((x) => ({ ...x, ...p }));
  const ctx = useMemo(() => ({ yearState, existingNames: existing.data ?? [] }), [yearState, existing.data]);

  if (schoolIds.length === 0)
    return (
      <div className="grid gap-4">
        <OperationalPageHeader title="Nova turma" description="Cadastro de turma pela Secretaria." parent={{ label: "Turmas", to: "/turmas" }} />
        <p role="alert" className="text-sm text-muted-foreground">Sua conta não tem permissão para criar turmas em nenhuma escola.</p>
      </div>
    );

  function next() {
    const p = stepProblems(step, s, ctx);
    if (step === 0 && !schoolId) p.unshift("Escolha a escola.");
    setProblems(p);
    if (p.length === 0) setStep((x) => Math.min(x + 1, CLASS_WIZARD_STEPS.length - 1));
  }
  async function create() {
    setBusy(true); setProblems([]);
    try {
      const r = await createClassWithSetup(createArgs(schoolId, s));
      await qc.invalidateQueries({ queryKey: ["inst-classes"] });
      navigate({ to: "/turmas/$id", params: { id: r.class_id } });
    } catch (e) {
      const m = classCreateError(e instanceof Error ? e.message : String(e));
      setStep(m.step); setProblems([m.text]);
    } finally { setBusy(false); }
  }

  const sel = "mt-1 block h-10 w-full rounded-md border border-input bg-background px-2 text-sm";
  const kind = compositionKindOf(s.positions);
  const catalogEntries = [...(catalogs.data ?? new Map<string, CatalogPosition[]>()).entries()];
  const options = s.scheme ? (catalogs.data?.get(s.scheme) ?? []) : [];
  const togglePos = (p: CatalogPosition) => {
    const has = s.positions.some((x) => x.value === p.value && x.scheme === p.scheme);
    if (s.compositionKind === "simples") set({ positions: has ? [] : [p] });
    else set({ positions: has ? s.positions.filter((x) => !(x.value === p.value && x.scheme === p.scheme)) : [...s.positions, p] });
  };
  const cap = parseCapacity(s.capacity);

  return (
    <div className="grid gap-4 pb-24">
      <OperationalPageHeader title="Nova turma" description={`Etapa ${step + 1} de ${CLASS_WIZARD_STEPS.length} — ${CLASS_WIZARD_STEPS[step]}`} parent={{ label: "Turmas", to: "/turmas" }} />
      <ol aria-label="Progresso" className="flex flex-wrap gap-1">
        {CLASS_WIZARD_STEPS.map((t, i) => (
          <li key={t}><Badge variant={i === step ? "default" : i < step ? "secondary" : "outline"}>{i + 1}. {t}</Badge></li>
        ))}
      </ol>
      <section className="grid max-w-2xl gap-4 rounded-lg border border-border bg-card p-4">
        {step === 0 && (
          <>
            {school ? <p className="text-sm"><span className="text-muted-foreground">Escola</span><br /><strong>{names.data?.get(school) ?? "Escola do seu escopo"}</strong></p> : (
              <label className="text-sm">Escola
                <select className={sel} value={chosenSchool} onChange={(e) => setChosenSchool(e.target.value)}>
                  <option value="">Escolha a escola</option>
                  {schoolIds.map((id) => <option key={id} value={id}>{names.data?.get(id) ?? "Escola sem nome registrado"}</option>)}
                </select></label>)}
            <label className="text-sm">Ano letivo
              <select className={sel} value={s.yearId} onChange={(e) => set({ yearId: e.target.value })}>
                <option value="">Escolha o ano</option>
                {(years.data ?? []).map((y) => (
                  <option key={y.id} value={y.id} disabled={!yearAcceptsNewClass(y.state)}>
                    {y.label} — {y.state ? (YEAR_STATE[y.state] ?? y.state) : "ainda não aberto"}
                  </option>))}
              </select></label>
            {years.data && !years.data.some((y) => yearAcceptsNewClass(y.state)) ? (
              <p className="text-sm text-muted-foreground">Nenhum ano letivo está aberto para novas turmas. A abertura do ano é feita pela Administração Geral.</p>
            ) : null}
            <div className="grid gap-1"><Label htmlFor="w-from" className="text-sm">Início da turma</Label>
              <DateInput id="w-from" value={s.validFrom} onChange={(e) => set({ validFrom: e.target.value })} /></div>
          </>
        )}
        {step === 1 && (
          <>
            <fieldset className="grid gap-2 text-sm">
              <legend className="mb-1 font-medium">Como é a turma?</legend>
              <label className="flex items-center gap-2"><input type="radio" checked={s.compositionKind === "simples"} onChange={() => set({ compositionKind: "simples", positions: s.positions.slice(0, 1) })} /> Uma única etapa/ano</label>
              <label className="flex items-center gap-2"><input type="radio" checked={s.compositionKind === "multisseriada"} onChange={() => set({ compositionKind: "multisseriada" })} /> Multisseriada — reúne dois ou mais anos/etapas</label>
              <p className="text-muted-foreground">Na multisseriada, cada estudante continua com o seu próprio ano/etapa, registrado na enturmação.</p>
            </fieldset>
            {catalogEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum catálogo de etapas/anos homologado para esta data. Sem ele, a turma não pode ser criada.</p>
            ) : (
              <>
                <label className="text-sm">Catálogo de etapas/anos
                  <select className={sel} value={s.scheme} onChange={(e) => set({ scheme: e.target.value, positions: [] })}>
                    <option value="">Escolha</option>
                    {catalogEntries.map(([id, list]) => <option key={id} value={id}>{list[0]?.label ? `${list.length} opções (ex.: ${list[0].label})` : id}</option>)}
                  </select></label>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Etapas/anos">
                  {options.map((p) => {
                    const on2 = s.positions.some((x) => x.value === p.value && x.scheme === p.scheme);
                    return <Button key={p.value} type="button" size="sm" variant={on2 ? "default" : "outline"} aria-pressed={on2} onClick={() => togglePos(p)}>{p.label}</Button>;
                  })}
                </div>
                {s.positions.length ? <p className="text-sm">Selecionados: <strong>{s.positions.map((p) => p.label).join(", ")}</strong></p> : null}
              </>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <div className="grid gap-1"><Label htmlFor="w-name" className="text-sm">Nome da turma</Label>
              <Input id="w-name" value={s.name} onChange={(e) => set({ name: e.target.value })} placeholder={s.positions.length ? `${s.positions.map((p) => p.label).join(" e ")} — A` : "Ex.: 5º ano A"} />
              <p className="text-xs text-muted-foreground">A sugestão é só um exemplo; o nome é o que você confirmar.</p></div>
            <div className="grid gap-1"><Label htmlFor="w-code" className="text-sm">Código usado pela escola (opcional)</Label>
              <Input id="w-code" value={s.code} onChange={(e) => set({ code: e.target.value })} /></div>
          </>
        )}
        {step === 3 && (
          <>
            {shifts.data?.length ? (
              <label className="text-sm">Turno (opcional)
                <select className={sel} value={s.shift?.value ?? ""} onChange={(e) => { const v = shifts.data?.find((x) => x.valueId === e.target.value); set({ shift: v ? { value: v.valueId, version: v.version, label: v.label } : null }); }}>
                  <option value="">Não informar agora</option>
                  {shifts.data.map((v) => <option key={v.valueId} value={v.valueId}>{v.label}</option>)}
                </select></label>
            ) : <p className="text-sm text-muted-foreground">Nenhum turno homologado para esta data. O turno pode ser informado depois, na ficha da turma.</p>}
            <p className="text-sm text-muted-foreground">Nenhuma jornada disponível neste assistente: a jornada e o horário são cadastrados na ficha da turma, em Horários, depois da criação. Nada é deduzido da carga horária.</p>
          </>
        )}
        {step === 4 && (
          <div className="grid gap-1"><Label htmlFor="w-cap" className="text-sm">Capacidade (opcional)</Label>
            <Input id="w-cap" inputMode="numeric" value={s.capacity} onChange={(e) => set({ capacity: e.target.value })} placeholder="Deixe em branco se não for conhecida" />
            <p className="text-xs text-muted-foreground">Sem capacidade, a turma aparece em Vagas como "Capacidade não informada" e não é bloqueada por lotação.</p></div>
        )}
        {step === 5 && (
          <div className="grid gap-2 text-sm">
            <p>Os professores são vinculados depois da criação, na seção <strong>Professores da turma</strong> da ficha.</p>
            <p className="text-muted-foreground">O vínculo exige a matriz curricular homologada da turma e a atuação vigente do professor nesta escola. Nenhuma pessoa, vínculo ou acesso de professor é criado automaticamente.</p>
          </div>
        )}
        {step === 6 && (
          <dl className="grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Ano letivo</dt><dd>{years.data?.find((y) => y.id === s.yearId)?.label} · início {s.validFrom ? formatAcademicDate(s.validFrom) : "—"}</dd>
            <dt className="text-muted-foreground">Composição</dt><dd>{kind === "multisseriada" ? "Multisseriada: " : "Etapa única: "}{s.positions.map((p) => p.label).join(", ")}</dd>
            <dt className="text-muted-foreground">Nome</dt><dd>{s.name}{s.code ? ` (código ${s.code})` : ""}</dd>
            <dt className="text-muted-foreground">Turno</dt><dd>{s.shift?.label ?? "Não informado"}</dd>
            <dt className="text-muted-foreground">Capacidade</dt><dd>{cap.ok && cap.value ? `${cap.value} estudantes` : "Capacidade não informada"}</dd>
            <dt className="text-muted-foreground">Professores</dt><dd>Vinculados depois, na ficha</dd>
          </dl>
        )}
        {problems.length ? <ul role="alert" className="grid gap-1 text-sm text-destructive">{problems.map((p) => <li key={p}>{p}</li>)}</ul> : null}
      </section>
      <div className="sticky bottom-0 flex max-w-2xl gap-2 border-t border-border bg-background py-3">
        <Button type="button" variant="outline" disabled={step === 0 || busy} onClick={() => { setProblems([]); setStep((x) => x - 1); }}>Voltar</Button>
        {step < CLASS_WIZARD_STEPS.length - 1
          ? <Button type="button" onClick={next}>Continuar</Button>
          : <Button type="button" onClick={create} disabled={busy}>{busy ? "Criando…" : "Criar turma"}</Button>}
      </div>
    </div>
  );
}
