import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RegistryHero, RegistryEmpty, RegistryCard, CardFact } from "@/components/sigem/registry-layout";
import { SkeletonState } from "@/components/sigem/guidance";
import { Button } from "@/components/ui/button";
import { formatAcademicDate } from "@/lib/academic-date";
import { loadStudentRecord } from "./student-record";

const NI = "não informado";
const SOURCE = { "carga-educacenso-2026": "Censo Escolar 2026 (carga técnica registrada)", "registro-sigem": "Registro no SIGEM" } as const;

export function StudentRecordPage({ id }: { id: string }) {
  const q = useQuery({ queryKey: ["student-record", id], queryFn: ({ signal }) => loadStudentRecord(id, signal), retry: 1 });
  if (q.isLoading) return <><h1 className="sr-only">Ficha do aluno</h1><SkeletonState label="Carregando ficha" /></>;
  if (q.error) return <RegistryEmpty title="Não foi possível ler a ficha" description="A leitura falhou. Nada foi alterado." action={<Button size="sm" onClick={() => q.refetch()}>Tentar novamente</Button>} />;
  const r = q.data;
  if (!r) return (
    <div className="space-y-6">
      <h1 className="sr-only">Ficha do aluno</h1>
      <RegistryEmpty title="Aluno fora do seu alcance" description="Este aluno não existe ou não está no escopo de escola da sua conta." action={<Button asChild size="sm" variant="outline"><Link to="/alunos">Voltar aos alunos</Link></Button>} />
    </div>
  );
  const allClasses = r.enrollments.flatMap((e) => e.classes);
  return (
    <div className="space-y-6">
      <RegistryHero eyebrow="Ficha escolar · 2026" title={r.name}
        lede={`Código ${r.identifier ?? NI}. ${r.enrollments.length} matrícula(s) escolar(es) e ${allClasses.length} vínculo(s) com turma visíveis para a sua conta.`}
        actions={<><Button asChild size="sm" variant="outline"><Link to="/alunos">Voltar aos alunos</Link></Button><Button asChild size="sm" variant="ghost"><Link to="/ficha-longitudinal/$id" params={{ id: r.id }}>Ficha longitudinal</Link></Button></>} />

      {r.enrollments.length === 0 && <RegistryEmpty title="Nenhuma matrícula visível" description="Não há matrícula escolar deste aluno no seu escopo." />}

      {r.enrollments.map((e) => (
        <section key={e.id} aria-label={`Matrícula em ${e.schoolLabel ?? "escola"}`} className="space-y-3">
          <h2 className="font-display text-xl font-semibold">{e.schoolLabel ?? "Escola (nome não visível)"}</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <CardFact label="Número da matrícula">{e.number ?? NI}</CardFact>
            <CardFact label="Ingresso na escola">{e.openedOn ? formatAcademicDate(e.openedOn) : NI}</CardFact>
            <CardFact label="Fonte">{SOURCE[e.source]}</CardFact>
          </dl>
          <div className="grid gap-3 md:grid-cols-2">
            {e.classes.map((c) => (
              <RegistryCard key={c.episodeId} title={<Link to="/turmas/$id" params={{ id: c.classId }} className="hover:underline">{c.label}</Link>}>
                <CardFact label="Situação na turma">{c.situation.kind === "vigente" ? "Vigente (sem encerramento registrado)" : `Encerrado em ${formatAcademicDate(c.situation.on)}${c.situation.reason ? ` — ${c.situation.reason}` : ""}`}</CardFact>
                <CardFact label="Ano letivo">{c.year ?? NI}</CardFact>
                <CardFact label="Etapa">{c.stage ?? NI}</CardFact>
                <CardFact label="Tipo de turma">{c.classType ?? NI}{c.aee ? " · AEE" : ""}</CardFact>
                <CardFact label="Dias e horário">{c.schedule ?? NI}</CardFact>
                <CardFact label="Carga semanal">{c.weeklyLoad ?? NI}</CardFact>
                <CardFact label="Início na turma">{c.validFrom ? formatAcademicDate(c.validFrom) : NI}</CardFact>
              </RegistryCard>
            ))}
          </div>
        </section>
      ))}

      <section aria-label="Campos ausentes" className="rounded-lg border border-dashed p-4 text-sm">
        <h2 className="mb-2 font-semibold">Campos ausentes nesta ficha</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">{r.missing.map((m) => <li key={m}>{m}</li>)}</ul>
        <p className="mt-2 text-xs text-muted-foreground">Situação final (aprovação, conclusão) só aparece com regra homologada; nada é presumido.</p>
      </section>
    </div>
  );
}
