// QA visual do PDF do Mapa: gera a partir de um registro declarado (JSON) e de um caso extremo sintético.
import { readFileSync, writeFileSync } from "node:fs";
import { buildFromDeclared } from "../src/features/statistical-map/map-official-model";
import { renderOfficialMapPdf } from "../src/features/statistical-map/map-pdf";
const [rowFile, img, out, extreme] = process.argv.slice(2);
const r = JSON.parse(readFileSync(rowFile!, "utf8"));
const { createRequire } = await import("node:module");
const sz = JSON.parse(readFileSync(img + ".json", "utf8"));
const emblem = { dataUrl: "data:image/png;base64," + readFileSync(img!).toString("base64"), w: sz[0], h: sz[1] };
const long = "Admitida por meio de Contratação Temporária Emergencial, Memorando nº 0524/2026, com efeitos a partir de 02/02/2026, em substituição a servidora licenciada";
const people = extreme ? Array.from({ length: 60 }, (_, i) => ({ category: "ABCDEFGHIJK"[i % 11]!, cells: [`Servidora com Nome Bastante Extenso Número ${i + 1} da Silva Pereira`, "60738-0", "Professor II", "Professor II", "100, 101, 102", "1º e 2º", "AJT", long] })) : [];
const classes = extreme ? Array.from({ length: 70 }, (_, i) => ({ modalidade: i < 35 ? "ENSINO FUNDAMENTAL 1" : "ENSINO FUNDAMENTAL 2", etapa: `${(i % 9) + 1}º ANO`, turma: `${(i % 9) + 1}0${i % 3}`, alunos: 20, turno1: 20 })) : r.classes;
const doc = buildFromDeclared({ headerLines: ["Prefeitura Municipal de Itaperuna", "Secretaria Municipal de Educação", "Núcleo de Informação e Estatística"], schoolName: "Escola Municipal Nossa Senhora das Graças", inep: r.inep_declared, year: r.year, month: r.month,
  movement: r, shifts: r.shifts, classes, projects: r.projects ?? [], people, signatures: ["Responsável pelo estabelecimento de ensino", "Responsável pelo preenchimento"], generatedAt: "16/10/2026 12:40" });
const res = renderOfficialMapPdf(doc, { cover: true, emblem });
writeFileSync(out!, Buffer.from(res.pdf.output("arraybuffer")));
const bad = res.boxes.filter((b) => b.x < 11.9 || b.y < 11.9 || b.x + b.w > 285.1 || b.y + b.h > 198.1);
console.log("pages", res.pages, "out-of-bounds", bad.length);
