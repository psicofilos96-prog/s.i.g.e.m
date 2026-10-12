/**
 * SIGEM 2.0 — A&A Lote 08: importação QR/OMR e digital (conclui integração SIA).
 * Reaproveita `answer-card.ts` (layout, leitura, conferência humana) e
 * `sia-scoring.ts` (QR `sia1:<versão>:<caderno>`, confiança). Acrescenta:
 *  - emissão de cartões por estudante com token opaco (sem PII), mapeado só no servidor;
 *  - validação da imagem antes da leitura (dimensão, proporção, marcadores, contraste);
 *  - prevenção de duplicidade por hash da imagem e por token já importado;
 *  - conciliação com a aplicação (Lote 06): só estudante elegível com participação "participou";
 *  - importação digital com o mesmo pipeline e mesma conferência.
 * Nada grava; a efetivação segue por `record_sia_card_correction_v2`.
 */
import { opaqueToken, readCard, confirmReading, PAGE, type CardLayout, type Gray, type QuestionRead } from "@/features/teacher-assessment/answer-card";
import { parseQr, readConfidence } from "@/features/teacher-assessment/sia-scoring";

export type CardIssue = { token: string; instrumentVersionId: string; booklet: string; studentId: string; applicationId: string };
/** Tabela token → estudante fica no servidor; o cartão impresso leva só o token e o QR sem PII. */
export function issueCards(a: { instrumentVersionId: string; booklet: string; applicationId: string; studentIds: readonly string[]; rand?: () => Uint8Array }): CardIssue[] {
  const seen = new Set<string>();
  return [...new Set(a.studentIds)].map((studentId) => {
    let token: string; do token = opaqueToken(a.rand?.()); while (seen.has(token)); seen.add(token);
    return { token, instrumentVersionId: a.instrumentVersionId, booklet: a.booklet, studentId, applicationId: a.applicationId };
  });
}
const PII = /\d{11}|@|[A-ZÁ-Ú][a-zá-ú]+\s+[A-ZÁ-Ú][a-zá-ú]+/;
export const qrHasPii = (raw: string) => PII.test(raw);

/** Validação prévia da imagem: falha fechada, nunca "lê o que der". */
export function validateImage(img: Gray, l: CardLayout, minContrast = 0.5): string[] {
  const p: string[] = [];
  if (img.width < 600) p.push("resolução insuficiente (mín. 600 px de largura)");
  const ratio = img.height / img.width, expected = PAGE.h / PAGE.w;
  if (Math.abs(ratio - expected) > 0.03) p.push("proporção diferente da página A4 — imagem não retificada");
  const s = img.width / PAGE.w;
  for (const m of l.markers) {
    let dark = 0, n = 0;
    for (let y = Math.floor(m.y * s); y < (m.y + m.s) * s; y++) for (let x = Math.floor(m.x * s); x < (m.x + m.s) * s; x++) { n++; if ((img.data[y * img.width + x] ?? 255) < 128) dark++; }
    if (!n || dark / n < minContrast) { p.push("marcador de canto não encontrado"); break; }
  }
  return p;
}

export type ImportedCard = { token: string; imageSha256: string; importedAt: string; by: string };
export type ImportInput = { qrRaw: string; token: string; imageSha256: string; img: Gray; layout: CardLayout };
export type ImportOutcome =
  | { status: "recusado"; reasons: string[] }
  | { status: "duplicado"; of: ImportedCard }
  | { status: "conferencia"; issue: CardIssue; reads: QuestionRead[]; pending: number[]; confidence: Record<number, number> };

/** Pipeline de importação: QR → token → duplicidade → imagem → conciliação → leitura → conferência. */
export function importCard(i: ImportInput, ctx: {
  issues: ReadonlyMap<string, CardIssue>; imported: readonly ImportedCard[];
  eligible: ReadonlySet<string>; participation: ReadonlyMap<string, string>; // studentId → categoria (Lote 06)
}): ImportOutcome {
  if (qrHasPii(i.qrRaw)) return { status: "recusado", reasons: ["QR contém dado pessoal — cartão inválido"] };
  const qr = parseQr(i.qrRaw); if (!qr) return { status: "recusado", reasons: ["QR ilegível ou fora do formato sia1"] };
  if (!/^[0-9a-f]{64}$/.test(i.imageSha256)) return { status: "recusado", reasons: ["hash da imagem ausente"] };
  const dupImg = ctx.imported.find((x) => x.imageSha256 === i.imageSha256); if (dupImg) return { status: "duplicado", of: dupImg };
  const dupTok = ctx.imported.find((x) => x.token === i.token); if (dupTok) return { status: "duplicado", of: dupTok };
  const issue = ctx.issues.get(i.token); if (!issue) return { status: "recusado", reasons: ["token não emitido"] };
  const r: string[] = [];
  if (issue.instrumentVersionId !== qr.instrumentVersionId || issue.booklet !== qr.letter) r.push("token não corresponde à prova/caderno do QR");
  if (!ctx.eligible.has(issue.studentId)) r.push("estudante não elegível na data de referência da aplicação");
  const part = ctx.participation.get(issue.studentId);
  if (part !== "participou") r.push(part ? `participação registrada como "${part}" — conciliar antes` : "participação não registrada — conciliar antes");
  r.push(...validateImage(i.img, i.layout));
  if (r.length) return { status: "recusado", reasons: r };
  const reads = readCard(i.layout, i.img);
  const confidence = Object.fromEntries(reads.map((q) => [q.question, readConfidence(q)]));
  return { status: "conferencia", issue, reads, pending: reads.filter((q) => q.state === "ambigua" || q.state === "multipla").map((q) => q.question), confidence };
}

/** Digital: respostas chegam já por questão, mas passam pela mesma conciliação e conferência. */
export function importDigital(rows: readonly { token: string; answers: Record<number, string | null> }[], ctx: Parameters<typeof importCard>[1], questions: number) {
  return rows.map((row) => {
    const issue = ctx.issues.get(row.token);
    if (!issue) return { token: row.token, status: "recusado" as const, reasons: ["token não emitido"] };
    if (ctx.imported.some((x) => x.token === row.token)) return { token: row.token, status: "duplicado" as const };
    if (ctx.participation.get(issue.studentId) !== "participou" || !ctx.eligible.has(issue.studentId)) return { token: row.token, status: "recusado" as const, reasons: ["conciliação com a aplicação pendente"] };
    const bad = Object.keys(row.answers).map(Number).filter((q) => !(q >= 1 && q <= questions));
    if (bad.length) return { token: row.token, status: "recusado" as const, reasons: [`questões inexistentes: ${bad.join(", ")}`] };
    return { token: row.token, status: "conferencia" as const, issue, answers: row.answers };
  });
}

/** Confirmação: só com conferência humana e decisão em toda marcação ambígua; nunca correção silenciosa. */
export function confirmImport(o: Extract<ImportOutcome, { status: "conferencia" }>, decisions: Readonly<Record<number, string | null>>, reviewerPersonId: string | null) {
  if (!reviewerPersonId) return { ok: false as const, reason: "conferente (pessoa natural) obrigatório" };
  const changed = Object.keys(decisions).map(Number).filter((q) => !o.pending.includes(q) && o.reads.find((r) => r.question === q)?.option !== decisions[q]);
  const c = confirmReading(o.reads, decisions, true);
  if (!c.ok) return c;
  return { ok: true as const, answers: c.answers, overriddenClearReads: changed, reviewerPersonId, writer: "record_sia_card_correction_v2" as const };
}
