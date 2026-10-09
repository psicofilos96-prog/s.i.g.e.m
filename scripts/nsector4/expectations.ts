// NSECTOR.4 — expectativa de tela por estação a partir da regra única (stationAllowsPath).
// Sem argumento: grava expect no plano. Com --menu: confere que todo link de menu coletado é permitido.
import { readFileSync, writeFileSync } from "node:fs";
import { stationAllowsPath } from "../../src/features/authority/station-navigation";

export const PATHS = [
  "/", "/ajuda", "/calendario-escolar", "/ciece", "/supervisao-escolar", "/alimentacao-escolar", "/avaliacao-desempenho",
  "/secretaria", "/alunos", "/turmas", "/enturmacoes", "/matriculas/nova", "/documentos-escolares", "/direcao", "/gestao-escolar",
  "/profissionais", "/orientacao", "/planejamento", "/horarios", "/mapa-estatistico", "/mapa-estatistico-rede", "/paineis",
  "/relatorios", "/qualidade-dos-dados", "/censo-escolar", "/unidades", "/diario", "/departamento-pessoal",
  "/administracao", "/administracao-geral", "/central-de-acessos", "/regras-institucionais", "/matrizes-curriculares",
];
if (process.argv.includes("--menu")) {
  const res = JSON.parse(readFileSync("docs/nsector4/matriz-isolamento.json", "utf8")) as { k: string; station: string; menu?: string[] }[];
  let bad = 0;
  for (const r of res.filter((x) => x.menu)) {
    const off = r.menu!.filter((p) => !stationAllowsPath(r.station, p));
    console.log(`${off.length ? "FAIL" : "PASS"} menu ${r.k}: ${r.menu!.length} links${off.length ? " fora da estação: " + off.join(", ") : ""}`);
    bad += off.length;
  }
  process.exit(bad ? 1 : 0);
} else {
  const plan = JSON.parse(readFileSync("/tmp/browser/nsector4/plan.json", "utf8"));
  for (const p of plan) p.expect = Object.fromEntries(PATHS.map((x) => [x, stationAllowsPath(p.station, x)]));
  writeFileSync("/tmp/browser/nsector4/plan.json", JSON.stringify(plan));
}
