import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { pathAllowed } from "@/features/authority/nav-capabilities";
import { customError, fieldLabel, loadCatalog, runPage, type Catalog, type ServerPage } from "../custom/custom-report";
import { drillCondition, label as catLabel } from "./chart-model";
import { SECTOR_BOARDS, boardProblems, drillSpec, type SectorAlert, type SectorBoard, type SectorIndicator } from "./sector-boards";

const box = "space-y-2 rounded-md border border-border bg-card p-4";
type Res = { page: ServerPage } | { error: string } | "loading";
const DETAIL = 50;

export function SectorBoardsPage() {
  const authority = useSessionAuthority();
  const [cat, setCat] = useState<Catalog | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<string>("");
  const signedIn = authority.status === "signed-in";
  useEffect(() => { if (signedIn) loadCatalog().then(setCat).catch((e) => setErr(customError(e))); }, [signedIn]);
  const boards = useMemo(() => SECTOR_BOARDS.filter((b) => pathAllowed(authority, b.owner)), [authority]);
  if (authority.status === "loading") return <p role="status" className="text-sm text-muted-foreground">{authority.error ?? "Conferindo sua sessão…"}</p>;
  if (authority.status === "signed-out") return <section className={box}><p className="text-sm">Entre com sua conta para ver os painéis do seu setor.</p><Button asChild size="sm"><Link to="/auth">Entrar</Link></Button></section>;
  if (!cat) return <p role="status" className="text-sm text-muted-foreground">{err ?? "Carregando o catálogo…"}</p>;
  const board = boards.find((b) => b.id === sel) ?? null;
  return (
    <div className="space-y-4">
      <nav aria-label="Setores" className="flex flex-wrap gap-2">
        {boards.map((b) => <Button key={b.id} size="sm" variant={b.id === sel ? "default" : "outline"} aria-pressed={b.id === sel} onClick={() => setSel(b.id)}>{b.sector}</Button>)}
      </nav>
      {!boards.length && <p className="text-sm">Sua conta não tem setor com tela própria liberada.</p>}
      {!board && boards.length > 0 && <p className="text-sm text-muted-foreground">Escolha um setor. Os números são lidos com o acesso da sua conta: cada um vê só o que já pode ver.</p>}
      {board && <Board key={board.id} cat={cat} b={board} canOpen={(p) => pathAllowed(authority, p)} />}
    </div>
  );
}

function Board({ cat, b, canOpen }: { cat: Catalog; b: SectorBoard; canOpen: (p: string) => boolean }) {
  const probs = boardProblems(b, cat);
  const actions = b.actions.filter((a) => canOpen(a.path));
  return (
    <section aria-label={`Painel ${b.sector}`} className="space-y-4">
      <h2 className="text-lg font-semibold">{b.sector}</h2>
      {probs.length > 0 && <ul className="text-sm text-destructive">{probs.map((p) => <li key={p}>{p}</li>)}</ul>}
      <div className={box} aria-label="Ações"><h3 className="font-semibold">Ações</h3>
        <div className="flex flex-wrap gap-2">{actions.map((a) => <Button key={a.path} asChild size="sm" variant="outline"><a href={a.path}>{a.label}</a></Button>)}</div>
        {!actions.length && <p className="text-sm text-muted-foreground">Nenhuma tela deste setor está liberada para sua conta.</p>}
      </div>
      {b.gaps.map((g) => <p key={g} className="rounded border border-border bg-muted/40 p-2 text-sm" aria-label="Lacuna declarada">{g}</p>)}
      {b.alerts.length > 0 && <div className={box} aria-label="Alertas"><h3 className="font-semibold">Alertas</h3>
        {b.alerts.map((a) => <AlertCard key={a.id} cat={cat} a={a} />)}</div>}
      {b.indicators.length > 0 && <div className="grid gap-3 md:grid-cols-2" aria-label="Indicadores">{b.indicators.map((i) => <IndicatorCard key={i.id} cat={cat} i={i} />)}</div>}
    </section>
  );
}

