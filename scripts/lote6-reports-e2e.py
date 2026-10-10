"""LOTE 6 — navegador autenticado no gerador. Nunca imprime tokens."""
import asyncio, json, os
from playwright.async_api import async_playwright
B = "http://localhost:8080"; SH = "/tmp/rep/shots"; os.makedirs(SH, exist_ok=True)
async def main():
    cfg = json.load(open("/tmp/rep/s.json"))
    async with async_playwright() as p:
        br = await p.chromium.launch(headless=True)
        # anônimo
        ctx = await br.new_context(viewport={"width": 1280, "height": 1800}); pg = await ctx.new_page()
        await pg.goto(B + "/relatorios"); await pg.wait_for_timeout(4000)
        await pg.screenshot(path=f"{SH}/0-anon.png"); print("INFO anon:", (await pg.inner_text("body"))[:0] or "ok"); await ctx.close()
        ctx = await br.new_context(viewport={"width": 1280, "height": 1800}, accept_downloads=True); pg = await ctx.new_page()
        await pg.goto(B + "/"); await pg.evaluate("([k,v]) => localStorage.setItem(k, v)", [cfg["key"], json.dumps(cfg["session"])])
        await pg.goto(B + "/relatorios"); await pg.wait_for_timeout(5000)
        g = pg.get_by_role("region", name="Gerador de relatórios")
        await g.get_by_role("button", name="Escolher").first.click(); await pg.wait_for_timeout(500)
        steps = g.get_by_role("list", name="Etapas").get_by_role("button")
        n = await steps.count(); await steps.nth(n - 1).click(); await pg.wait_for_timeout(500)
        lb = g.get_by_role("button", name="Ler dados")
        if await lb.count(): await lb.click()
        await pg.wait_for_timeout(5000); await pg.screenshot(path=f"{SH}/1-lido.png")
        txt = await g.inner_text(); print("INFO linhas/prov:", " | ".join(l for l in txt.splitlines() if "inha" in l)[:300])
        try:
            async with pg.expect_download(timeout=20000) as d: await g.get_by_role("button", name="XLSX").click()
            dl = await d.value; path = f"/tmp/rep/{dl.suggested_filename}"; await dl.save_as(path); print("PASS XLSX baixado", os.path.getsize(path), "bytes")
        except Exception as e: print("FAIL XLSX", str(e)[:200])
        await pg.wait_for_timeout(1500)
        st = await g.get_by_role("status").all_inner_texts(); print("INFO status:", st)
        code = next((s.split("código ")[1].split(" ")[0].strip(".") for s in st if "código " in s), None)
        try:
            async with pg.expect_popup(timeout=20000) as pp: await g.get_by_role("button", name="PDF (imprimir)").click()
            pop = await pp.value; await pop.wait_for_load_state()
            html = await pop.content(); print(f"{'PASS' if 'QR de verificação' in html else 'FAIL'} PDF A4 com QR")
            await pop.screenshot(path=f"{SH}/2-pdf.png"); await pop.close()
        except Exception as e: print("FAIL PDF", str(e)[:200])
        await pg.wait_for_timeout(2000)
        rb = g.get_by_role("button", name="Reprocessar (reler dados atuais)")
        print("INFO emissões listadas:", await rb.count())
        if await rb.count():
            await rb.first.click(); await pg.wait_for_timeout(800)
            await pg.screenshot(path=f"{SH}/2b-reissue.png")
            lb = g.get_by_role("button", name="Ler dados").first
            await lb.click(timeout=10000); await pg.wait_for_timeout(4000)
            try:
                async with pg.expect_download(timeout=20000) as d: await g.get_by_role("button", name="XLSX").click()
                await d.value; await pg.wait_for_timeout(1500)
                st = await g.get_by_role("status").all_inner_texts(); print(f"{'PASS' if any('idêntico' in s or 'DIFERENTE' in s for s in st) else 'FAIL'} reemissão com comparação de hash:", [s[:120] for s in st])
            except Exception as e: print("FAIL reemissão", str(e)[:200])
        await pg.screenshot(path=f"{SH}/3-reemissao.png")
        if code:
            c2 = await br.new_context(viewport={"width": 1280, "height": 1800}); v = await c2.new_page()
            await v.goto(f"{B}/verificar/relatorio/{code}"); await v.wait_for_timeout(4000)
            t = await v.inner_text("body"); print(f"{'PASS' if 'Emitido' in t else 'FAIL'} verificação pública do código")
            await v.screenshot(path=f"{SH}/4-verificar.png"); await c2.close()
        await br.close()
asyncio.run(main())
