// NCFG.3 — dry-run determinístico (somente leitura). Uso: bun scripts/ncfg3/dryrun.ts /tmp/ncfg3/src.json /tmp/ncfg3/ids.json
import { readFileSync } from "node:fs";
import { catalogCandidates, classCandidates, FUTURE_IMPORT_SEQUENCE, journeyCandidates, planFingerprint, professionalCandidates, summarize } from "../../src/features/year-preparation/correspondence-dryrun";
const src = JSON.parse(readFileSync(process.argv[2]!, "utf8"));
const ids = JSON.parse(readFileSync(process.argv[3]!, "utf8")) as { schools: [string, string][]; persons: [string, string][] };
const schools = new Map(ids.schools), persons = new Map(ids.persons);
const files: Record<string, unknown> = {};
for (const [f, d] of Object.entries<any>(src)) {
  const ctx = { version: 1, sourceSha256: d.sha256, schools };
  const all = [
    ...professionalCandidates({ ...ctx, persons }, d.prof.map(([person, school]: string[]) => ({ person, school }))),
    ...journeyCandidates(ctx, d.jorn.map(([person, school, classCode, weekly]: string[]) => ({ person, school, classCode, weekly }))),
    ...classCandidates({ ...ctx, sourceYear: 2026, targetYear: 2027 }, d.turm.map(([classCode, school]: string[]) => ({ classCode, school }))),
    ...catalogCandidates({ version: 1, sourceSha256: d.sha256, domain: "etapa", homologated: new Map() }, d.etapa),
    ...catalogCandidates({ version: 1, sourceSha256: d.sha256, domain: "componente", homologated: new Map() }, d.componente),
  ];
  files[f] = { sha256: d.sha256, fingerprint: planFingerprint(all), summary: summarize(all) };
}
console.log(JSON.stringify({ generated_by: "NCFG.3 dry-run (somente leitura; nada gravado; 2027 não aberto)", matriz: "recusa: nenhuma fonte de matriz curricular da rede (só AvaliaRJ 2026) — DADO_AGUARDADO", files, future_import_sequence: FUTURE_IMPORT_SEQUENCE }, null, 1));
