/** Organização da Rede L24 — painel responsivo: matriz de fechamento, ocupação e mapa. Não lê dado de domínio antes da sessão; fontes ainda não persistidas aparecem como bloqueio, nunca como zero. */
import { useState } from "react";
import { SkeletonState } from "@/components/sigem/guidance";
import { PageHeader, StatePanel } from "@/components/sigem/patterns";
import { SignInRequired } from "@/components/sigem/sign-in-required";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { CLOSURE_BASE_SHA, NET_CLOSURE_CRITERIA, NET_CLOSURE_SECTIONS, netClosureSummary, type NetClosureRow, type NetClosureStatus } from "./network-closure";
import { METHODOLOGY } from "./occupancy-panel";

const LABEL: Record<NetClosureStatus, string> = { "persistido-com-tela": "No banco, com tela", persistido: "No banco", "nucleo-testado": "Regra testada", bloqueado: "Bloqueado" };
const TABS = [["matriz", "Matriz de seções"], ["criterios", "Critérios"], ["ocupacao", "Ocupação"], ["mapa", "Mapa"]] as const;
type Tab = (typeof TABS)[number][0];

function Rows({ rows }: { rows: readonly NetClosureRow[] }) {
  return (
    <ul className="grid gap-2 md:grid-cols-2">
      {rows.map((r) => (
        <li key={r.n} className="min-w-0 rounded-md border p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium">{r.n}. {r.title}</span>
            <span className={`text-xs ${r.status === "bloqueado" ? "text-destructive" : "text-muted-foreground"}`}>{LABEL[r.status]}</span>
          </div>
          {r.blocker && <p className="mt-1 text-sm text-muted-foreground">{r.blocker}</p>}
          <p className="mt-1 break-words text-xs text-muted-foreground">Evidência: {r.tests.join(", ")}</p>
        </li>
      ))}
    </ul>
  );
}

export function NetworkHubPage() {
  const a = useSessionAuthority();
  const [tab, setTab] = useState<Tab>("matriz");
  if (a.status === "signed-out") return <SignInRequired title="Organização da Rede" what="a matriz, a ocupação e o mapa da rede" />;
  if (a.status === "loading") return <SkeletonState label="Verificando sua sessão" />;
  const sum = netClosureSummary(NET_CLOSURE_SECTIONS);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Organização da Rede" title="Matrículas, vagas e oferta" description="Situação real de cada parte: o que já está no banco, o que é só regra testada e o que depende de decisão institucional. Nenhuma homologação é presumida." />
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.keys(LABEL) as NetClosureStatus[]).map((k) => (
          <div key={k} className="rounded-md border p-3"><dt className="text-xs text-muted-foreground">{LABEL[k]}</dt><dd className="text-2xl font-semibold">{sum[k]}</dd></div>
        ))}
      </dl>
      <p className="break-all text-xs text-muted-foreground">Conferido no commit {CLOSURE_BASE_SHA}</p>
      <div role="tablist" aria-label="Seções" className="flex flex-wrap gap-2">
        {TABS.map(([id, l]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`min-h-11 rounded-md border px-3 text-sm ${tab === id ? "bg-primary text-primary-foreground" : "bg-background"}`}>{l}</button>
        ))}
      </div>
      {tab === "matriz" && <Rows rows={NET_CLOSURE_SECTIONS} />}
      {tab === "criterios" && <Rows rows={NET_CLOSURE_CRITERIA} />}
      {tab === "ocupacao" && <StatePanel tone="warning" title="Ocupação ainda não calculável" description={`Vagas autorizadas e reservas ainda não são gravadas no banco, e o limiar de alerta não foi homologado. Metodologia v${METHODOLOGY.version}: ${METHODOLOGY.formula}.`} />}
      {tab === "mapa" && <StatePanel tone="warning" title="Mapa indisponível" description="Faltam provedor de mapa, coordenadas institucionais das escolas e limiar de supressão. Nenhuma coordenada é presumida a partir de nome ou endereço." />}
    </div>
  );
}