function useRun(cat: Catalog, spec: Parameters<typeof runPage>[1], limit = 200) {
  const [r, setR] = useState<Res>("loading");
  const key = JSON.stringify(spec);
  useEffect(() => { let on = true; setR("loading"); runPage(cat, spec, limit, 0).then((page) => on && setR({ page }), (e) => on && setR({ error: e instanceof Error ? e.message : "Não disponível." })); return () => { on = false; }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return r;
}
const sumCol = (p: ServerPage, col: string) => p.rows.reduce((s, r) => s + (typeof r[col] === "number" ? (r[col] as number) : Number(r[col] ?? 0) || 0), 0);

function AlertCard({ cat, a }: { cat: Catalog; a: SectorAlert }) {
  const r = useRun(cat, a.spec);
  const [open, setOpen] = useState(false);
  if (r === "loading") return <p role="status" className="text-sm text-muted-foreground">{a.title}: lendo…</p>;
  if ("error" in r) return <p className="text-sm">{a.title}: <strong>não disponível</strong> ({r.error})</p>;
  const n = sumCol(r.page, "c2");
  return (
    <div className="text-sm" data-alert={a.id} data-count={n}>
      <p><strong>{a.title}: {n}</strong>{n === 0 ? " — nenhum registro visível à sua conta." : ""} <span className="text-muted-foreground">{a.meaning}</span></p>
      {n > 0 && <Button size="sm" variant="ghost" onClick={() => setOpen((x) => !x)}>{open ? "Fechar registros" : "Ver registros"}</Button>}
      {open && <Detail cat={cat} spec={drillSpec(a.spec, a.detail, null)} />}
    </div>
  );
}

function IndicatorCard({ cat, i }: { cat: Catalog; i: SectorIndicator }) {
  const r = useRun(cat, i.spec);
  const [drill, setDrill] = useState<string | null>(null);
  const grouped = i.spec.groupBy.length > 0;
  const field = i.spec.groupBy[0];
  return (
    <div className={box} aria-label={i.title} data-indicator={i.id}>
      <h3 className="font-semibold">{i.title}</h3>
      {r === "loading" && <p role="status" className="text-sm text-muted-foreground">Lendo…</p>}
      {r !== "loading" && "error" in r && <p className="text-sm">Não disponível: {r.error}</p>}
      {r !== "loading" && "page" in r && (!grouped
        ? <p className="text-3xl font-semibold" data-value>{r.page.rows[0]?.["c1"] === null || r.page.rows[0]?.["c1"] === undefined ? "não disponível" : String(r.page.rows[0]["c1"])}</p>
        : r.page.rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum registro visível à sua conta.</p>
        : <table className="w-full text-sm"><thead><tr><th className="text-left">{fieldLabel(cat, field!)}</th><th className="text-right">Valor</th></tr></thead>
          <tbody>{r.page.rows.slice(0, 15).map((row, k) => { const c = catLabel(row["c1"]); return (
            <tr key={k}><td>{i.detail ? <button type="button" className="text-left underline" onClick={() => setDrill(drill === c ? null : c)}>{c}</button> : c}</td>
              <td className="text-right">{row["c2"] === null || row["c2"] === undefined ? "não disponível" : typeof row["c2"] === "number" && !Number.isInteger(row["c2"]) ? row["c2"].toFixed(2).replace(".", ",") : String(row["c2"])}</td></tr>); })}</tbody></table>)}
      {r !== "loading" && "page" in r && grouped && r.page.total > 15 && <p className="text-xs text-muted-foreground">Mostrando 15 de {r.page.total} grupos.</p>}
      {drill !== null && i.detail && field && <Detail cat={cat} spec={drillSpec(i.spec, i.detail, drillCondition(field, drill))} title={`Registros: ${drill}`} />}
    </div>
  );
}

function Detail({ cat, spec, title }: { cat: Catalog; spec: Parameters<typeof runPage>[1]; title?: string }) {
  const r = useRun(cat, spec, DETAIL);
  if (r === "loading") return <p role="status" className="text-sm text-muted-foreground">Lendo registros…</p>;
  if ("error" in r) return <p className="text-sm">Registros não disponíveis: {r.error}</p>;
  const cols = spec.columns;
  return (
    <div className="max-h-80 overflow-auto" aria-label="Registros autorizados">
      {title && <p className="text-xs font-semibold">{title}</p>}
      <table className="w-full text-xs"><thead><tr>{cols.map((c) => <th key={c} className="border border-border px-1 text-left">{fieldLabel(cat, c)}</th>)}</tr></thead>
        <tbody>{r.page.rows.map((row, k) => <tr key={k}>{cols.map((_, j) => <td key={j} className="border border-border px-1">{row[`c${j + 1}`] === null || row[`c${j + 1}`] === undefined ? "não disponível" : String(row[`c${j + 1}`])}</td>)}</tr>)}</tbody></table>
      <p className="text-xs text-muted-foreground">{r.page.total} registro(s){r.page.total > DETAIL ? `; mostrando ${DETAIL}` : ""}.</p>
    </div>
  );
}
