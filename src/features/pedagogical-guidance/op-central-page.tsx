import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PageHeader, StatePanel } from "@/components/sigem/patterns";
import { AbsenceState } from "@/components/sigem/states";
import { SkeletonState } from "@/components/sigem/guidance";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { operationalToday } from "@/lib/academic-date";
import { schoolsInScope } from "@/features/school-followup/followup-source";
import { buildCentral, counterText } from "./op-central";
import { INTEGRATION_CONTRACTS, SECTORS, INTERVENTION_STAGES, guardPurpose, isolateSchool, screenState } from "./op-integration";

const SECTOR_LABEL: Record<(typeof SECTORS)[number], string> = {
  docente: "Docente", direcao: "Direção", aa: "Acompanhamento e Avaliação", nei: "NEI", mediador: "Mediador", secretaria: "Secretaria", ciece: "CIECE", supervisao: "Supervisão Escolar",
};
const STAGE_LABEL: Record<(typeof INTERVENTION_STAGES)[number], string> = {
  diagnostico: "Diagnóstico", proposta: "Proposta", "analise-competente": "Análise competente", execucao: "Execução", evidencias: "Evidências", reavaliacao: "Reavaliação", encerramento: "Encerramento",
};

/** Central Pedagógica (Lote 21). Lê o alcance real do servidor; blocos sem leitor conectado aparecem como "não lido", nunca zero. */
export function OpCentralPage() {
  const [scope, setScope] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<string>("");
  const [date, setDate] = useState(operationalToday());
  useEffect(() => {
    let alive = true;
    schoolsInScope().then((s) => alive && setScope(s), (e: Error) => alive && setErr(e.message)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);
  const state = screenState({ loading, error: err, denied: false, rows: scope });
  const iso = scope ? isolateSchool(picked || null, scope) : null;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Orientação Pedagógica" title="Central Pedagógica"
        description="Acompanhamento formativo da escola. A Orientação lê os registros dos setores e nunca altera plano, aula, nota, frequência, matrícula ou registro clínico." />
      {state === "carregando" && <SkeletonState label="Carregando seu alcance" />}
      {state === "erro" && <StatePanel tone="danger" title="Não foi possível abrir a Central" description="Seu alcance não pôde ser lido. Nenhuma escola foi consultada." />}
      {state === "vazio" && <AbsenceState kind="sem-permissao" title="Nenhuma escola no seu alcance" description="Sua atuação não tem permissão vigente com alcance de escola. O acesso não vem do nome do cargo." />}
      {state === "disponivel" && scope && (
        <>
          <div className="flex flex-wrap items-end gap-3 text-sm">
            {scope.length > 1 && (
              <label className="flex flex-col">Escola
                <select className="mt-1 rounded border bg-background p-2" value={picked} onChange={(e) => setPicked(e.target.value)}>
                  <option value="">Escolha…</option>{scope.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>)}
            <label className="flex flex-col">Dia consultado
              <input type="date" className="mt-1 rounded border bg-background p-2" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
          {iso && !iso.ok ? <AbsenceState kind="nenhum-resultado" title="Escolha a escola" description={iso.reason} /> : iso && iso.ok && <SchoolCentral schoolId={iso.schoolId} date={date} />}
        </>)}
    </div>
  );
}

function SchoolCentral({ schoolId, date }: { schoolId: string; date: string }) {
  const central = useMemo(() => buildCentral({ schoolId, date, reads: {}, alertRuleHomologated: false }), [schoolId, date]);
  return (
    <Tabs defaultValue="central" className="space-y-4">
      <TabsList className="flex flex-wrap h-auto">
        <TabsTrigger value="central">Central</TabsTrigger>
        <TabsTrigger value="fichas">Fichas</TabsTrigger>
        <TabsTrigger value="planejamentos">Planejamentos</TabsTrigger>
        <TabsTrigger value="intervencoes">Intervenções</TabsTrigger>
        <TabsTrigger value="integracao">Setores</TabsTrigger>
      </TabsList>

      <TabsContent value="central">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Blocos da Central">
          {central.blocks.map((b) => (
            <li key={b.id} className="rounded border bg-card p-3" data-state={b.state}>
              <span className="block text-xs text-muted-foreground">{b.label}</span>
              <span className="block text-base font-semibold">{counterText(b)}</span>
              <span className="block text-xs text-muted-foreground">{b.note || `Fonte: ${b.source}`}</span>
            </li>))}
        </ul>
      </TabsContent>

      <TabsContent value="fichas">
        <AbsenceState kind="nao-configurado" title="Fichas ainda não gravadas" description="A ficha de acompanhamento docente aguarda o registro no banco e a atribuição da capacidade de orientação. Nenhuma ficha é exibida por suposição." />
      </TabsContent>

      <TabsContent value="planejamentos">
        <PlanningComment />
      </TabsContent>

      <TabsContent value="intervencoes">
        <section aria-labelledby="int-h" className="space-y-3">
          <h2 id="int-h" className="text-sm font-semibold">Etapas do plano de intervenção</h2>
          <ol className="flex flex-wrap gap-2">
            {INTERVENTION_STAGES.map((s, i) => (
              <li key={s} className="rounded border bg-muted px-3 py-1 text-xs"><span aria-hidden>{i + 1}. </span>{STAGE_LABEL[s]}</li>))}
          </ol>
          <AbsenceState kind="sem-dado" compact description="Os planos vêm do mesmo registro do Acompanhamento e Avaliação; sem leitura conectada, nenhuma etapa é marcada como concluída." />
        </section>
      </TabsContent>

      <TabsContent value="integracao">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">O que a Orientação lê e nunca altera em cada setor</caption>
            <thead><tr className="text-left"><th className="p-2">Setor</th><th className="p-2">A OP lê</th><th className="p-2">A OP nunca altera</th></tr></thead>
            <tbody>
              {SECTORS.map((s) => (
                <tr key={s} className="border-t align-top">
                  <th scope="row" className="p-2 font-medium">{SECTOR_LABEL[s]}</th>
                  <td className="p-2">{INTEGRATION_CONTRACTS[s].reads.join("; ")}</td>
                  <td className="p-2">{INTEGRATION_CONTRACTS[s].neverWrites.join("; ") || "—"}<span className="block text-xs text-muted-foreground">{INTEGRATION_CONTRACTS[s].note}</span></td>
                </tr>))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Fiscalização administrativa é da Supervisão Escolar. <Link to="/orientacao" className="underline">Voltar ao acompanhamento da escola</Link></p>
      </TabsContent>
    </Tabs>
  );
}

function PlanningComment() {
  const [text, setText] = useState("");
  const warn = text ? guardPurpose(text) : null;
  return (
    <form className="space-y-2" onSubmit={(e) => e.preventDefault()} aria-describedby="pc-note">
      <label className="block text-sm font-medium" htmlFor="pc">Comentário no planejamento</label>
      <textarea id="pc" className="w-full rounded border bg-background p-2 text-sm" rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
      {warn && <p role="alert" className="text-sm text-destructive">{warn}</p>}
      <p id="pc-note" className="text-xs text-muted-foreground">O comentário é devolutiva formativa e não altera o plano do professor. Gravação aguarda o registro no banco; nada é salvo nesta tela.</p>
      <Button type="submit" disabled>Enviar comentário</Button>
    </form>
  );
}
