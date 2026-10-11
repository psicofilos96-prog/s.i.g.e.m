"""Painéis por setor no navegador autenticado (contas sintéticas A=secretaria, B=professor). Nunca imprime tokens."""
import asyncio, json, os
from playwright.async_api import async_playwright
B = "http://localhost:8080"; SH = "/tmp/rep/sectors"; os.makedirs(SH, exist_ok=True)
def ok(c, m): print(("PASS " if c else "FAIL ") + m)

async def login(br, sess, key):
    ctx = await br.new_context(viewport={"width": 1280, "height": 1800}); pg = await ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
    await pg.goto(B + "/"); await pg.evaluate("([k,v]) => localStorage.setItem(k, v)", [key, json.dumps(sess)])
    await pg.goto(B + "/relatorios/setores"); await pg.wait_for_selector("nav[aria-label='Setores']", timeout=40000)
    return ctx, pg, errs

async def main():
    cfg = json.load(open("/tmp/rep/sb.json"))
    async with async_playwright() as p:
        br = await p.chromium.launch(headless=True)
        ctx = await br.new_context(); pg = await ctx.new_page(); await pg.goto(B + "/relatorios/setores"); await pg.wait_for_timeout(3000)
        ok("Entre com sua conta" in await pg.inner_text("main"), "anônimo só vê convite para entrar"); await ctx.close()

        ctx, pg, errs = await login(br, cfg["A"], cfg["key"])
        sectors = await pg.locator("nav[aria-label='Setores'] button").all_inner_texts()
        ok(len(sectors) >= 8, f"setores oferecidos à conta A: {len(sectors)}")
        await pg.get_by_role("button", name="Secretaria Escolar").click(); await pg.wait_for_timeout(6000)
        ind = pg.locator("[data-indicator='mat']"); t = await ind.inner_text()
        rows = await ind.locator("tbody tr").count()
        ok(rows == 1, f"Secretaria A: matrículas agrupadas só na própria escola ({rows} grupo)")
        val = await ind.locator("tbody tr td").nth(1).inner_text() if rows else ""
        ok(val == str(cfg["matA"]), f"valor do indicador = leitura real da conta ({val} vs {cfg['matA']})")
        al = pg.locator("[data-alert='matricula-sem-inicio']"); n = int(await al.get_attribute("data-count") or -1)
        ok(n >= 0, f"alerta matrículas sem início lido: {n}")
        if n > 0:
            await al.get_by_role("button", name="Ver registros").click(); await pg.wait_for_timeout(4000)
            ok(await al.locator("[aria-label='Registros autorizados'] tbody tr").count() > 0, "alerta abre registros autorizados")
        await ind.locator("tbody button").first.click(); await pg.wait_for_timeout(4000)
        dr = ind.locator("[aria-label='Registros autorizados']"); dt = await dr.inner_text() if await dr.count() else ""
        ok(f"{cfg['matA']} registro" in dt, "drill-down mostra os registros do grupo: " + dt[-40:].replace("\n", " "))
        ok(await pg.locator("[aria-label='Ações'] a[href='/secretaria']").count() == 1, "ação leva à estação da Secretaria")
        await pg.screenshot(path=f"{SH}/1-secretaria.png")
        for s, label in [("Alimentação Escolar", "Alimentação"), ("Mediador / AEE", "Mediador")]:
            await pg.get_by_role("button", name=s).click(); await pg.wait_for_timeout(800)
            ok(await pg.locator("[aria-label='Lacuna declarada']").count() == 1 and await pg.locator("[data-indicator]").count() == 0, f"{label}: lacuna declarada, sem número inventado")
        for s in ["CIECE — Informação e Estatística", "Direção Escolar", "Diário", "Mapa Estatístico", "Acompanhamento e Avaliação", "Supervisão Escolar"]:
            await pg.get_by_role("button", name=s).click(); await pg.wait_for_timeout(5000)
            txt = await pg.locator("section[aria-label^='Painel']").inner_text()
            ok("Lendo" not in txt, f"{s}: carregou sem ficar preso em 'Lendo'")
        await pg.screenshot(path=f"{SH}/2-supervisao.png")
        ok(not errs, f"sem erro de execução (A) {errs[:2]}"); await ctx.close()

        ctx, pg, errs = await login(br, cfg["B"], cfg["key"])
        await pg.get_by_role("button", name="Docente").click(); await pg.wait_for_timeout(6000)
        est = pg.locator("[data-indicator='est']"); vals = [int(x) for x in await est.locator("tbody tr td:nth-child(2)").all_inner_texts() if x.isdigit()]
        ok(sum(vals) <= 15 and sum(vals) < cfg["matA"], f"Docente B vê só estudantes das próprias turmas ({sum(vals)})")
        await pg.get_by_role("button", name="Secretaria Escolar").click(); await pg.wait_for_timeout(6000)
        t = await pg.locator("[data-indicator='mat']").inner_text()
        ok(str(cfg["matA"]) not in t, "professor não vê o total de matrículas da escola")
        await pg.screenshot(path=f"{SH}/3-docente.png")
        ok(not errs, f"sem erro de execução (B) {errs[:2]}")
        await br.close()
asyncio.run(main())
