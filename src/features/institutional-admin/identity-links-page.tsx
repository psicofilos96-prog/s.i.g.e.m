import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RegistryHero } from "@/components/sigem/registry-layout";
import { SkeletonState } from "@/components/sigem/guidance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { EVIDENCE_KINDS, canDecide, decideLink, loadAccounts, loadIdentifiedPersons, loadReviews, proposalProblem, proposeLink, type EvidenceKind, type ReviewItem } from "./identity-links";

const STATE_LABEL = { pendente: "Aguardando revisão", aprovado: "Aprovado", recusado: "Recusado" } as const;

function useMe() {
  return useQuery({ queryKey: ["me-id"], queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null });
}

function ProposalForm({ me }: { me: string | null }) {
  const qc = useQueryClient();
  const accounts = useQuery({ queryKey: ["identity-accounts"], queryFn: loadAccounts });
  const persons = useQuery({ queryKey: ["identity-persons"], queryFn: loadIdentifiedPersons });
  const [f, setF] = useState({ targetUserId: "", personId: "", schoolId: "", evidenceKind: "" as EvidenceKind | "", evidenceNote: "" });
  const problem = proposalProblem(f, me);
  const m = useMutation({
    mutationFn: () => proposeLink({ ...f, schoolId: f.schoolId.trim() || null, evidenceKind: f.evidenceKind as EvidenceKind }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["identity-reviews"] }); setF({ targetUserId: "", personId: "", schoolId: "", evidenceKind: "", evidenceNote: "" }); },
  });
  if (accounts.error || persons.error) return <p role="alert" className="text-sm text-destructive">Sem permissão para propor associações.</p>;
  const free = (accounts.data ?? []).filter((a) => !a.person_id && a.user_id !== me);
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="font-serif text-lg">Propor associação</h2>
      <label className="block text-sm">Conta sem pessoa associada
        <select className="mt-1 w-full rounded border bg-background p-2" value={f.targetUserId} onChange={(e) => setF({ ...f, targetUserId: e.target.value })}>
          <option value="">Escolha…</option>{free.map((a) => <option key={a.user_id} value={a.user_id}>{a.login}</option>)}
        </select></label>
      <label className="block text-sm">Pessoa com identificador registrado
        <select className="mt-1 w-full rounded border bg-background p-2" value={f.personId} onChange={(e) => setF({ ...f, personId: e.target.value })}>
          <option value="">Escolha…</option>{(persons.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.kinds.join(", ")})</option>)}
        </select></label>
      <label className="block text-sm">Escola da futura atuação (opcional, só referência)
        <Input value={f.schoolId} onChange={(e) => setF({ ...f, schoolId: e.target.value })} placeholder="ex.: inep-33001936" /></label>
      <label className="block text-sm">Tipo de evidência
        <select className="mt-1 w-full rounded border bg-background p-2" value={f.evidenceKind} onChange={(e) => setF({ ...f, evidenceKind: e.target.value as EvidenceKind })}>
          <option value="">Escolha…</option>{Object.entries(EVIDENCE_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select></label>
      <Input aria-label="Evidência" placeholder="O que foi conferido, onde e quando" value={f.evidenceNote} onChange={(e) => setF({ ...f, evidenceNote: e.target.value })} />
      {problem && <p className="text-xs text-muted-foreground">{problem}</p>}
      <Button disabled={!!problem || m.isPending} onClick={() => m.mutate()}>Enviar para revisão</Button>
      {m.error && <p role="alert" className="text-xs text-destructive">{(m.error as Error).message}</p>}
      <p className="text-xs text-muted-foreground">Nome sozinho não é aceito. A associação só vale depois que outra conta aprovar; a atuação na escola é criada à parte, na administração.</p>
    </section>
  );
}

function ReviewCard({ item, me }: { item: ReviewItem; me: string | null }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const m = useMutation({ mutationFn: (d: "aprovado" | "recusado") => decideLink(item.id, d, reason), onSuccess: () => qc.invalidateQueries({ queryKey: ["identity-reviews"] }) });
  return (
    <li className="rounded border p-3 text-sm">
      <div className="flex justify-between"><strong>{STATE_LABEL[item.state]}</strong><span className="text-muted-foreground">{new Date(item.proposed_at).toLocaleString("pt-BR")}</span></div>
      <p>Evidência: {EVIDENCE_KINDS[item.evidence_kind as EvidenceKind] ?? item.evidence_kind} — {item.evidence_note}</p>
      {item.school_id && <p>Escola indicada: {item.school_id}</p>}
      {item.decision && <p>Decisão: {item.decision.reason}</p>}
      {canDecide(item, me) && (
        <div className="mt-2 space-y-2">
          <Input aria-label="Motivo da decisão" placeholder="Motivo (mínimo 10 caracteres)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" disabled={reason.trim().length < 10 || m.isPending} onClick={() => m.mutate("aprovado")}>Aprovar</Button>
            <Button size="sm" variant="outline" disabled={reason.trim().length < 10 || m.isPending} onClick={() => m.mutate("recusado")}>Recusar</Button>
          </div>
          {m.error && <p role="alert" className="text-xs text-destructive">{(m.error as Error).message}</p>}
        </div>
      )}
      {item.state === "pendente" && item.proposed_by === me && <p className="text-xs text-muted-foreground">Você propôs; a revisão precisa ser de outra conta.</p>}
    </li>
  );
}

export function IdentityLinksPage() {
  const me = useMe();
  const q = useQuery({ queryKey: ["identity-reviews"], queryFn: loadReviews });
  return (
    <div className="space-y-6">
      <RegistryHero eyebrow="Acessos · identidade" title="Associação de contas a pessoas" description="Conta ↔ pessoa só com identidade comprovada e revisão por uma segunda conta. Associar não concede acesso: o acesso vem da atuação vigente." />
      <ProposalForm me={me.data ?? null} />
      <section>
        <h2 className="mb-2 font-serif text-lg">Propostas e decisões</h2>
        {q.isPending ? <SkeletonState /> : q.error ? <p role="alert" className="text-sm text-destructive">Não foi possível ler as propostas (sem permissão ou falha).</p>
          : q.data.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma proposta registrada.</p>
          : <ul className="space-y-2">{q.data.map((i) => <ReviewCard key={i.id} item={i} me={me.data ?? null} />)}</ul>}
      </section>
    </div>
  );
}
