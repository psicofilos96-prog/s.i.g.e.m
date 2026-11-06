/**
 * Gabinete — quem ocupa os postos acomp1/acomp2 (decisão do proprietário, 06/11/2026).
 * Só lê e grava por funções do banco que conferem o posto do Gabinete; a troca encerra
 * o ocupante anterior e designa o novo numa única transação, preservando o histórico.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/sigem/patterns";
import { confirmAction } from "@/components/sigem/confirm-action";
import { callRpc } from "@/lib/rpc-call";
import { formatDateTime } from "@/lib/academic-date";

type RosterRow = {
  assignment_id: string; seat_code: "acomp1" | "acomp2"; person_id: string; person_name: string;
  designated_at: string; act_ref: string; revoked_at: string | null; revocation_reason: string | null;
};
type PersonHit = { person_id: string; display_name: string; login: string | null };

const SEATS = [
  { code: "acomp1", label: "Acompanhamento — posto 1", login: "acomp1@sigem.itap.gov.br" },
  { code: "acomp2", label: "Acompanhamento — posto 2", login: "acomp2@sigem.itap.gov.br" },
] as const;
const input = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function seatError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (m.includes("person-holds-other-seat")) return "Essa pessoa já ocupa o outro posto. Retire-a de lá antes.";
  if (m.includes("cabinet-denied")) return "Somente o Gabinete pode alterar os responsáveis. Entre novamente e tente outra vez.";
  if (m.includes("natural-person-required")) return "Escolha um servidor da lista.";
  if (m.includes("invalid-designation") || m.includes("revocation-invalid")) return "Escreva o motivo da troca (pelo menos 3 letras).";
  return "Não foi possível concluir agora. Tente novamente.";
}

export function SeatAdminPanel({ sessionKey }: { sessionKey: string }) {
  const qc = useQueryClient();
  const roster = useQuery({
    queryKey: ["followup-seat-roster", sessionKey],
    queryFn: () => callRpc<RosterRow[]>("followup_seat_roster"),
    retry: false,
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const rows = roster.data ?? [];
  const current = (seat: string) => rows.find((r) => r.seat_code === seat && !r.revoked_at) ?? null;

  return (
    <section aria-labelledby="seat-admin" className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="seat-admin" className="font-display text-lg font-semibold">Responsáveis pelo acompanhamento</h2>
        <Button size="sm" variant="ghost" onClick={() => setShowHistory((v) => !v)}>{showHistory ? "Ocultar histórico" : "Ver histórico"}</Button>
      </div>
      <p className="text-sm text-muted-foreground">Quem entra com cada login registra as visitas em seu próprio nome. Ao trocar, quem estava antes perde o acesso na hora; as visitas antigas continuam com o nome de quem as fez.</p>
      {roster.isPending && <p role="status" className="text-sm text-muted-foreground">Lendo responsáveis…</p>}
      {roster.isError && <StatePanel tone="danger" title="Não foi possível ler os responsáveis" description={seatError(roster.error)} />}
      {roster.isSuccess && (
        <ul className="grid gap-3 md:grid-cols-2">
          {SEATS.map((s) => {
            const c = current(s.code);
            return (
              <li key={s.code} className="space-y-2 rounded-lg border border-border bg-card p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <p className="text-xs text-muted-foreground">Login: {s.login}</p>
                <p className="font-semibold">{c ? c.person_name : "Posto vago"}</p>
                {c && <p className="text-xs text-muted-foreground">Desde {formatDateTime(c.designated_at)}</p>}
                {editing === s.code
                  ? <ReplaceForm seat={s.code} hasCurrent={Boolean(c)} onDone={async () => { setEditing(null); await qc.invalidateQueries({ queryKey: ["followup-seat-roster", sessionKey] }); }} onCancel={() => setEditing(null)} />
                  : <Button size="sm" variant="outline" onClick={() => setEditing(s.code)}>{c ? "Trocar responsável" : "Designar responsável"}</Button>}
              </li>
            );
          })}
        </ul>
      )}
      {showHistory && roster.isSuccess && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-3">Posto</th><th className="pr-3">Responsável</th><th className="pr-3">Início</th><th className="pr-3">Fim</th><th>Motivo</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.assignment_id} className="border-t border-border">
                  <td className="py-1 pr-3">{r.seat_code}</td>
                  <td className="pr-3">{r.person_name}</td>
                  <td className="pr-3">{formatDateTime(r.designated_at)}</td>
                  <td className="pr-3">{r.revoked_at ? formatDateTime(r.revoked_at) : "Atual"}</td>
                  <td>{r.revocation_reason ?? r.act_ref}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ReplaceForm({ seat, hasCurrent, onDone, onCancel }: { seat: string; hasCurrent: boolean; onDone: () => Promise<void>; onCancel: () => void }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [pick, setPick] = useState<PersonHit | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [request] = useState(() => crypto.randomUUID());
  const hits = useQuery({
    queryKey: ["followup-seat-person-search", term],
    enabled: term.length >= 3,
    queryFn: () => callRpc<PersonHit[]>("followup_seat_person_search", { _q: term }),
    retry: false,
  });

  async function save() {
    if (!pick) return setErr("Escolha um servidor da lista.");
    if (reason.trim().length < 3) return setErr("Escreva o motivo da troca.");
    const ok = await confirmAction({
      title: `Designar ${pick.display_name}?`,
      consequence: hasCurrent ? "Quem ocupa o posto hoje perde o acesso imediatamente. A nova pessoa precisa entrar de novo com o login do posto." : "A pessoa poderá registrar visitas com o login deste posto depois de entrar de novo.",
      actionLabel: "Designar",
    });
    if (!ok) return;
    setBusy(true); setErr("");
    try {
      await callRpc("followup_seat_cabinet_replace", { _seat: seat, _person: pick.person_id, _reason: reason.trim(), _request: request });
      await onDone();
    } catch (e) { setErr(seatError(e)); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-2">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setPick(null); setTerm(q.trim()); }}>
        <label className="flex-1 text-sm">Buscar servidor pelo nome<input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pelo menos 3 letras" /></label>
        <Button type="submit" size="sm" className="self-end">Buscar</Button>
      </form>
      {hits.isFetching && <p role="status" className="text-xs text-muted-foreground">Buscando…</p>}
      {hits.isSuccess && hits.data.length === 0 && <p className="text-xs text-muted-foreground">Ninguém encontrado com esse nome.</p>}
      {hits.isSuccess && hits.data.length > 0 && (
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {hits.data.map((h) => (
            <li key={h.person_id}>
              <button type="button" onClick={() => setPick(h)} aria-pressed={pick?.person_id === h.person_id}
                className={`w-full rounded-md border px-2 py-1 text-left text-sm ${pick?.person_id === h.person_id ? "border-primary bg-primary/10" : "border-border"}`}>
                {h.display_name}{h.login ? <span className="block text-xs text-muted-foreground">{h.login}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="block text-sm">Motivo<input className={input} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={190} placeholder="Ex.: substituição por férias" /></label>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => void save()}>{busy ? "Salvando…" : "Designar"}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}
