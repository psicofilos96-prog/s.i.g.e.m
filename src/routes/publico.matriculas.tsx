import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useId, useState, type FormEvent } from "react";
import { PublicLayout } from "@/features/public-portal/public-layout";
import { listPublic } from "@/features/public-portal/portal-source";
import {
  campaignWindow, consultProtocol, listPublicCampaigns, PROTOCOL_STATUS_LABEL, readableId, TERM_LABEL, validProtocolInput, WINDOW_LABEL,
  type ProtocolStatus,
} from "@/features/enrollments/ingress-public";
import { EmptyState } from "@/components/sigem/patterns";
import { ErrorState, LoadingState } from "@/components/sigem/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { institution } from "@/config/institution";
import { ResultLookup } from "@/features/enrollments/result-lookup";

const TITLE = `Matrículas — ${institution.departmentName}`;
const DESC = "Campanhas de matrícula abertas, prazos, editais, perguntas frequentes e consulta de protocolo.";

export const Route = createFileRoute("/publico/matriculas")({
  head: () => ({
    meta: [
      { title: TITLE }, { name: "description", content: DESC },
      { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
      { name: "robots", content: "index, follow" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/publico/matriculas" }],
  }),
  component: IngressPortal,
});

const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** Perguntas sobre o uso do portal; regras de matrícula vêm só do edital publicado. */
const FAQ = [
  { q: "Onde estão as regras da matrícula?", a: "No edital de cada campanha. Use o link “Conferir edital” para ver o documento oficial assinado. Este portal não substitui o edital." },
  { q: "Quais documentos preciso levar?", a: "A lista de documentos é a do edital da campanha. Se o edital não estiver disponível, procure o atendimento antes de se deslocar." },
  { q: "O que é o protocolo?", a: "É o número que comprova que seu pedido foi recebido. Ele aparece no comprovante, junto com um código de conferência de 12 caracteres." },
  { q: "Fazer o pedido garante a vaga?", a: "Não. O pedido é analisado conforme o edital. A matrícula só existe depois de confirmada pela escola." },
  { q: "Por que a consulta não mostra meus dados?", a: "Por proteção de dados. A consulta pública mostra apenas a situação do pedido, nunca nomes, documentos ou escola." },
];

function IngressPortal() {
  const campaigns = useQuery({ queryKey: ["enr-public-campaigns"], queryFn: listPublicCampaigns, staleTime: 60_000 });
  const info = useQuery({ queryKey: ["public-portal", "informacao-institucional"], queryFn: () => listPublic("informacao-institucional"), staleTime: 60_000 });
  const t = today();
  return (
    <PublicLayout>
      <h1 className="text-2xl font-semibold text-foreground">Matrículas</h1>
      <p className="mt-1 text-sm text-muted-foreground">Campanhas publicadas oficialmente pela rede municipal. Prazos e regras valem conforme o edital de cada campanha.</p>

      <nav aria-label="Nesta página" className="mt-4">
        <ul className="flex flex-wrap gap-2 text-sm">
          {[["#campanhas", "Campanhas"], ["#protocolo", "Consultar protocolo"], ["#perguntas", "Perguntas frequentes"], ["#atendimento", "Atendimento"]].map(([h, l]) => (
            <li key={h}><a href={h} className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{l}</a></li>
          ))}
        </ul>
      </nav>

      <section id="campanhas" aria-labelledby="h-campanhas" className="mt-8 scroll-mt-4">
        <h2 id="h-campanhas" className="text-lg font-semibold text-foreground">Campanhas</h2>
        <div className="mt-3" aria-live="polite">
          {campaigns.isLoading ? <LoadingState /> : campaigns.isError ? <ErrorState description="Tente novamente em instantes." onRetry={() => campaigns.refetch()} /> :
            !campaigns.data?.length ? <EmptyState title="Nenhuma campanha publicada" description="Não há campanha de matrícula aberta ou prevista neste momento." /> : (
            <ul className="space-y-3">
              {campaigns.data.map((c) => {
                const w = campaignWindow(c, t);
                return (
                  <li key={c.campaign_id} className="rounded-md border border-border bg-card p-4">
                    <p className="text-sm font-medium text-foreground"><span className="rounded bg-muted px-2 py-0.5">{WINDOW_LABEL[w]}</span></p>
                    <h3 className="mt-2 font-semibold text-foreground">{readableId(c.kind)} — {TERM_LABEL[c.cycle_term] ?? c.cycle_term} {c.cycle_year}</h3>
                    <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-3">
                      <dt className="text-muted-foreground">Prazo</dt><dd className="text-foreground">de {fmt(c.period_from)} a {fmt(c.period_to)}</dd>
                      <dt className="text-muted-foreground">Etapas</dt><dd className="text-foreground">{c.stage_ids.map(readableId).join(", ")}</dd>
                      <dt className="text-muted-foreground">Modalidades</dt><dd className="text-foreground">{c.modality_ids.map(readableId).join(", ")}</dd>
                      <dt className="text-muted-foreground">Escolas</dt><dd className="text-foreground">{c.schools.map((s) => s.name ?? "Escola sem nome registrado").join("; ")}</dd>
                    </dl>
                    {w === "aberta" && <Link to="/publico/inscricao/$campanhaId" params={{ campanhaId: c.campaign_id }} className="mt-3 mr-4 inline-flex min-h-11 items-center rounded-md bg-primary px-4 font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Fazer inscrição</Link>}
                    {c.edital_verification_code
                      ? <Link to="/verificar/ato/$codigo" params={{ codigo: c.edital_verification_code }} className="mt-3 inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">Conferir edital</Link>
                      : <p className="mt-3 text-sm text-muted-foreground">Edital não disponível para consulta online.</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <ProtocolLookup />
      <ResultLookup />

      <section id="perguntas" aria-labelledby="h-perguntas" className="mt-10 scroll-mt-4">
        <h2 id="h-perguntas" className="text-lg font-semibold text-foreground">Perguntas frequentes</h2>
        <div className="mt-3 space-y-2">
          {FAQ.map((f) => (
            <details key={f.q} className="rounded-md border border-border bg-card p-3">
              <summary className="min-h-11 cursor-pointer py-2 font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{f.q}</summary>
              <p className="mt-1 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="atendimento" aria-labelledby="h-atendimento" className="mt-10 scroll-mt-4">
        <h2 id="h-atendimento" className="text-lg font-semibold text-foreground">Atendimento</h2>
        <div className="mt-3">
          {info.isLoading ? <LoadingState /> : info.isError ? <ErrorState description="Tente novamente em instantes." onRetry={() => info.refetch()} /> :
            !info.data?.length ? <EmptyState title="Canais ainda não publicados" description="Os canais oficiais de atendimento ainda não foram publicados neste portal. Procure a escola mais próxima." /> : (
            <ul className="space-y-2">
              {info.data.map((i) => (
                <li key={i.slug}><Link to="/publico/$slug" params={{ slug: i.slug }} className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">{i.title}</Link></li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}

function ProtocolLookup() {
  const nId = useId(); const cId = useId(); const hId = useId();
  const [number, setNumber] = useState(""); const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<{ status: ProtocolStatus; registered_on: string | null; last_update_on: string | null } | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null); setRes(null);
    if (!validProtocolInput(number, code)) { setRes({ status: "indisponivel", registered_on: null, last_update_on: null }); return; }
    setBusy(true);
    try { setRes(await consultProtocol(number, code)); } catch { setErr("Consulta indisponível no momento. Tente novamente."); } finally { setBusy(false); }
  }
  return (
    <section id="protocolo" aria-labelledby="h-protocolo" className="mt-10 scroll-mt-4">
      <h2 id="h-protocolo" className="text-lg font-semibold text-foreground">Consultar protocolo</h2>
      <form onSubmit={submit} className="mt-3 grid gap-3 rounded-md border border-border bg-card p-4" noValidate>
        <div className="grid gap-1">
          <Label htmlFor={nId}>Número do protocolo ou da inscrição</Label>
          <Input id={nId} value={number} onChange={(e) => setNumber(e.target.value)} placeholder="PROT-2027-123" autoComplete="off" inputMode="text" aria-describedby={hId} required />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={cId}>Código de conferência</Label>
          <Input id={cId} value={code} onChange={(e) => setCode(e.target.value)} placeholder="12 caracteres" autoComplete="off" aria-describedby={hId} required />
        </div>
        <p id={hId} className="text-sm text-muted-foreground">Os dois aparecem no comprovante do pedido. A consulta mostra só a situação, sem dados pessoais. Para enviar documentos, ver próximos passos ou confirmar vaga, use <Link to="/publico/acompanhar-inscricao" className="font-medium text-primary hover:underline">Acompanhar pedido</Link>.</p>
        <Button type="submit" disabled={busy} className="min-h-11 sm:w-fit">{busy ? "Consultando…" : "Consultar"}</Button>
      </form>
      <div role="status" aria-live="polite" className="mt-3">
        {err && <p role="alert" className="rounded-md border border-border bg-muted p-3 text-sm text-foreground">{err}</p>}
        {res && (
          <div className="rounded-md border border-border bg-muted p-3 text-sm text-foreground">
            <p className="font-medium">{PROTOCOL_STATUS_LABEL[res.status]}</p>
            {res.registered_on && <p className="mt-1 text-muted-foreground">Recebido em {fmt(res.registered_on)}{res.last_update_on ? ` · última movimentação em ${fmt(res.last_update_on)}` : ""}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
