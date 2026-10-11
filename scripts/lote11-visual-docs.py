"""LOTE 11 — aceite visual autenticado: layout (logo/brasão, cabeçalho, assinaturas), prévia, PDF real, XLSX/CSV.
Sessão vem de /tmp/rep/s.json (conta sintética efêmera do harness); nunca imprime tokens."""
import asyncio, json, os
from playwright.async_api import async_playwright
B = "http://localhost:8080"; OUT = "/tmp/rep/l11"; os.makedirs(OUT, exist_ok=True)
async def run(br, cfg, sector, subject, tag):
    ctx = await br.new_context(viewport={"width": 1280, "height": 1800}, accept_downloads=True); pg = await ctx.new_page()
    await pg.goto(B + "/"); await pg.evaluate("([k,v]) => localStorage.setItem(k, v)", [cfg["key"], json.dumps(cfg["session"])])
    async def onresp(r):
        if "meal_reporting" in r.url:
            try: print(f"INFO [{tag}] rpc", r.status, (await r.text())[:200])
            except Exception: pass
    pg.on("response", lambda r: asyncio.ensure_future(onresp(r)))
    await pg.goto(B + "/relatorios")
    g = pg.get_by_role("region", name="Gerador de relatórios")
    await g.get_by_role("button", name="Escolher").first.wait_for(timeout=30000)
    if sector: await g.locator("select").first.select_option(label=sector); await pg.wait_for_timeout(800)
    card = g.locator("li", has_text=subject).filter(has=pg.get_by_role("button", name="Escolher")).first
    if not await card.count():
        print(f"INFO [{tag}] assunto '{subject}' indisponível para esta conta:", (await g.locator("li", has_text=subject).first.inner_text())[:200] if await g.locator("li", has_text=subject).count() else "não listado")
        await pg.screenshot(path=f"{OUT}/{tag}-0-assuntos.png"); await ctx.close(); return
    await card.get_by_role("button", name="Escolher").click(); await pg.wait_for_timeout(500)
    steps = g.get_by_role("list", name="Etapas").get_by_role("button")
    if tag == "alimentacao":
        await steps.nth(1).click(); await pg.wait_for_timeout(300)
        await g.get_by_label("De", exact=True).fill("01/01/2026"); await g.get_by_label("Até", exact=True).fill("31/12/2026")
    await steps.nth(6).click(); await pg.wait_for_timeout(400)
    await g.get_by_label("Título", exact=True).fill(f"{subject} — aceite visual")
    await g.get_by_label("Cabeçalho (uma linha por linha)").fill("Prefeitura Municipal de Itaperuna\nSecretaria Municipal de Educação")
    await g.get_by_label("Logo ou brasão").select_option(label="Brasão de Itaperuna"); await pg.wait_for_timeout(800)
    await g.get_by_label("Assinaturas (até 4, uma por linha)").fill("Secretário(a) Escolar\nDiretor(a)")
    await g.get_by_label("Rodapé", exact=True).fill("SIGEM — documento de trabalho")
    logo_ok = await g.get_by_role("img", name="Prévia da logo escolhida").evaluate("i => i.complete && i.naturalWidth > 0")
    print(f"{'PASS' if logo_ok else 'FAIL'} [{tag}] brasão carregado na escolha do layout")
    await pg.screenshot(path=f"{OUT}/{tag}-1-layout.png")
    await steps.nth(7).click(); await pg.wait_for_timeout(6000)
    await pg.screenshot(path=f"{OUT}/{tag}-2-previa.png")
    txt = await g.inner_text(); print(f"INFO [{tag}] prévia:", " | ".join(l for l in txt.splitlines() if "inha" in l or "não" in l.lower())[:300])
    if tag == "escolas":
        await steps.nth(8).click(); await pg.wait_for_timeout(1500)
        await g.get_by_label("Nome do modelo").fill("Aceite L11 escolas")
        await g.get_by_role("button", name="Salvar modelo").click(); await pg.wait_for_timeout(3000)
        await steps.nth(6).click(); await g.get_by_label("Cabeçalho (uma linha por linha)").fill("Prefeitura Municipal de Itaperuna\nSecretaria Municipal de Educação\nCIECE")
        await steps.nth(8).click(); await pg.wait_for_timeout(500)
        await g.get_by_role("button", name="Salvar nova versão").click(); await pg.wait_for_timeout(3000)
        t = await g.inner_text(); ok = "v2" in t
        print(f"{'PASS' if ok else 'FAIL'} [{tag}] modelo versionado salvo na conta (v1 → v2)")
        await pg.screenshot(path=f"{OUT}/{tag}-1b-modelo.png")
        await pg.reload(); await g.get_by_role("button", name="Escolher").first.wait_for(timeout=30000)
        b = g.get_by_role("button", name="Aceite L11 escolas · v2")
        print(f"{'PASS' if await b.count() else 'FAIL'} [{tag}] modelo v2 reaberto após recarregar (persistido no servidor)")
        if await b.count():
            await b.click(); await steps.nth(6).click()
            hv = await g.get_by_label("Cabeçalho (uma linha por linha)").input_value(); lv = await g.get_by_label("Logo ou brasão").input_value()
            print(f"{'PASS' if 'CIECE' in hv and 'assets-v1' in lv else 'FAIL'} [{tag}] cabeçalho e brasão restaurados do modelo")
        await steps.nth(7).click(); await pg.wait_for_timeout(5000)
    await steps.nth(9).click(); await pg.wait_for_timeout(800)
    for fmt in ["CSV", "XLSX"]:
        try:
            async with pg.expect_download(timeout=20000) as d: await g.get_by_role("button", name=fmt, exact=True).click()
            dl = await d.value; p = f"{OUT}/{tag}.{fmt.lower()}"; await dl.save_as(p); print(f"PASS [{tag}] {fmt} baixado {os.path.getsize(p)} bytes"); await pg.wait_for_timeout(1500)
        except Exception as e: print(f"FAIL [{tag}] {fmt}", str(e)[:160])
    try:
        async with pg.expect_popup(timeout=20000) as pp: await g.get_by_role("button", name="PDF (imprimir)").click()
        pop = await pp.value; await pop.wait_for_load_state(); await pop.wait_for_timeout(2500)
        imgs = await pop.evaluate("[...document.images].map(i => ({alt:i.alt, ok:i.complete && i.naturalWidth>0, src:i.src.slice(0,40)}))")
        print(f"INFO [{tag}] imagens no PDF:", imgs)
        await pop.pdf(path=f"{OUT}/{tag}.pdf", prefer_css_page_size=True, print_background=True)
        print(f"PASS [{tag}] PDF real gravado pelo motor de impressão do navegador")
    except Exception as e: print(f"FAIL [{tag}] PDF", str(e)[:200])
    st = await g.get_by_role("status").all_inner_texts(); print(f"INFO [{tag}] status:", [s[:140] for s in st])
    await ctx.close()
async def main():
    cfg = json.load(open("/tmp/rep/s.json"))
    async with async_playwright() as p:
        br = await p.chromium.launch(headless=True)
        await run(br, cfg, None, "Cadastro das escolas", "escolas")
        await run(br, cfg, "NAE (Alimentação)", "Alimenta", "alimentacao")
        await br.close()
asyncio.run(main())
