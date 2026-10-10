import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { useSessionUser } from "@/features/authority/session-authority";
import { actMessage, inForce, readRules, recordRule, ruleHeads, type RuleRow } from "@/features/diary/final-sheet-cloud";

const title = "Regras da Folha Final — SIGEM";
const description = "Cadastrar, revisar e homologar regras de resultado da Folha Final por modalidade, ano e vigência, com duas pessoas distintas.";
export const Route = createFileRoute("/diario_/regras-folha-final")({
  head: () => ({ meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

const MOD: Record<string, string> = { "fundamental-anos-iniciais": "Fundamental I", "fundamental-anos-finais": "Fundamental II", eja: "EJA (semestral)" };
const field = "mt-1 block w-full rounded border bg-background p-2 text-sm";
const today = () => new Date().toISOString().slice(0, 10);

function Page() {
  const { user, loading } = useSessionUser();
  const [rules, setRules] = useState<RuleRow[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ logical: "", label: "", modality: "fundamental-anos-finais", year: "", from: "", to: "", pass: "", att: "", source: "" });
  const load = useCallback(async () => { try { setRules(await readRules()); } catch { setRules([]); setMsg("Não foi possível ler as regras."); } }, []);
  useEffect(() => { if (user) void load(); }, [user, load]);

  if (loading) return <main className="p-4"><SkeletonState label="Verificando sessão" /></main>;
  if (!user) return <main className="mx-auto max-w-3xl space-y-3 p-4"><h1 className="text-xl font-semibold">Regras da Folha Final</h1>
    <StatePanel tone="warning" title="Entre para usar" description="As regras de resultado só são lidas e gravadas com login." /><Link className="underline" to="/auth">Entrar</Link></main>;

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg(ok); await load(); } catch (e) { setMsg(actMessage((e as Error).message)); } finally { setBusy(false); }
  }
  function draft() {
    const pass = Number(f.pass.replace(",", ".")); const att = f.att.trim() ? Number(f.att.replace(",", ".")) / 100 : null;
    const logical = (f.logical.trim() || `${f.modality}-${f.year || "todos"}-${f.from}`).toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const head = rules ? ruleHeads(rules).find((r) => r.logical_id === logical) : undefined;
    void run(() => recordRule({ logical, expectedVersion: head?.version ?? 0, label: f.label.trim(), scope: { modality: f.modality, year: f.year.trim() || null, valid_from: f.from, valid_to: f.to || null },
      params: { passMark: pass, minAttendance: att }, sourceRef: f.source.trim(), status: "rascunho" }), "Rascunho registrado. Outra pessoa precisa revisar e homologar.");
  }
  function homologate(r: RuleRow) {
    void run(() => recordRule({ logical: r.logical_id, expectedVersion: r.version, label: r.label, scope: r.scope, params: { passMark: r.params.passMark!, minAttendance: r.params.minAttendance ?? null }, sourceRef: r.source_ref, status: "homologada" }), "Regra homologada.");
  }
  const heads = rules ? ruleHeads(rules) : [];
  const canDraft = f.label.trim() && f.from && f.pass.trim() && f.source.trim() && !busy;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4 text-sm">
      <h1 className="text-xl font-semibold">Regras de resultado da Folha Final</h1>
      <p className="text-muted-foreground">Cada regra vale para uma modalidade (e, se informado, um ano letivo) dentro da vigência. Quem escreve não homologa: a homologação é de outra pessoa e não muda parâmetros. Sem regra homologada e vigente, a Folha Final mostra médias e não emite resultado. <Link className="underline" to="/diario/folha-final">Voltar à Folha Final</Link></p>
      {msg && <p role="status">{msg}</p>}
      <section aria-labelledby="nova" className="space-y-2 rounded border p-3">
        <h2 id="nova" className="font-medium">Novo rascunho (ou nova versão de uma regra existente)</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label>Identificador (opcional; repita para criar nova versão)<input className={field} value={f.logical} onChange={(e) => setF({ ...f, logical: e.target.value })} /></label>
          <label>Nome da regra<input className={field} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></label>
          <label>Modalidade<select className={field} value={f.modality} onChange={(e) => setF({ ...f, modality: e.target.value })}>{Object.entries(MOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Ano letivo (vazio = todos)<input className={field} value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} /></label>
          <label>Vigente a partir de<input type="date" className={field} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
          <label>Vigente até (opcional)<input type="date" className={field} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
          <label>Nota mínima de aprovação (0–100)<input inputMode="decimal" className={field} value={f.pass} onChange={(e) => setF({ ...f, pass: e.target.value })} /></label>
          <label>Frequência mínima % (vazio = não exigida)<input inputMode="decimal" className={field} value={f.att} onChange={(e) => setF({ ...f, att: e.target.value })} /></label>
          <label>Fonte da regra (documento, deliberação ou decisão)<input className={field} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} /></label>
        </div>
        <Button disabled={!canDraft} onClick={draft}>Registrar rascunho</Button>
      </section>
      <section aria-labelledby="lista" className="space-y-2">
        <h2 id="lista" className="font-medium">Regras</h2>
        {rules === null ? <SkeletonState label="Lendo regras" /> : heads.length === 0 ? <p className="text-muted-foreground">Nenhuma regra cadastrada. Sem regra homologada, nenhuma Folha Final emite resultado.</p> :
          <div className="overflow-auto rounded border"><table className="w-full text-left text-xs"><thead className="bg-muted"><tr><th className="p-1">Regra</th><th className="p-1">Modalidade / ano</th><th className="p-1">Vigência</th><th className="p-1">Parâmetros</th><th className="p-1">Fonte</th><th className="p-1">Situação</th><th className="p-1">Ação</th></tr></thead>
            <tbody>{heads.map((r) => <tr key={r.id} className="border-t">
              <td className="p-1">{r.label} · v{r.version}<br /><span className="text-muted-foreground">{r.logical_id}</span></td>
              <td className="p-1">{MOD[r.scope.modality ?? ""] ?? r.scope.modality} / {r.scope.year ?? "todos"}</td>
              <td className="p-1">{r.scope.valid_from ?? "—"} a {r.scope.valid_to ?? "sem fim"}{r.status === "homologada" && !inForce(r, today()) ? " (fora de vigência hoje)" : ""}</td>
              <td className="p-1">nota ≥ {r.params.passMark}{r.params.minAttendance != null ? ` · frequência ≥ ${Math.round(r.params.minAttendance * 100)}%` : " · sem frequência mínima"}</td>
              <td className="p-1">{r.source_ref}</td>
              <td className="p-1">{r.status === "homologada" ? "Homologada" : "Rascunho (aguarda revisão)"}{r.author_id === user.id ? " · escrita por você" : ""}</td>
              <td className="p-1">{r.status === "rascunho" && <Button size="sm" disabled={busy || r.author_id === user.id} title={r.author_id === user.id ? "Quem escreveu não homologa" : undefined} onClick={() => homologate(r)}>Revisar e homologar</Button>}</td>
            </tr>)}</tbody></table></div>}
      </section>
    </main>
  );
}
