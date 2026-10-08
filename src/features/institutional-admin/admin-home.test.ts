import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { adminHome, NETWORK_RULE_SCREENS } from "./admin-home";

describe("NADM.4 home Admin", () => {
  it("conta contas e política só do que foi lido", () => {
    const h = adminHome(
      [{ banned: true, last_sign_in_at: null, password_change_required: true }, { banned: false, last_sign_in_at: "2026-10-01", password_change_required: false }],
      [{ id: "a", version: 1, status: "homologated", supersedes_version_id: null }, { id: "b", version: 2, status: "homologated", supersedes_version_id: "a" }, { id: "c", version: 3, status: "draft", supersedes_version_id: "b" }],
    );
    expect(h.accounts).toEqual({ total: 2, blocked: 1, mustChangePassword: 1, neverSignedIn: 1 });
    expect(h.policies).toEqual({ latestHomologated: 2, drafts: 1 });
  });
  it("leitura negada é não disponível, nunca zero", () => {
    expect(adminHome(null, null)).toEqual({ accounts: null, policies: null });
    expect(adminHome([], []).policies?.latestHomologated).toBeNull();
  });
  it("mapa de regras só aponta telas existentes", () => {
    for (const s of NETWORK_RULE_SCREENS) {
      const base = `src/routes${s.to}`;
      expect(existsSync(`${base}.tsx`) || existsSync(`${base}.index.tsx`), s.to).toBe(true);
    }
  });
});
