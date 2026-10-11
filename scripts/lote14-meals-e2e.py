"""LOTE 14 — Alimentação: fornecedor → contrato → designação de inspetor, com conferência/homologação por outra pessoa."""
import asyncio, json, os
from playwright.async_api import async_playwright
B = "http://localhost:8080"; SH = "/tmp/fs14/shots"; os.makedirs(SH, exist_ok=True)
cfg = json.load(open("/tmp/fs14/s.json")); OP = cfg["op"]; SUP = f"Fornecedor sintético {OP}"
def p(ok, l, x=""): print(f"{'PASS' if ok else 'FAIL'} {l} {x}".rstrip())
async def as_user(br, tag):
    ctx = await br.new_context(viewport={"width": 1280, "height": 1800}); pg = await ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
    await pg.goto(B + "/"); await pg.evaluate("([k,v]) => localStorage.setItem(k, v)", [cfg["key"], json.dumps(cfg["sessions"][tag])])
    await pg.goto(B + "/alimentacao-escolar"); await pg.wait_for_timeout(6000); return ctx, pg, errs
async def st(pg): await pg.wait_for_timeout(2500); return " | ".join(await pg.get_by_role("status").all_inner_texts())
async def tab(pg, name): await pg.get_by_role("tab", name=name).click(); await pg.wait_for_timeout(800)
async def row_action(pg, text, btn):
    li = pg.locator("li", has_text=text).first; await li.get_by_role("button", name=btn).click(); return await st(pg)
async def main():
    async with async_playwright() as pw:
        br = await pw.chromium.launch(headless=True); errs = []
        # 1) autor registra fornecedor
        ctx, pg, e = await as_user(br, "au"); errs += e
        p(await pg.get_by_role("heading", name="Planejamento Nutricional").count() == 1, "autor técnico vê o Planejamento Nutricional")
        f = pg.get_by_role("form", name="Novo registro: Fornecedor")
        await f.get_by_label("Razão social").fill(SUP); await f.get_by_role("button", name="Registrar rascunho").click()
        s = await st(pg); p("Registrado" in s, "autor registra fornecedor (rascunho)", s)
        s = await row_action(pg, SUP, "Conferir"); p("próprio registro" in s, "autor não confere o próprio registro", s)
        await ctx.close()
        # 2) revisor confere e homologa
        ctx, pg, e = await as_user(br, "rv"); errs += e
        s = await row_action(pg, SUP, "Conferir"); p("Registrado" in s, "revisor confere fornecedor", s)
        s = await row_action(pg, SUP, "Homologar"); p("Registrado" in s and "Homologada" in await pg.locator("li", has_text=SUP).first.inner_text(), "revisor homologa fornecedor", s)
        f = pg.get_by_role("form", name="Novo registro: Fornecedor"); await f.get_by_label("Razão social").fill(SUP + " B")
        await f.get_by_role("button", name="Registrar rascunho").click(); s = await st(pg); p("permissão" in s, "revisor sem competência de cadastro é recusado", s)
        await ctx.close()
        # 3) autor registra contrato com o fornecedor homologado; revisor homologa
        ctx, pg, e = await as_user(br, "au"); errs += e
        f = pg.get_by_role("form", name="Novo registro: Processo/ata/contrato/empenho")
        await f.get_by_label("Natureza").fill("contrato"); await f.get_by_label("Número").fill(f"{OP}/2026")
        await f.get_by_label("Fornecedor").select_option(label=SUP); await f.get_by_label("Nota de empenho").fill("NE-SINTETICA")
        await f.get_by_role("button", name="Registrar rascunho").click(); s = await st(pg); p("Registrado" in s, "autor registra contrato com empenho", s)
        # 4) designação de inspetor
        await tab(pg, "Inspetores")
        f = pg.get_by_role("form", name="Novo registro: Designação de inspetor")
        await f.get_by_label("Escola").select_option(index=1); await f.get_by_label("Pessoa designada").fill(cfg["inspector"])
        await f.get_by_role("button", name="Registrar rascunho").click(); s = await st(pg); p("Registrado" in s, "autor registra designação de inspetor", s)
        f = pg.get_by_role("form", name="Novo registro: Designação de inspetor")
        await f.get_by_label("Pessoa designada").fill("nao-e-id"); await f.get_by_role("button", name="Registrar rascunho").click()
        p("identificador inválido" in await f.inner_text(), "formulário recusa identificador inválido")
        await pg.screenshot(path=f"{SH}/1_autor_inspetores.png"); await ctx.close()
        ctx, pg, e = await as_user(br, "rv"); errs += e
        s = await row_action(pg, f"contrato {OP}/2026", "Conferir"); s2 = await row_action(pg, f"contrato {OP}/2026", "Homologar")
        p("Registrado" in s and "Registrado" in s2, "revisor confere e homologa contrato", s2)
        await tab(pg, "Inspetores")
        s = await row_action(pg, cfg["inspector"][:8], "Conferir"); s2 = await row_action(pg, cfg["inspector"][:8], "Homologar")
        p("Registrado" in s and "Registrado" in s2, "revisor confere e homologa a designação", s2)
        txt = await pg.locator("li", has_text=cfg["inspector"][:8]).first.inner_text()
        p("Homologada" in txt and "FUNCTIONAL_SOURCE_REQUIRED" in txt, "designação homologada segue sinalizando fonte funcional pendente", txt[-80:])
        await pg.screenshot(path=f"{SH}/2_revisor_homologa.png"); await ctx.close()
        # 5) conta sem permissão
        ctx, pg, e = await as_user(br, "np"); errs += e
        body = await pg.inner_text("body")
        p("Sem acesso à alimentação escolar" in body and SUP not in body, "conta sem permissão não vê Alimentação nem o fornecedor")
        await pg.screenshot(path=f"{SH}/3_sem_permissao.png"); await ctx.close()
        p(not errs, "sem erro de execução", str(errs[:2])); await br.close()
asyncio.run(main())
