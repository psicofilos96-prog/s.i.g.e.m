/** LOTE 8 — correção de prova aprovada pela OP: imagem do cartão → leitura → decisão humana → gravação (opcionalmente no Diário). */
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
import { finalizeLines, proposeCorrection, variantMap } from "./variant-key";

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
  const [dec, setDec] = useState<Record<number, string | null>>({});
  const [manual, setManual] = useState<Record<number, boolean | undefined>>({});
  const [checked, setChecked] = useState(false);
  const [launch, setLaunch] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const onFile = async (f: File) => {
    setFile(f); setReads(null); setDec({}); setManual({}); setChecked(false); setMsg(null);
    const url = URL.createObjectURL(f); setPhoto(url);
    const img = new Image(); img.src = url; await img.decode();
    const s = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0, c.width, c.height);
    const rgba = ctx.getImageData(0, 0, c.width, c.height).data; const gray = new Uint8ClampedArray(c.width * c.height);
    for (let i = 0; i < gray.length; i++) gray[i] = (rgba[i * 4]! + rgba[i * 4 + 1]! + rgba[i * 4 + 2]!) / 3;
    setQr(jsQR(rgba, c.width, c.height)?.data ?? "");
    const r = rectify(layout, { width: c.width, height: c.height, data: gray });
    if (!r.ok) { setMsg(`Foto não lida: ${r.reason}. Você ainda pode registrar as respostas manualmente abaixo.`); setReads(Array.from({ length: layout.questions }, (_, i) => ({ question: i + 1, state: "em-branco", option: null, fill: {} }) as QuestionRead)); return; }
    setReads(readCard(layout, r.image));
  };

  const reading = reads ? confirmReading(reads, dec, true) : null;
  const proposal = vm?.ok && keys.data && reading?.ok ? proposeCorrection(vm.map, keys.data, reading.answers) : null;
  const final = proposal ? finalizeLines(proposal.lines, manual) : null;
  const head = (done.data ?? []).find((c) => c.student_id === student && !(done.data ?? []).some((x) => x.supersedes_id === c.id)) ?? null;

  const save = async () => {
    if (!sel || !uid || !file || !final?.ok || !checked || !student || !qr.trim()) return;
    setMsg("Gravando…");
    try {
      const img = await uploadCardImage(uid, sel.id, file);
      await recordCorrection({ instrumentVersionId: sel.id, variant: letter, studentId: student, cardCode: qr.trim(), imagePath: img.path, imageSha: img.sha, fingerprint: fp, lines: final.lines, expectedHead: head?.id ?? null, reason: reason.trim() || null, launch });
      setMsg(`Correção gravada: ${final.hits} de ${final.lines.length} acertos${launch ? ", lançada no Diário" : ""}.`);
      await qc.invalidateQueries({ queryKey: ["sia8", "done", sel.id] });
    } catch (e) { setMsg(siaCorrectionMessage(e instanceof Error ? e.message : String(e))); }
  };

  if (session.loading) return <p className="text-sm text-muted-foreground">Conferindo sua sessão…</p>;
  if (!uid) return <p className="text-sm text-muted-foreground">Entre com sua conta para corrigir provas.</p>;
  return (
    <section className="space-y-4 rounded border border-border p-4" aria-label="Correção de prova aprovada">
      <h2 className="text-lg font-semibold text-foreground">Corrigir prova aprovada pela OP</h2>
      {ins.isLoading ? <p className="text-sm text-muted-foreground">Carregando suas provas…</p> : ins.error ? <p role="alert" className="text-sm text-destructive">Não foi possível ler suas provas.</p> : mine.length === 0 ? <p className="text-sm text-muted-foreground">Você não tem prova publicada. Publique uma em Avaliações do professor e envie à OP.</p> : (
        <label className="block text-sm">Prova <select aria-label="Prova" className="ml-2 rounded border border-input bg-background p-1" value={selId} onChange={(e) => { setSelId(e.target.value); setReads(null); }}><option value="">Escolha…</option>{mine.map((v) => <option key={v.id} value={v.id}>{v.title} (v{v.version})</option>)}</select></label>)}
      {sel && rv.isLoading && <p className="text-sm text-muted-foreground">Conferindo a aprovação da OP…</p>}
      {sel && rv.data && !approved && <p role="status" className="text-sm text-muted-foreground">Esta versão não está aprovada pela OP. A correção só é possível sobre a versão aprovada.</p>}
      {sel && approved && (<>
        <div className="flex flex-wrap gap-3 text-sm">
          <label>Versão <select aria-label="Versão da prova" className="ml-1 rounded border border-input bg-background p-1" value={letter} onChange={(e) => setLetter(e.target.value)}><option value="">Original</option>{[...VARIANT_LETTERS].map((l) => <option key={l}>{l}</option>)}</select></label>
          <label>Estudante <select aria-label="Estudante" className="ml-1 rounded border border-input bg-background p-1" value={student} onChange={(e) => setStudent(e.target.value)}><option value="">Escolha…</option>{(students.data ?? []).map((s) => <option key={s}>{s}</option>)}</select></label>
          <label>Imagem do cartão <input aria-label="Imagem do cartão" type="file" accept="image/png,image/jpeg,image/webp" capture="environment" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></label>
        </div>
        <p className="text-xs text-muted-foreground">Impressão digital da versão aprovada: <code>{fp.slice(0, 16)}…</code> · {nQ} questões · {students.data?.length === 0 ? "nenhum estudante matriculado nesta turma" : ""}</p>
        {keys.data && vm?.ok && keys.data.size < vm.map.entries.length && <p className="text-xs text-muted-foreground">{vm.map.entries.length - keys.data.size} questão(ões) sem gabarito objetivo: você decide certa/errada.</p>}
      </>)}
      {msg && <p role="status" className="text-sm text-foreground">{msg}</p>}
      {reads && sel && approved && (
        <div className="grid gap-4 md:grid-cols-2">
          {photo && <img src={photo} alt="Cartão do estudante" className="w-full rounded border border-border" />}
          <div className="space-y-2">
            <table className="w-full text-sm"><thead><tr className="text-left"><th>Q</th><th>Leitura</th><th>Resposta</th><th>Correção</th></tr></thead>
              <tbody>{reads.map((r) => { const l = proposal?.lines.find((x) => x.number === r.question); return (
                <tr key={r.question} className="border-t border-border"><td>{r.question}</td><td>{r.state === "marcada" ? r.option : r.state}</td>
                  <td><select aria-label={`Resposta ${r.question}`} className="rounded border border-input bg-background" value={r.question in dec ? dec[r.question] ?? "" : "auto"} onChange={(e) => setDec({ ...dec, [r.question]: e.target.value === "" ? null : e.target.value })}>
                    <option value="auto" disabled={r.state === "ambigua" || r.state === "multipla"}>Manter leitura</option><option value="">Em branco</option>{layout.options.map((o) => <option key={o}>{o}</option>)}</select></td>
                  <td>{!l ? "—" : l.correct !== null ? (l.correct ? "Certa" : "Errada") : (
                    <select aria-label={`Decisão ${r.question}`} className="rounded border border-input bg-background" value={manual[r.question] === undefined ? "" : String(manual[r.question])} onChange={(e) => setManual({ ...manual, [r.question]: e.target.value === "" ? undefined : e.target.value === "true" })}>
                      <option value="">{l.reason} — decidir</option><option value="true">Certa</option><option value="false">Errada</option></select>)}</td></tr>); })}</tbody></table>
            {reading && !reading.ok && <p className="text-sm text-destructive">{reading.reason}</p>}
            {final && !final.ok && <p className="text-sm text-muted-foreground">Decida as questões {final.pending.join(", ")}.</p>}
            <label className="block text-sm">Código do cartão (QR) <input aria-label="Código do cartão" className="ml-1 rounded border border-input bg-background p-1" value={qr} onChange={(e) => setQr(e.target.value)} placeholder="não lido — digite" /></label>
            {head && <label className="block text-sm">Motivo da nova correção <input aria-label="Motivo" className="ml-1 w-full rounded border border-input bg-background p-1" value={reason} onChange={(e) => setReason(e.target.value)} /></label>}
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> Conferi a imagem e cada resposta.</label>
            {sel.results_instrument_id ? <label className="flex gap-2 text-sm"><input type="checkbox" checked={launch} onChange={(e) => setLaunch(e.target.checked)} /> Lançar acertos no Diário (avaliação ligada)</label> : <p className="text-xs text-muted-foreground">Prova sem avaliação do Diário ligada: a correção é gravada, sem lançamento de nota.</p>}
            <Button onClick={save} disabled={!final?.ok || !checked || !student || !qr.trim() || !file}>Gravar correção</Button>
          </div>
        </div>)}
      {sel && (done.data?.length ?? 0) > 0 && (<div><h3 className="text-sm font-medium">Correções gravadas</h3><ul className="text-sm">{done.data!.map((c) => <li key={c.id}>{c.student_id} · versão {c.variant || "original"} · {c.hits}/{c.total}{c.supersedes_id ? " · corrigida" : ""}{c.diary_batch_act_id ? " · no Diário" : ""} · {new Date(c.recorded_at).toLocaleString("pt-BR")}</li>)}</ul></div>)}
    </section>
  );
}
