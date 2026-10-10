"""LOTE 7 — navegador autenticado: Folha Final (turma real, frequência, Boletim/Ficha) e tela de regras. Nunca imprime tokens."""
import asyncio, json, os
from playwright.async_api import async_playwright
B = "http://localhost:8080"; SH = "/tmp/fs7/shots"; os.makedirs(SH, exist_ok=True)
async def main():
    cfg = json.load(open("/tmp/fs7/s.json"))
    async with async_playwright() as p:
        br = await p.chromium.launch(headless=True)
        ctx = await br.new_context(viewport={"width": 1280, "height": 1800}); pg = await ctx.new_page()
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
        await pg.goto(B + "/"); await pg.evaluate("([k,v]) => localStorage.setItem(k, v)", [cfg["key"], json.dumps(cfg["session"])])
        await pg.goto(B + "/diario/regras-folha-final"); await pg.wait_for_timeout(5000)
        await pg.get_by_label("Nome da regra").fill("Teste E2E"); await pg.get_by_label("Vigente a partir de").fill("2026-01-01")
        await pg.get_by_label("Nota mínima de aprovação (0–100)").fill("50"); await pg.get_by_label("Fonte da regra (documento, deliberação ou decisão)").fill("teste e2e")
        await pg.get_by_role("button", name="Registrar rascunho").click(); await pg.wait_for_timeout(3000)
        st = await pg.get_by_role("status").all_inner_texts(); print(f"{'PASS' if any('permissão' in s for s in st) else 'FAIL'} regras: conta sem capacidade é recusada pelo servidor:", st)
        await pg.screenshot(path=f"{SH}/regras.png")
        await pg.goto(B + "/diario/folha-final"); await pg.wait_for_timeout(5000)
        sel = pg.get_by_label("Turma"); n = await sel.locator("option").count(); print("INFO turmas visíveis:", n - 1)
        if n > 1:
            await sel.select_option(index=1); await pg.get_by_label("Modalidade da folha (declarada por você)").select_option("fundamental-anos-finais")
            await pg.wait_for_timeout(5000)
            t = await pg.inner_text("main"); print(f"{'PASS' if 'Frequência: lida das chamadas' in t else 'FAIL'} frequência ligada"); print("INFO", [l for l in t.splitlines() if "estudante" in l.lower()][:2])
            for name in ["Boletins A4 (PDF)", "Fichas individuais A4 (PDF)"]:
                b = pg.get_by_role("button", name=name)
                if await b.is_disabled(): print("INFO", name, "desabilitado (turma sem estudantes)"); continue
                async with pg.expect_popup(timeout=15000) as pp: await b.click()
                pop = await pp.value; await pop.wait_for_load_state(); h = await pop.content()
                print(f"{'PASS' if 'A4 portrait' in h and 'impressão digital' in h else 'FAIL'} {name} da mesma fonte"); await pop.screenshot(path=f"{SH}/{name[:6]}.png"); await pop.close()
            await pg.get_by_label("Modalidade da folha (declarada por você)").select_option("educacao-infantil"); await pg.wait_for_timeout(800)
            print(f"{'PASS' if await pg.get_by_role('link', name='Abrir o parecer descritivo desta turma').count() else 'FAIL'} EI leva ao parecer descritivo")
            await pg.screenshot(path=f"{SH}/folha.png")
        print(f"{'PASS' if not errs else 'FAIL'} sem erro de execução", errs[:2])
        await br.close()
asyncio.run(main())
