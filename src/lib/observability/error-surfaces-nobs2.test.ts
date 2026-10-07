import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { governError, presentError, UserFacingError, userErrorText } from "./governed-errors";
import { confirmAction, askText } from "@/components/sigem/confirm-action";
import { followupMessage } from "@/features/school-followup/followup-panel";
import { familyMessage } from "@/features/family-portal/family-portal";
import { writeRefusalText } from "@/features/calendar/institutional-calendar-writers";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}
const SRC = files("src").filter((f) => !f.includes("src/components/ui/"));

describe("NOBS.2 — varredura de superfícies cruas", () => {
  it("nenhum window.confirm/alert/prompt no app", () => {
    const hits = SRC.filter((f) => /window\.(confirm|alert|prompt)\s*\(/.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
  it("nenhum erro do backend vai direto para estado/tela", () => {
    const raw = /set\w+\(\s*\(?(e|err|error)( as Error)?\)?\.message\s*\)|set\w+\((e|err|error) instanceof Error \? (e|err|error)\.message|\{(e|err|error)\??\.message\}|toast\.\w+\((e|err|error)\??\.message/;
    const hits = SRC.filter((f) => f.endsWith(".tsx") && raw.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});

describe("NOBS.2 — cenários de recuperação", () => {
  it.each([
    ["JWT expired", "sessao-expirada"],
    ["Failed to fetch", "sem-conexao"],
    ["permission denied for table x", "autorizacao"],
    ["cal:base-superseded", "conflito"],
    ["stale-head", "conflito"],
  ])("%s → %s", (msg, cat) => expect(governError(new Error(msg)).category).toBe(cat));
  it("validação e falha inesperada têm mensagem humana sem texto cru", () => {
    const t = userErrorText(new Error('null value in column "x" violates not-null constraint'));
    expect(t).not.toMatch(/column|constraint|null value/);
    expect(userErrorText(new Error("kaboom internal"))).not.toMatch(/kaboom/);
  });
  it("mensagem local pt-BR passa; backend é governado", () => {
    expect(presentError(new UserFacingError("Escolha ao menos um dia."))).toBe("Escolha ao menos um dia.");
    expect(presentError(new Error("relation students does not exist"))).not.toMatch(/relation|students/);
  });
  it("tradutores de domínio nunca devolvem o texto cru", () => {
    const sql = 'duplicate key value violates unique constraint "t_pkey"';
    expect(followupMessage(sql)).not.toMatch(/duplicate|pkey/);
    expect(familyMessage(sql)).not.toMatch(/duplicate|pkey/);
    expect(writeRefusalText("cal:weird-internal-code")).not.toMatch(/weird-internal-code/);
  });
  it("confirmação destrutiva exige consequência; sem host falha fechada", async () => {
    expect(() => confirmAction({ title: "Remover?", consequence: " ", actionLabel: "Remover", destructive: true })).toThrow();
    await expect(confirmAction({ title: "Sair?", consequence: "Descarta.", actionLabel: "Sair" })).resolves.toBe(false);
    await expect(askText("Motivo")).resolves.toBeNull();
  });
});
