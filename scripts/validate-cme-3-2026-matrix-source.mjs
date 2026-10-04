import { readFileSync } from "node:fs";

const path = new URL("../docs/data/deliberacao-cme-3-2026-matrizes-source.json", import.meta.url);
const data = JSON.parse(readFileSync(path, "utf8"));

function invariant(ok, message) {
  if (!ok) throw new Error(`cme-3-2026-source:${message}`);
}

invariant(data.schema === "sigem.curricular-matrix-source-transcription.v1", "schema");
invariant(data.status === "source-transcription-not-homologated", "status");
invariant(data.source?.act_ref === "Deliberação CME nº 3/2026", "act-ref");
invariant(data.source?.act_date === "2026-04-01", "act-date");
invariant(data.source?.publication_date === null, "publication-date-must-remain-unproven");
invariant(data.source?.valid_from === null, "valid-from-must-remain-unproven");
invariant(data.source?.publication_evidence_status === "pendente", "publication-evidence-status");
invariant(
  data.source?.document_sha256 === "d8f46e61a655f515d758c58ccb7715d3976c5ee347efc9a0d7e7e3f385fe0b02",
  "source-sha256",
);

const expected = new Map([
  ["I", 4],
  ["II", 5],
  ["III", 4],
  ["IV", 5],
  ["V", 4],
]);
invariant(Array.isArray(data.annexes) && data.annexes.length === expected.size, "annex-count");

const keys = new Set();
let positions = 0;
for (const annex of data.annexes) {
  invariant(expected.has(annex.annex), `unexpected-annex:${annex.annex}`);
  invariant(annex.positions?.length === expected.get(annex.annex), `position-count:${annex.annex}`);
  invariant(Number.isInteger(annex.page) && annex.page >= 2 && annex.page <= 6, `page:${annex.annex}`);
  for (const position of annex.positions) {
    invariant(typeof position.key === "string" && /^[a-z0-9][a-z0-9-]*$/.test(position.key), `position-key:${annex.annex}`);
    invariant(!keys.has(position.key), `duplicate-position:${position.key}`);
    invariant(typeof position.label === "string" && position.label.trim().length > 0, `position-label:${position.key}`);
    keys.add(position.key);
    positions += 1;
  }
  invariant(Array.isArray(annex.rows) && annex.rows.length > 0, `rows:${annex.annex}`);
  for (const row of annex.rows) {
    invariant(typeof row.source_label === "string" && row.source_label.trim().length > 0, `row-label:${annex.annex}`);
    invariant(Array.isArray(row.source_texts), `row-cells:${annex.annex}:${row.source_label}`);
    invariant(row.source_texts.length === annex.positions.length, `row-width:${annex.annex}:${row.source_label}`);
    for (const literal of row.source_texts) {
      invariant(typeof literal === "string" && literal.length > 0, `empty-source-literal:${annex.annex}:${row.source_label}`);
    }
  }
}
invariant(positions === 22, "position-total");

const flattened = data.annexes.flatMap((a) => a.rows.flatMap((r) => r.source_texts));
for (const literal of ["X", "--", "*", "1*"]) {
  invariant(flattened.includes(literal), `literal-missing:${literal}`);
}

console.log(`cme-3-2026-source-ok: annexes=${data.annexes.length} positions=${positions} publication=pending`);
