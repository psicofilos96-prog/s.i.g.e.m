import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileSpreadsheet, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { operationalToday } from "@/lib/academic-date";
import { stationLabel, humanizeAccessError, type InventoryRow } from "./access-inventory";
import { devCredentialToolStatus, generateDevTemporaryCredentials } from "./dev-credentials.functions";
import { DEV_TOOL_MAX } from "./dev-credentials";

/** Planilha de entrega montada só no navegador; os valores não passam por estado de tela nem por log. */
async function deliverySheet(rows: { login: string; station: string; password: string }[]): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("Entrega");
  ws.addRow(["SIGEM — entrega de senhas temporárias (ambiente de desenvolvimento)"]);
  ws.addRow([`Gerada em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Troque a senha no primeiro acesso. Apague este arquivo após a entrega.`]);
  ws.addRow([]);
  ws.addRow(["Login", "Onde acessa", "Senha temporária"]).font = { bold: true };
  for (const r of rows) ws.addRow([r.login, r.station, r.password]);
  ws.columns = [{ width: 40 }, { width: 32 }, { width: 22 }];
  return new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function DevCredentialsPanel({ selected }: { selected: InventoryRow[] }) {
  const status = useServerFn(devCredentialToolStatus);
  const generate = useServerFn(generateDevTemporaryCredentials);
  const qc = useQueryClient();
  const gate = useQuery({ queryKey: ["access-center", "dev-tool"], queryFn: () => status(), retry: false });
  const [word, setWord] = useState(""); const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  if (!gate.data || !gate.data.enabled) return null; // fail-closed: erro, carregando ou desligada ⇒ nada aparece
  const sectoral = selected.filter((r) => r.account_kind === "setorial" && !r.revoked && r.login);
  const blocked = sectoral.length !== selected.length ? "Só contas de setor ativas recebem senha temporária por esta ferramenta." :
    sectoral.length === 0 ? "Escolha contas de setor na lista." : sectoral.length > DEV_TOOL_MAX ? `No máximo ${DEV_TOOL_MAX} contas por vez.` : null;
  async function go() {
    setBusy(true); setMsg(null);
    try {
      const r = await generate({ data: { userIds: sectoral.map((s) => s.user_id), confirm: "GERAR" } });
      if (!r.ok) { setMsg(humanizeAccessError(r.error)); return; }
      const byId = new Map(sectoral.map((s) => [s.user_id, s]));
      const blob = await deliverySheet(r.issued.map((i) => ({ login: byId.get(i.userId)?.login ?? "", station: stationLabel(byId.get(i.userId)?.station_code ?? null), password: i.password })));
      r.issued.length = 0;
      const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = `entrega-senhas-temporarias-${operationalToday()}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMsg(`Senha temporária gerada em ${r.requested - r.failed} de ${r.requested} conta(s); a planilha foi baixada.${r.failed ? ` ${r.failed} falharam e mantêm a senha anterior.` : ""}${r.audited ? "" : " Atenção: o registro de auditoria falhou."}`);
      qc.invalidateQueries({ queryKey: ["access-center"] });
    } catch { setMsg("Não foi possível concluir. Confira a lista antes de tentar de novo."); }
    finally { setWord(""); setOk(false); setBusy(false); }
  }
  return (
    <div role="region" aria-labelledby="dev-cred-title" className="grid gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <h3 id="dev-cred-title" className="flex items-center gap-2 font-semibold"><ShieldAlert className="size-5" aria-hidden />Senhas temporárias — só no ambiente de desenvolvimento</h3>
      <p className="text-sm text-muted-foreground">Gera uma senha diferente para cada conta de setor escolhida e baixa uma planilha com login e senha. A senha antiga deixa de funcionar na hora. O SIGEM não guarda nem mostra as senhas: elas existem só nessa planilha.</p>
      {blocked ? <p role="alert" className="text-sm text-destructive">{blocked}</p> : <>
        <p className="text-sm">{sectoral.length} conta(s) de setor escolhida(s).</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={ok} onChange={(e) => setOk(e.target.checked)} />Entendo que a senha atual dessas contas será trocada.</label>
        <label className="grid max-w-xs gap-1 text-sm">Digite GERAR para confirmar<input className="h-10 rounded-md border border-input bg-background px-2" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" /></label>
      </>}
      <div><Button variant="destructive" disabled={!!blocked || !ok || word !== "GERAR" || busy} onClick={go}><FileSpreadsheet className="size-4" aria-hidden />{busy ? "Gerando…" : "Gerar senhas e baixar planilha"}</Button></div>
      {msg && <p role="status" className="text-sm font-medium">{msg}</p>}
    </div>
  );
}
