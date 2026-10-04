/**
 * B4.6.8 — Painel de acesso do calendário para conta autenticada: nunca deixa a tela vazia sem explicar o caminho.
 * Lê estado da instalação, designação e capacidades do banco; não concede nada. A prévia da fonte 2027 é leitura
 * pedida no clique, rotulada como FONTE (não homologada) e nunca gravada.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { buildImportPlan, customizationsAgainstReference, readBrowserCalendarsOnRequest, referenceCalendars2027 } from "./calendar-browser-import";
import { calendarAccessStep, INSTALL_RETURN_CALENDAR, type CalendarAccessInput } from "./calendar-access-onboarding";
import type { NetworkCalendar } from "./calendar-types";

export async function readCalendarAccess(): Promise<CalendarAccessInput> {
  const [st, d, c] = await Promise.all([
    supabase.from("sigem_installation_state").select("state").maybeSingle(),
    supabase.rpc("am_designated_installer"),
    supabase.rpc("effective_scope_capabilities"),
  ]);
  if (st.error || d.error || c.error) return { status: "erro" };
  const caps = ((c.data ?? []) as { capability_id: string; school_id?: string | null }[]).filter((x) => !x.school_id).map((x) => x.capability_id);
  return { status: "lido", installation: st.data?.state ?? null, designated: d.data === true, networkCapabilities: caps };
}

export function CalendarAccessPanel({ contextKey }: { contextKey: string }) {
  const q = useQuery({ queryKey: ["b468-calendar-access", contextKey], queryFn: readCalendarAccess, retry: false });
  if (q.isLoading) return <p role="status" className="text-sm text-muted-foreground">Verificando a instalação e a sua atuação…</p>;
  const step = calendarAccessStep(q.error || !q.data ? { status: "erro" } : q.data);
  const box = "space-y-2 rounded border border-border bg-muted p-3 text-sm";
  switch (step.kind) {
    case "erro-leitura":
      return <p role="alert" className="text-sm text-destructive">Não foi possível verificar a instalação e a sua atuação. Nada foi presumido.</p>;
    case "estado-desconhecido":
      return <p role="alert" className="text-sm text-destructive">Estado da instalação não reconhecido. Nada foi presumido.</p>;
    case "aguardando-instalacao":
      return <div role="note" className={box}><p className="font-medium">O SIGEM ainda não foi instalado.</p><p>Só a conta designada no ato de implantação pode concluir a instalação. Depois disso, quem tiver atuação com capacidade do calendário poderá construí-lo.</p></div>;
    case "sem-capacidade-calendario":
      return <div role="note" className={box}><p>Sua atuação vigente não tem capacidade para construir ou homologar o calendário da rede. Você vê apenas calendários homologados. Ter conta não concede capacidades.</p></div>;
    case "instalar":
      return (
        <section aria-label="Primeiros passos da Supervisão" data-sigem-build="b4.6.8-access-panel" className={box}>
          <p className="font-medium">Para construir o calendário, conclua primeiro a instalação do SIGEM.</p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>Abra a instalação, revise todas as regras da política e informe o ato de implantação.</li>
            <li>Em “Quem esta conta representa”, escolha órgão/setor (Supervisão Escolar). Nenhuma pessoa natural nem caixa postal é exigida.</li>
            <li>Ao concluir, você volta automaticamente para esta tela com a gestão do calendário.</li>
          </ol>
          <Button asChild size="sm"><Link to="/administracao" search={{ retorno: INSTALL_RETURN_CALENDAR } as never}>Revisar e instalar o SIGEM</Link></Button>
          <SourcePreview />
        </section>
      );
    case "gestao":
      return <SourcePreview />;
  }
}

/** Prévia somente leitura do calendário 2027 deste navegador (ou da referência, rotulada). */
export function SourcePreview() {
  const [read, setRead] = useState<null | { origin: "navegador" | "referencia" | "erro"; text?: string; cals: NetworkCalendar[] }>(null);
  function open() {
    let r;
    try { r = readBrowserCalendarsOnRequest((k) => window.localStorage.getItem(k)); } catch { r = { state: "erro-leitura" as const, reason: "" }; }
    if (r.state === "lido") return setRead({ origin: "navegador", cals: r.entries.filter((c) => c.year === 2027) });
    if (r.state === "ausente") return setRead({ origin: "referencia", cals: referenceCalendars2027() });
    setRead({ origin: "erro", text: r.state === "ilegivel" ? r.reason : "leitura do navegador recusada", cals: [] });
  }
  return (
    <div className="space-y-2 pt-2" aria-label="Fonte do calendário 2027">
      <Button type="button" variant="outline" size="sm" onClick={open}>Ver a fonte do calendário 2027 (prévia)</Button>
      {read && (
        <div className="space-y-1 rounded border border-border bg-background p-2">
          <p className="font-medium">
            {read.origin === "navegador" ? "Fonte registrada neste navegador — NÃO homologada, nada foi gravado."
              : read.origin === "referencia" ? "Nenhum registro neste navegador: exibindo a REFERÊNCIA 2027 do sistema (não é calendário salvo)."
              : `Registro do navegador ilegível (${read.text}). Nada foi substituído pela referência.`}
          </p>
          {read.origin !== "erro" && read.cals.length === 0 && <p>Nenhum calendário de 2027 no registro deste navegador.</p>}
          <ul className="ml-4 list-disc">
            {read.cals.map((c) => {
              const plan = buildImportPlan(c);
              const diff = read.origin === "navegador" ? customizationsAgainstReference(c) : null;
              return (
                <li key={c.id}>
                  {plan.title} ({plan.modality}) — {plan.days.length} datas declaradas{plan.firstDay ? `, de ${plan.firstDay} a ${plan.lastDay}` : ""}; {plan.types.length} tipos de dia.
                  {diff && diff.length > 0 && <> Personalizações preservadas: {diff.join(", ")}.</>}
                </li>
              );
            })}
          </ul>
          <p className="text-muted-foreground">A gravação institucional acontece só pela importação explícita na gestão do calendário, depois da instalação.</p>
        </div>
      )}
    </div>
  );
}
