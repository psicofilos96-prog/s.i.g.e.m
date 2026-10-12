"""L42 — abre Gestão de Pessoas com a sessão sintética (arquivo temporário 0600, apagado pelo harness)
e confere os totais da folha na tela. Imprime só contagens; nunca nomes, tokens ou nascimento."""
import asyncio, json, re, sys
from playwright.async_api import async_playwright

async def main():
    cfg = json.load(open("/tmp/l42/session.json"))
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width": 1280, "height": 1800}); page = await ctx.new_page()
        await page.goto("http://localhost:8080/")
        await page.evaluate("([k,v]) => localStorage.setItem(k, v)", [cfg["key"], json.dumps(cfg["session"])])
        await page.goto("http://localhost:8080/gestao-de-pessoas", wait_until="load", timeout=90000)
        await page.get_by_text("Folha de agosto/2026").first.click(timeout=60000)
        await page.get_by_text("Vínculos (matrículas)").wait_for(timeout=90000)
        dds = [t.strip() for t in await page.locator("section[aria-labelledby=payroll-servants] dd").all_inner_texts()]
        print("tela:", dds)
        await page.get_by_label("Só com mais de um vínculo").check()
        n = await page.get_by_text(re.compile(r"^\d+ servidor\(es\)$")).inner_text()
        print("filtro múltiplos:", n)
        await page.locator("section[aria-labelledby=payroll-servants]").screenshot(path="/tmp/l42/tela.png")
        await b.close()
        good = dds[:4] == ["2037", "1952", "85", "0"] and n.startswith("85 ")
        sys.exit(0 if good else 1)

asyncio.run(main())
