import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cardLayout, cardSvg, confirmReading, opaqueToken, readCard, type QuestionRead } from "@/features/teacher-assessment/answer-card";

const title = "Cartão-resposta e conferência — SIA";
const description = "Gera cartão-resposta com bolhas circulares e código opaco, lê imagem enquadrada e exige conferência humana antes de aceitar.";

export const Route = createFileRoute("/avaliacoes-do-professor_/cartao-resposta")({
  head: () => ({ meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

function Page() {
  const [questions, setQuestions] = useState(10);
  const [opts, setOpts] = useState<4 | 5>(5);
  const layout = useMemo(() => cardLayout(questions, opts), [questions, opts]);
  const [token] = useState(() => opaqueToken());
  const [photo, setPhoto] = useState<string | null>(null);
  const [reads, setReads] = useState<QuestionRead[] | null>(null);
  const [decisions, setDecisions] = useState<Record<number, string | null>>({});
  const [message, setMessage] = useState<string | null>(null);

  const print = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><style>@page{size:A4;margin:0}body{margin:0}</style></head><body>${cardSvg(layout, { title: "Cartão-resposta", token })}</body></html>`);
    w.document.close(); w.print();
  };

  const onFile = async (f: File) => {
    const url = URL.createObjectURL(f);
    setPhoto(url); setDecisions({}); setMessage(null);
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement("canvas"); c.width = 1260; c.height = 1782;
    const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0, c.width, c.height);
    const rgba = ctx.getImageData(0, 0, c.width, c.height).data;
    const gray = new Uint8ClampedArray(c.width * c.height);
    for (let i = 0; i < gray.length; i++) gray[i] = (rgba[i * 4]! + rgba[i * 4 + 1]! + rgba[i * 4 + 2]!) / 3;
    setReads(readCard(layout, { width: c.width, height: c.height, data: gray }));
  };

  const confirm = () => {
    if (!reads) return;
    const r = confirmReading(reads, decisions, true);
    setMessage(r.ok ? `Leitura conferida: ${Object.values(r.answers).filter(Boolean).length} respostas. Nada foi gravado — a gravação no Diário ainda não está ligada.` : `Não aceito: ${r.reason}`);
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Cartão-resposta e conferência</h1>
        <p className="text-sm text-muted-foreground">Imprima o cartão, depois envie a imagem escaneada ou bem enquadrada pelos quatro quadrados pretos. Fotos inclinadas ainda não são corrigidas automaticamente. Toda leitura passa por conferência sua.</p>
      </header>
      <section className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-foreground">Questões <input type="number" min={1} max={50} value={questions} onChange={(e) => setQuestions(Math.min(50, Math.max(1, Number(e.target.value) || 1)))} className="ml-2 w-20 rounded border border-input bg-background px-2 py-1" /></label>
        <Button variant={opts === 4 ? "default" : "outline"} onClick={() => setOpts(4)}>4 alternativas</Button>
        <Button variant={opts === 5 ? "default" : "outline"} onClick={() => setOpts(5)}>5 alternativas</Button>
        <Button onClick={print}>Imprimir cartão (A4)</Button>
        <label className="text-sm text-foreground">Enviar imagem / câmera <input type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="ml-2" /></label>
      </section>
      {reads && (
        <section className="grid gap-4 md:grid-cols-2">
          {photo && <img src={photo} alt="Cartão enviado" className="w-full rounded border border-border" />}
          <div className="space-y-2">
            <table className="w-full text-sm">
              <thead><tr className="text-left"><th>Questão</th><th>Leitura</th><th>Decisão</th></tr></thead>
              <tbody>{reads.map((r) => (
                <tr key={r.question} className="border-t border-border">
                  <td className="py-1">{r.question}</td>
                  <td>{r.state === "marcada" ? r.option : r.state}</td>
                  <td><select aria-label={`Decisão da questão ${r.question}`} className="rounded border border-input bg-background" value={r.question in decisions ? decisions[r.question] ?? "" : "auto"} onChange={(e) => setDecisions({ ...decisions, [r.question]: e.target.value === "" ? null : e.target.value })}>
                    <option value="auto" disabled={r.state === "ambigua" || r.state === "multipla"}>Manter leitura</option>
                    <option value="">Em branco / anulada</option>
                    {layout.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select></td>
                </tr>))}</tbody>
            </table>
            <Button onClick={confirm}>Confirmar conferência</Button>
            {message && <p role="status" className="text-sm text-foreground">{message}</p>}
          </div>
        </section>
      )}
    </main>
  );
}
