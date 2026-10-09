/**
 * NAVRULES.1 — tela real das regras de Avaliação (somente leitura sobre o reader do banco).
 * Não cria nem homologa: quem tem a capacidade é levado à tela de Regras institucionais (writers).
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { operationalToday } from "@/lib/academic-date";
import { sessionActor, useSessionAuthority } from "@/features/authority/session-authority";
import { classifyReadError } from "./institutional-rules-model";
import { listRuleVersions } from "./institutional-rules.functions";
import { ASSESSMENT_RULE_DOMAIN, ASSESSMENT_RULE_INFO, assessmentRuleActions, assessmentRulesState, groupRules, readablePayload, stateLabel } from "./assessment-rules-view";

const day = (d: string | null) => (d ? d.split("-").reverse().join("/") : null);

export function AssessmentRulesRealPage() {
  const authority = useSessionAuthority();
  const list = useServerFn(listRuleVersions);
  const on = operationalToday();
  const read = useQuery({ queryKey: ["assessment-rules-real", on], retry: false, queryFn: () => list({ data: { domain: ASSESSMENT_RULE_DOMAIN, on } }) });
  const actor = sessionActor(authority);
  const actions = assessmentRuleActions(actor?.capabilities ?? []);
  const data = read.isError ? classifyReadError(/unauthorized|authorization/i.test(String(read.error?.message)) ? "session:required" : String(read.error?.message)) : read.data;
  const state = data ? assessmentRulesState(data) : null;
  const groups = data?.kind === "lido" ? groupRules(data.rows) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader eyebrow="Avaliação" title="Regras de Avaliação"
        description={`${ASSESSMENT_RULE_INFO.label}: regra da rede que decide quando e como um resultado avaliativo pode ser corrigido. Rascunho não vale; só a versão homologada e vigente é aplicada.`} />
      <p role="status" className="rounded-lg border border-border bg-card p-4 text-sm" data-assessment-rules-state={state?.kind ?? "carregando"}>
        {state ? state.text : "Carregando regras…"}
      </p>
      {(actions.draft || actions.homologate) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sua atuação pode {[actions.draft && "registrar rascunho", actions.homologate && "homologar"].filter(Boolean).join(" e ")}.</span>
          <Button asChild variant="outline" size="sm"><Link to="/regras-institucionais">Abrir Regras institucionais</Link></Button>
        </div>
      )}
      {groups.map((g) => (
        <section key={g.logicalId} aria-labelledby={`r-${g.logicalId}`} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 id={`r-${g.logicalId}`} className="font-display text-base font-semibold break-words">{g.logicalId}</h2>
          <p className="text-sm">{g.current ? `Versão vigente: v${g.current.version}` : "Nenhuma versão vigente hoje."}</p>
          <ol aria-label={`Histórico — ${g.logicalId}`} className="space-y-3">
            {g.versions.map((v) => (
              <li key={v.version} className="rounded-md border border-border p-3 text-sm">
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <span className="font-medium">v{v.version}</span>
                  <span>{stateLabel(v.state)}</span>
                  <span className="text-muted-foreground">Vigência: {day(v.validFrom) ?? "não informada"} a {day(v.validUntil) ?? "sem fim"}</span>
                </div>
                <p className="mt-1 text-muted-foreground">Motivo: {v.reason}</p>
                <p className="text-muted-foreground">Registrada em {new Date(v.recordedAt).toLocaleString("pt-BR")}{v.homologatedAt ? ` · homologada em ${new Date(v.homologatedAt).toLocaleString("pt-BR")}` : ""}</p>
                <dl className="mt-2 grid gap-1 sm:grid-cols-[14rem_1fr]">
                  {readablePayload(v.payload).map((f) => (<div key={f.label} className="contents"><dt className="font-medium">{f.label}</dt><dd className="break-words">{f.value}</dd></div>))}
                </dl>
              </li>))}
          </ol>
        </section>))}
    </div>
  );
}
