// Gera PDFs e HTML de impressão da Ficha de Matrícula para inspeção visual e comparação prévia × PDF.
// Uso: bun scripts/enrollment-form-samples.ts <pasta-saida>  (imagens lidas do servidor local)
import { mkdirSync, writeFileSync } from "node:fs";
import { layoutEnrollmentForm } from "../src/features/school-secretariat/enrollment-form/layout";
import { createMeasure, printHtml, renderPdf, type Images } from "../src/features/school-secretariat/enrollment-form/render";
import { blankFormData, type EnrollmentFormData } from "../src/features/school-secretariat/enrollment-form/model";
import brasao from "../src/assets/calendar-premium/brasao.png.asset.json";
import sigem from "../src/assets/logo-sigem.png.asset.json";

const out = process.argv[2] ?? "/tmp/ficha-samples";
mkdirSync(out, { recursive: true });
async function png(url: string) {
  const b = Buffer.from(await (await fetch(`http://localhost:8080${url}`)).arrayBuffer());
  return { src: `data:image/png;base64,${b.toString("base64")}`, w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
const images: Images = { brasao: await png(brasao.url), sigem: await png(sigem.url) };
const header = { government: "Prefeitura Municipal de Itaperuna", department: "Secretaria Municipal de Educação", school: "Escola Municipal Nossa Senhora das Graças", address: "Rua Aluísio Dias Moreira, nº 320 – Bairro Presidente Costa e Silva", phone: "(22) 98842-1495", email: "municipalnsg@gmail.com" };
const complete: EnrollmentFormData = {
  header, yearLabel: "2027",
  student: { name: "Maria Clara Oliveira da Silva", birth: "10/03/2019", grade: "2º ano – Turma 201", sex: "Feminino", race: "Parda", nationality: "Brasileira", birthCity: "Itaperuna", birthUf: "RJ", nee: false, address: "Rua das Flores, 45 – Centro – Itaperuna", phone: "(22) 99993-0022", zone: "Urbana", district: "Sede", cpf: "000.000.000-00", socialName: "", censusId: "123456789012", repeater: false, formerStudent: false },
  mother: { name: "Ana Paula Oliveira da Silva", phone: "(22) 99993-0022", nationality: "Brasileira" },
  guardian: { name: "Ana Paula Oliveira da Silva" },
  documents: ["declaracao", "certidao-nascimento", "foto", "vacina", "sus", "cpf-aluno"], imageConsent: true,
  health: { foodAllergy: false, otherAllergy: false, diabetes: false, medicalReport: false, notes: "Contato de emergência: avó, (22) 99993-0022." },
  renewals: [{ year: "2028", grade: "3º ano", image: true, addressChange: "" }],
};
const long = "Maria Clara Beatriz Eduarda Vitória Antonella Oliveira dos Santos Pereira da Silva Albuquerque Monteiro de Souza Cavalcante Figueiredo";
const longAddr = "Estrada Municipal Professor Doutor Antônio Carlos de Albuquerque Monteiro, quilômetro 18, Sítio Boa Esperança, Comunidade Rural do Alto da Serra Verde, Distrito de Comendador Venâncio – Itaperuna/RJ – CEP 28300-000";
const scen: Array<[string, EnrollmentFormData, { mode: "preenchida" | "branco"; specialEdAnnex: boolean; renewal: boolean }]> = [
  ["1-preenchida-completa", complete, { mode: "preenchida", specialEdAnnex: true, renewal: true }],
  ["2-nomes-e-enderecos-longos", { ...complete, student: { ...complete.student, name: long, address: longAddr }, mother: { name: long, address: longAddr }, father: { name: long, address: longAddr }, guardian: { name: long, address: longAddr }, renewals: [{ year: "2028", grade: "3º ano", image: false, addressChange: longAddr }] }, { mode: "preenchida", specialEdAnnex: false, renewal: true }],
  ["3-campos-vazios", { header, yearLabel: "2027", student: {} }, { mode: "preenchida", specialEdAnnex: false, renewal: false }],
  ["4-ficha-em-branco-com-anexos", blankFormData(header, "2027"), { mode: "branco", specialEdAnnex: true, renewal: true }],
];
const measure = createMeasure();
for (const [name, data, opt] of scen) {
  const l = layoutEnrollmentForm(data, opt, measure, false);
  writeFileSync(`${out}/${name}.pdf`, Buffer.from(renderPdf(l, images, "Ficha de Matrícula").output("arraybuffer")));
  writeFileSync(`${out}/${name}.html`, printHtml(l, images, "Ficha de Matrícula"));
  console.log(name, l.pages.length, "página(s)");
}
