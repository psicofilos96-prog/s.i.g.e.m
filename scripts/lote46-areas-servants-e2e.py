"""L46 — navegador com sessões sintéticas (RH e professor): 10 áreas, rotas, permitido/negado e cadastro funcional.
Imprime só contagens e rótulos; nunca nomes, tokens ou nascimento."""
import asyncio, json, sys
from playwright.async_api import async_playwright

AREAS = ["mediador","nei-aee","alimentacao","avaliacao","organizacao-da-rede","documental","busca-ativa","operacoes","formacao","tecnologia"]
BASE = "http://localhost:8080"

async def session(b, cfg, sess):
    ctx = await b.new_context(viewport={"width": 1280, "height": 1800}); page = await ctx.new_page()
    await page.goto(BASE + "/")
    await page.evaluate("([k,v]) => localStorage.setItem(k, v)", [cfg["key"], json.dumps(sess)])
    return page

async def main():
    cfg = json.load(open("/tmp/l46/session.json")); fails = 0
    def ok(n, c):
        nonlocal fails; fails += 0 if c else 1; print(("PASS " if c else "FAIL ") + n)
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        for who in ("rh", "prof"):
            page = await session(b, cfg, cfg["session"] if who == "rh" else cfg["prof"])
            await page.goto(BASE + "/areas", wait_until="load", timeout=90000)
            await page.get_by_role("heading", name="Áreas de trabalho").wait_for(timeout=60000)
            await page.locator("main a[href^='/areas/']").nth(9).wait_for(timeout=60000)
            ok(f"{who}: /areas lista as áreas", await page.locator("a[href^='/areas/']").count() >= 10)
            for a in AREAS:
                await page.goto(f"{BASE}/areas/{a}", wait_until="load", timeout=90000)
                await page.get_by_text("Área de trabalho", exact=True).first.wait_for(timeout=60000)
                await page.get_by_text("Conferindo sua sessão…").wait_for(state="detached", timeout=60000)
                draft = await page.get_by_text("rascunho, sem homologação").count()
                n_ok = await page.get_by_text("Disponível", exact=True).count(); n_wait = await page.get_by_text("Aguarda homologação", exact=True).count(); n_no = await page.get_by_text("Sem acesso", exact=True).count()
                if a == "mediador": print("debug", n_ok, (await page.inner_text("main"))[:300].replace("\n"," | "))
                ok(f"{who}: {a} renderiza ({n_wait} aguarda/{n_no} sem acesso), nada 'Disponível' em perfil rascunho", draft == 1 and n_ok == 0 and n_wait + n_no >= 1)
            await page.goto(BASE + "/areas/inexistente", wait_until="load")
            try: await page.get_by_text("Área não encontrada").wait_for(timeout=30000); nf = True
            except Exception: nf = False
            ok(f"{who}: área inexistente recusa", nf)
            if who == "rh":
                await page.goto(BASE + "/gestao-de-pessoas", wait_until="load", timeout=90000)
                await page.get_by_text("Folha de agosto/2026").first.click(timeout=60000)
                await page.get_by_text("Cadastros funcionais persistidos").wait_for(timeout=90000)
                await page.wait_for_function("() => [...document.querySelectorAll('section[aria-labelledby=payroll-servants] dd')].every(d => d.textContent.trim() !== '…')", timeout=90000)
                dds = [t.strip() for t in await page.locator("section[aria-labelledby=payroll-servants] dd").all_inner_texts()]
                print("tela RH:", dds); ok("RH vê 2037/1952/85/0/1952 persistidos", dds[:5] == ["2037","1952","85","0","1952"])
                ok("RH vê candidatos a conferir", await page.get_by_text("candidato(s) por matrícula idêntica").count() >= 1)
            await page.context.close()
        await b.close()
    sys.exit(1 if fails else 0)

asyncio.run(main())
