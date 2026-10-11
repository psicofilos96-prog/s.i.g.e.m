/** LOTE 8 — correção de prova aprovada pela OP: imagem do cartão → leitura → decisão humana → gravação (opcionalmente no Diário). */
import { LoadingState } from "@/components/sigem/states";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { useSessionUser } from "@/features/authority/session-authority";
import { reviewsOf, reviewState } from "@/features/teacher-review/teacher-work-review";
import { cardLayout, confirmReading, readCard, type QuestionRead } from "./answer-card";
import { rectify } from "./answer-card-rectify";
import { heads, printFingerprint, variantProjection, VARIANT_LETTERS, type ItemVersion } from "./authoring-model";
import { classStudents, correctionsOf, itemKey, recordCorrection, siaCorrectionMessage, uploadCardImage, visibleInstruments, visibleItems } from "./authoring-source";
import { variantMap } from "./variant-key";
import qrcode from "qrcode-generator";
import { cardSvg } from "./answer-card";
import { parseQr, qrPayload, readConfidence, scoreLines, scoreSummary, toWire, type HumanDecision } from "./sia-scoring";
import { parseEntries } from "./sia-editor";
import { recordCorrectionV2 } from "./authoring-source";

export function CorrectionPanel() {
  const qc = useQueryClient();
  const session = useSessionUser();
  const uid = session.user?.id ?? null;
  const ins = useQuery({ queryKey: ["sia8", "ins"], queryFn: visibleInstruments, enabled: !!uid });
  const its = useQuery({ queryKey: ["sia8", "items"], queryFn: visibleItems, enabled: !!uid });
  const mine = useMemo(() => heads((ins.data ?? []).filter((v) => v.author_user_id === uid)).filter((v) => v.status === "publicado"), [ins.data, uid]);
  const [selId, setSelId] = useState("");
  const sel = mine.find((v) => v.id === selId) ?? null;
  const rv = useQuery({ queryKey: ["twr", "instrumento", sel?.instrument_id], queryFn: () => reviewsOf("instrumento", sel!.instrument_id), enabled: !!sel });
  const approved = !!sel && !!rv.data && reviewState(rv.data, sel.id) === "aprovado";
  const [letter, setLetter] = useState("");
  const byId = useMemo(() => new Map<string, ItemVersion>((its.data ?? []).map((i) => [i.id, i])), [its.data]);
  const vm = useMemo(() => (sel && approved ? variantMap(sel, byId, letter, true) : null), [sel, byId, letter, approved]);
  const proj = useMemo(() => (sel && approved ? variantProjection(sel, byId, letter || null, true) : null), [sel, byId, letter, approved]);
  const [fp, setFp] = useState("");
  useEffect(() => { if (proj?.ok) printFingerprint(proj.p).then(setFp); }, [proj]);
  const keys = useQuery({ queryKey: ["sia8", "keys", sel?.id], enabled: !!vm?.ok, queryFn: async () => {
    const m = new Map<string, string>();
    for (const e of vm!.ok ? vm!.map.entries : []) { const k = (await itemKey(e.itemVersionId))[0]?.answer; const v = typeof k === "string" ? k : Array.isArray(k) && k.length === 1 ? String(k[0]) : null; if (v) m.set(e.itemVersionId, v); }
    return m;
  } });
  const students = useQuery({ queryKey: ["sia8", "st", sel?.class_id], enabled: !!sel, queryFn: async () => [...new Set((await classStudents(sel!.class_id)).map((s) => s.student_id))].sort() });
  const done = useQuery({ queryKey: ["sia8", "done", sel?.id], enabled: !!sel, queryFn: () => correctionsOf(sel!.id) });

  const nQ = vm?.ok ? vm.map.entries.length : 0;
  const maxOpts = vm?.ok ? Math.max(...vm.map.entries.map((e) => Object.keys(e.displayToKey).length), 4) : 4;
  const layout = useMemo(() => cardLayout(Math.max(1, nQ), maxOpts > 4 ? 5 : 4), [nQ, maxOpts]);
  const [student, setStudent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [qr, setQr] = useState("");
  const [reads, setReads] = useState<QuestionRead[] | null>(null);
  const [dec, setDec] = useState<Record<number, HumanDecision>>({});
  const [checked, setChecked] = useState(false);
  const [launch, setLaunch] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const onFile = async (f: File) => {
    setFile(f); setReads(null); setDec({}); setChecked(false); setMsg(null);
    const url = URL.createObjectURL(f); setPhoto(url);
    const img = new Image(); img.src = url; await img.decode();
    const s = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0, c.width, c.height);
    const rgba = ctx.getImageData(0, 0, c.width, c.height).data; const gray = new Uint8ClampedArray(c.width * c.height);
    for (let i = 0; i < gray.length; i++) gray[i] = (rgba[i * 4]! + rgba[i * 4 + 1]! + rgba[i * 4 + 2]!) / 3;
    const code = jsQR(rgba, c.width, c.height)?.data ?? ""; setQr(code);
    const pq = parseQr(code);
    if (code && (!pq || pq.instrumentVersionId !== sel?.id || pq.letter !== letter)) { setMsg(pq ? "O QR é de outra prova ou de outra versão. Escolha a prova/versão do cartão ou fotografe o cartão certo." : "QR não reconhecido como cartão desta prova."); setReads(null); return; }
    const r = rectify(layout, { width: c.width, height: c.height, data: gray });
    if (!r.ok) { setMsg(`Foto não lida: ${r.reason}. Você ainda pode registrar as respostas manualmente abaixo.`); setReads([]); return; }
    setReads(readCard(layout, r.image));
  };

  const objective = useMemo(() => new Set(vm?.ok ? vm.map.entries.filter((e) => Object.keys(e.displayToKey).length > 0).map((e) => e.itemVersionId) : []), [vm]);
  const weights = useMemo(() => new Map(sel ? parseEntries(sel.items).map((e) => [e.itemVersionId, e.weight] as const) : []), [sel]);
  const lines = vm?.ok && keys.data && reads ? scoreLines(vm.map, keys.data, reads.length ? reads : null, dec, objective) : null;
  const sum = lines ? scoreSummary(lines, weights) : null;
  const printCards = () => {
    if (!sel || !vm?.ok) return; const w = window.open("", "_blank"); if (!w) return;
    const qr = qrcode(0, "M"); qr.addData(qrPayload(sel.id, letter)); qr.make();
    const n = qr.getModuleCount(), cell = 24 / n; let q = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) q += `<rect x="${160 + c * cell}" y="${26 + r * cell}" width="${cell}" height="${cell}"/>`;
    const safe = sel.title.replace(/[<>&"]/g, "");
    const svg = cardSvg(layout, { title: `${safe} — versão ${letter || "original"}`, token: `v${sel.version}${letter ? "-" + letter : ""} · ${fp.slice(0, 12)}` }).replace("</svg>", `<g fill="#000">${q}</g></svg>`);
    w.document.write(`<!doctype html><html><head><title>Cartões</title><style>@page{size:A4;margin:0}body{margin:0}svg{display:block;break-after:page}</style></head><body>${Array.from({ length: Math.max(1, students.data?.length ?? 1) }, () => svg).join("")}</body></html>`);
    w.document.close(); w.print();
  };
  const head = (done.data ?? []).find((c) => c.student_id === student && !(done.data ?? []).some((x) => x.supersedes_id === c.id)) ?? null;

  const save = async () => {
    if (!sel || !uid || !file || !lines || !sum?.canSave || !checked || !student || !qr.trim()) return;
    setMsg("Gravando…");
    try {
      const img = await uploadCardImage(uid, sel.id, file);
      await recordCorrectionV2({ instrumentVersionId: sel.id, variant: letter, studentId: student, cardCode: qr.trim(), imagePath: img.path, imageSha: img.sha, fingerprint: fp, lines: toWire(lines), expectedHead: head?.id ?? null, reason: reason.trim() || null, launch: launch && sum.canLaunch });
      setMsg(`Correção gravada: ${sum.hits} acerto(s)${sum.score !== null ? `, ${String(sum.score).replace(".", ",")} de ${String(sum.max).replace(".", ",")} pontos` : ", sem nota (há questões não lidas ou sem peso)"}${launch && sum.canLaunch ? ", lançada no Diário" : ""}.`);
      await qc.invalidateQueries({ queryKey: ["sia8", "done", sel.id] });
    } catch (e) { setMsg(siaCorrectionMessage(e instanceof Error ? e.message : String(e))); }
  };

  if (session.loading) return <p className="text-sm text-muted-foreground">Conferindo sua sessão…</p>;
  if (!uid) return <p className="text-sm text-muted-foreground">Entre com sua conta para corrigir provas.</p>;
  return (
    <section className="space-y-4 rounded border border-border p-4" aria-label="Correção de prova aprovada">
      <h2 className="text-lg font-semibold text-foreground">Corrigir prova aprovada pela OP</h2>
      {ins.isLoading ? <LoadingState label="Carregando suas provas…" /> : ins.error ? <p role="alert" className="text-sm text-destructive">Não foi possível ler suas provas.</p> : mine.length === 0 ? <p className="text-sm text-muted-foreground">Você não tem prova publicada. Publique uma em Avaliações do professor e envie à OP.</p> : (
        <label className="block text-sm">Prova <select aria-label="Prova" className="ml-2 rounded border border-input bg-background p-1" value={selId} onChange={(e) => { setSelId(e.target.value); setReads(null); }}><option value="">Escolha…</option>{mine.map((v) => <option key={v.id} value={v.id}>{v.title} (v{v.version})</option>)}</select></label>)}
      {sel && rv.isLoading && <p className="text-sm text-muted-foreground">Conferindo a aprovação da OP…</p>}
      {sel && rv.data && !approved && <p role="status" className="text-sm text-muted-foreground">Esta versão não está aprovada pela OP. A correção só é possível sobre a versão aprovada.</p>}
      {sel && approved && (<>
        <div className="flex flex-wrap gap-3 text-sm">
          <label>Versão <select aria-label="Versão da prova" className="ml-1 rounded border border-input bg-background p-1" value={letter} onChange={(e) => setLetter(e.target.value)}><option value="">Original</option>{[...VARIANT_LETTERS].map((l) => <option key={l}>{l}</option>)}</select></label>
          <label>Estudante <select aria-label="Estudante" className="ml-1 rounded border border-input bg-background p-1" value={student} onChange={(e) => setStudent(e.target.value)}><option value="">Escolha…</option>{(students.data ?? []).map((s) => <option key={s}>{s}</option>)}</select></label>
          <label>Imagem do cartão <input aria-label="Imagem do cartão" type="file" accept="image/png,image/jpeg,image/webp" capture="environment" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></label>
        </div>
        <Button size="sm" variant="outline" onClick={printCards} disabled={!vm?.ok || !fp}>Imprimir cartões desta versão (A4)</Button>
        <p className="text-xs text-muted-foreground">O cartão usa o mesmo desenho que a leitura e um QR só com a versão da prova (sem dados do estudante). No celular, "Imagem do cartão" abre a câmera.</p>
        <p className="text-xs text-muted-foreground">Impressão digital da versão aprovada: <code>{fp.slice(0, 16)}…</code> · {nQ} questões · {students.data?.length === 0 ? "nenhum estudante matriculado nesta turma" : ""}</p>
        {keys.data && vm?.ok && keys.data.size < vm.map.entries.length && <p className="text-xs text-muted-foreground">{vm.map.entries.length - keys.data.size} questão(ões) sem gabarito objetivo: você decide certa/errada.</p>}
      </>)}
      {msg && <p role="status" className="text-sm text-foreground">{msg}</p>}
      {reads && sel && approved && (
        <div className="grid gap-4 md:grid-cols-2">
          {photo && <img src={photo} alt="Cartão do estudante" className="w-full rounded border border-border" />}
          <div className="space-y-2">
            {reads && reads.length === 0 && <p role="alert" className="text-sm text-destructive">Foto não lida: as objetivas ficam "não lidas" (não contam como erradas). Decida cada uma ou fotografe de novo.</p>}
            <table className="w-full text-sm"><thead><tr className="text-left"><th scope="col">Q</th><th scope="col">Leitura</th><th scope="col">Confiança</th><th scope="col">Decisão</th><th scope="col">Situação</th></tr></thead>
              <tbody>{(lines ?? []).map((ln) => { const r = reads?.find((x) => x.question === ln.number); const obj = objective.has(ln.itemVersionId); const w = weights.get(ln.itemVersionId); const d = dec[ln.number]; return (
                <tr key={ln.number} className="border-t border-border"><td>{ln.number}</td>
                  <td>{!obj ? "discursiva" : r ? (r.state === "marcada" ? r.option : r.state === "multipla" ? "dupla marcação" : r.state === "ambigua" ? "rasura/fraca" : "em branco") : "não lida"}</td>
                  <td>{r && obj ? `${Math.round(readConfidence(r) * 100)}%` : "—"}</td>
                  <td>{obj ? <select aria-label={`Decisão ${ln.number}`} className="rounded border border-input bg-background" value={d?.status ?? (d && "option" in d ? d.option ?? "" : "auto")} onChange={(e) => { const v = e.target.value; const nd = { ...dec }; if (v === "auto") delete nd[ln.number]; else nd[ln.number] = v === "anulada" || v === "nao-lida" ? { status: v } : { option: v === "" ? null : v }; setDec(nd); }}>
                      <option value="auto">Manter leitura</option><option value="">Em branco</option>{layout.options.map((o) => <option key={o} value={o}>{o}</option>)}<option value="anulada">Anular questão</option><option value="nao-lida">Não lida</option></select>
                    : <input aria-label={`Nota da questão ${ln.number}`} inputMode="decimal" className="w-20 rounded border border-input bg-background p-1" placeholder={w != null ? `0–${w}` : "sem peso"} value={d?.points ?? ""} onChange={(e) => { const t = e.target.value.replace(",", "."); const nd = { ...dec }; if (t === "" || Number.isNaN(Number(t))) delete nd[ln.number]; else nd[ln.number] = { points: Number(t) }; setDec(nd); }} />}</td>
                  <td>{ln.status === null ? <span className="text-destructive">{ln.reason}</span> : ln.status === "nao-lida" ? "Não lida (não conta)" : ln.status === "pontuada" ? `${String(ln.points).replace(".", ",")} pt` : ln.status}</td></tr>); })}</tbody></table>
            {sum && <p className="text-sm" data-testid="sia-score">{sum.pending.length ? `Decida as questões ${sum.pending.join(", ")}.` : sum.score !== null ? `Nota: ${String(sum.score).replace(".", ",")} de ${String(sum.max).replace(".", ",")} (pesos desta versão aprovada).` : sum.weightsMissing ? "Sem nota: há questões sem peso nesta versão." : `Sem nota: ${sum.unread} questão(ões) não lida(s).`}{sum.badPoints ? " Nota de discursiva fora do peso." : ""}</p>}
            <label className="block text-sm">Código do cartão (QR) <input aria-label="Código do cartão" className="ml-1 rounded border border-input bg-background p-1" value={qr} onChange={(e) => setQr(e.target.value)} placeholder="não lido — digite" /></label>
            {head && <label className="block text-sm">Motivo da nova correção <input aria-label="Motivo" className="ml-1 w-full rounded border border-input bg-background p-1" value={reason} onChange={(e) => setReason(e.target.value)} /></label>}
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> Conferi a imagem e cada resposta.</label>
            {sel.results_instrument_id ? <label className="flex gap-2 text-sm"><input type="checkbox" checked={launch} disabled={!sum?.canLaunch} onChange={(e) => setLaunch(e.target.checked)} /> Lançar a nota no Diário (avaliação ligada){!sum?.canLaunch ? " — indisponível: há questão não lida, sem peso ou sem decisão" : ""}</label> : <p className="text-xs text-muted-foreground">Prova sem avaliação do Diário ligada: a correção é gravada, sem lançamento de nota.</p>}
            <Button onClick={save} disabled={!sum?.canSave || !checked || !student || !qr.trim() || !file}>Gravar correção</Button>
          </div>
        </div>)}
      {sel && (done.data?.length ?? 0) > 0 && (<div><h3 className="text-sm font-medium">Correções gravadas</h3><ul className="text-sm">{done.data!.map((c) => <li key={c.id}>{c.student_id} · versão {c.variant || "original"} · {c.hits}/{c.total}{(c as { score?: number | null }).score != null ? ` · ${(c as { score?: number }).score} pt` : ""}{c.supersedes_id ? " · corrigida" : ""}{c.diary_batch_act_id ? " · no Diário" : ""} · {new Date(c.recorded_at).toLocaleString("pt-BR")}</li>)}</ul></div>)}
    </section>
  );
}
