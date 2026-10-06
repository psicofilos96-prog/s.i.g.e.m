import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { BLOCK_CODES } from "./block-codes";
import { TOPICS, GLOSSARY } from "./help-content";

const canonical = readFileSync("docs/sigem-documentacao-canonica.md", "utf8");
const all = JSON.stringify({ BLOCK_CODES, TOPICS, GLOSSARY }) + canonical;

describe("BK — códigos de bloqueio e documentação canônica", () => {
  it("códigos únicos, em MAIÚSCULAS, cada um com o que falta", () => {
    const codes = BLOCK_CODES.map((b) => b.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const b of BLOCK_CODES) { expect(b.code).toMatch(/^[A-Z0-9_]+$/); expect(b.missing.length).toBeGreaterThan(3); expect(b.unavailable.length).toBeGreaterThan(3); }
    for (const c of ["REAL_2027_CONFIGURATION_PENDING", "DP_FILE_CONTRACT_PENDING", "EDUCACENSO_LAYOUT_BLOCKED_BY_OFFICIAL_SOURCE", "OFFICIAL_TEMPLATES_PENDING", "EXTERNAL_MONITORING_PROVIDER_PENDING", "PLATFORM_BACKUP_RESTORE_VALIDATION_PENDING"]) expect(codes).toContain(c);
  });
  it("códigos citados na doc canônica e na ajuda existem no registro", () => {
    const known = new Set(BLOCK_CODES.map((b) => b.code));
    const cited = (canonical + JSON.stringify(TOPICS)).match(/\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+){2,}\b/g) ?? [];
    for (const c of cited) expect(known.has(c), c).toBe(true);
  });
  it("sem termos obsoletos: GPE não é arquivo aguardado, RH não é perfil operacional", () => {
    expect(all).not.toMatch(/arquivo GPE (aguardado|pendente|esperado)|aguardando (o )?arquivo GPE/i);
    expect(all).not.toMatch(/perfil (operacional )?(de )?RH\b(?! não)/i);
    expect(canonical).toMatch(/RH não é perfil operacional/);
  });
  it("links da doc canônica existem", () => {
    for (const m of canonical.matchAll(/`([a-z0-9-]+\.md)`/g)) expect(existsSync(`docs/${m[1]}`), m[1]).toBe(true);
  });
  it("sem segredos nem PII", () => {
    expect(all).not.toMatch(/sb_secret_|service_role_key|eyJ[a-zA-Z0-9_-]{20,}|\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b/);
  });
});
