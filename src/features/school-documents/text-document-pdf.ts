/** PDF A4 (arquivo) de documento textual: cabeçalho institucional, título, texto justificado, data e assinaturas por papel. */
export async function textDocumentPdf(a: { headerLines: readonly string[]; title: string; text: string; place?: string; signatures: readonly string[]; footer: string; draft: boolean }): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 22, maxW = W - 2 * M;
  let y = 20;
  doc.setFont("times", "normal"); doc.setFontSize(11);
  for (const l of a.headerLines) { doc.text(l, W / 2, y, { align: "center" }); y += 5.5; }
  y += 10; doc.setFont("times", "bold"); doc.setFontSize(14); doc.text(a.title, W / 2, y, { align: "center" }); y += 14;
  doc.setFont("times", "normal"); doc.setFontSize(12);
  const lh = 7;
  for (const para of a.text.split(/\n\s*\n/)) {
    const lines = doc.splitTextToSize(para.replace(/\s*\n\s*/g, " ").trim(), maxW) as string[];
    lines.forEach((l, i) => {
      if (y > H - 50) { doc.addPage(); y = 25; }
      doc.text(l, M, y, i < lines.length - 1 ? { align: "justify", maxWidth: maxW } : {});
      y += lh;
    });
    y += 3;
  }
  if (a.place) { y += 6; doc.text(a.place, W - M, y, { align: "right" }); y += 6; }
  let sy = y + 24; if (sy + 10 > H - 20) { doc.addPage(); sy = 50; }
  const per = Math.min(a.signatures.length, 2) || 1, colW = maxW / per;
  a.signatures.forEach((s, i) => {
    const x = M + (i % per) * colW, yy = sy + Math.floor(i / per) * 24;
    doc.line(x + 8, yy, x + colW - 8, yy); doc.setFontSize(10); doc.text(s, x + colW / 2, yy + 5, { align: "center" });
  });
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p); doc.setFontSize(8); doc.text(a.footer, M, H - 10); doc.text(`Página ${p} de ${n}`, W - M, H - 10, { align: "right" });
    if (a.draft) { doc.setFontSize(9); doc.text("RASCUNHO — modelo-base não salvo pela escola; sem valor de documento oficial.", W / 2, 12, { align: "center" }); }
  }
  return doc.output("blob");
}
