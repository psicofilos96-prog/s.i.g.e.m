# TSEMED.1 — navegador autenticado: secretaria A abre a tela, vê Tabela 06 fechada, baixa PDF/XLSX; rede vê situação; sem permissão é recusado.
import asyncio, json, os
from playwright.async_api import async_playwright
S = json.load(open("/tmp/semed/s.json")); OUT = "/tmp/semed"; BASE = "http://localhost:8080"
def check(ok, l): print(("PASS " if ok else "FAIL ") + l)

async def page_for(b, sess):
    ctx = await b.new_context(viewport={"width": 1280, "height": 1800}, accept_downloads=True)
    p = await ctx.new_page(); await p.goto(BASE, wait_until="domcontentloaded")
    await p.evaluate("([k,v]) => localStorage.setItem(k, v)", [S["key"], json.dumps(sess)])
    await p.goto(BASE + "/secretaria/tabelas-semed", wait_until="networkidle"); return p

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(headless=True)
        p = await page_for(b, S["sessions"]["fill"])
        await p.get_by_role("tab", name="Tabela 06").click(); await p.wait_for_timeout(1500)
        await p.screenshot(path=f"{OUT}/fill_t06.png")
        check(await p.get_by_text("Fechado").count() > 0, "tela mostra Tabela 06 fechada")
        check(await p.get_by_text("Histórico").count() > 0, "histórico visível")
        for btn, ext in (("Baixar PDF", "pdf"), ("Baixar XLSX", "xlsx")):
            async with p.expect_download() as d: await p.get_by_role("button", name=btn).click()
            dl = await d.value; path = f"{OUT}/t06.{ext}"; await dl.save_as(path)
            check(os.path.getsize(path) > 1000, f"download {ext.upper()} gerado")
        await p.get_by_role("tab", name="Tabela 04").click(); await p.wait_for_timeout(800)
        check(await p.get_by_role("button", name="Salvar rascunho").count() == 1, "Tabela 04 em rascunho editável")
        check(await p.get_by_text("Apuração pelo cadastro central").count() == 1, "Tabela 04 mostra apuração e lacunas")
        check(await p.get_by_role("img", name="Gráfico de distorção série × idade por linha").count() == 1, "gráfico de distorção na tela")
        await p.get_by_label("m.ef1.a6", exact=True).fill("8"); await p.get_by_label("m.ef1.a8", exact=True).fill("2")
        await p.get_by_role("button", name="Salvar rascunho").click(); await p.wait_for_timeout(1500)
        check(await p.get_by_text("20% (2/10)").count() == 1, "indicador do 1º ano pela regra registrada (2 de 10)")
        await p.screenshot(path=f"{OUT}/fill_t04.png")
        for btn, ext in (("Baixar PDF", "pdf"), ("Baixar XLSX", "xlsx")):
            async with p.expect_download() as d: await p.get_by_role("button", name=btn).click()
            await (await d.value).save_as(f"{OUT}/t04.{ext}")
        check(os.path.getsize(f"{OUT}/t04.pdf") > 1000, "PDF da Tabela 04 gerado")
        n = await page_for(b, S["sessions"]["net"])
        check(await n.get_by_text("Situação na rede").count() == 1, "rede vê quadro da rede"); await n.screenshot(path=f"{OUT}/net.png")
        x = await page_for(b, S["sessions"]["none"]); await x.wait_for_timeout(1500)
        check(await x.get_by_text("Sem acesso às Tabelas SEMED").count() == 1, "conta sem permissão recusada na tela")
        await b.close()
asyncio.run(main())
