"""LOTE 11 — aceite visual autenticado: layout (logo/brasão, cabeçalho, assinaturas), prévia, PDF real, XLSX/CSV.
Sessão vem de /tmp/rep/s.json (conta sintética efêmera do harness); nunca imprime tokens."""
import asyncio, json, os
from playwright.async_api import async_playwright
B = "http://localhost:8080"; OUT = "/tmp/rep/l11"; os.makedirs(OUT, exist_ok=True)
async def run(br, cfg, sector, subject, tag):
    ctx = await br.new_context(viewport={"width": 1280, "height": 1800}, accept_downloads=True); pg = await ctx.new_page()
    await pg.goto(B + "/"); await pg.evaluate("([k,v]) => localStorage.setItem(k, v)", [cfg["key"], json.dumps(cfg["session"])])
    await pg.goto(B + "/relatorios"); await pg.wait_for_timeout(5000)
    g = pg.get_by_role("region", name="Gerador de relatórios")
    if sector: await g.get_by_label("Setor").select_option(label=sector); await pg.wait_for_timeout(800)
    card = g.locator("li", has_text=subject).filter(has=pg.get_by_role("button", name="Escolher")).first
    if not await card.count():
        print(f"INFO [{tag}] assunto '{subject}' indisponível para esta conta:", (await g.locator("li", has_text=subject).first.inner_text())[:200] if await g.locator("li", has_text=subject).count() else "não listado")
        await pg.screenshot(path=f"{OUT}/{tag}-0-assuntos.png"); await ctx.close(); return
    await card.get_by_role("button", name="Escolher").click(); await pg.wait_for_timeout(500)
    steps = g.get_by_role("list", name="Etapas").get_by_role("button")
    await steps.nth(6).click(); await pg.wait_for_timeout(400)
    await g.get_by_label("Título").fill(f"{subject} — aceite visual")
    await g.get_by_label("Cabeçalho (uma linha por linha)").fill("Prefeitura Municipal de Itaperuna\nSecretaria Municipal de Educação")
    await g.get_by_label("Logo ou brasão").select_option(label="Brasão de Itaperuna"); await pg.wait_for_timeout(800)
    await g.get_by_label("Assinaturas (até 4, uma por linha)").fill("Secretário(a) Escolar\nDiretor(a)")
    await g.get_by_label("Rodapé").fill("SIGEM — documento de trabalho")
    logo_ok = await g.get_by_role("img", name="Prévia da logo escolhida").evaluate("i => i.complete && i.naturalWidth > 0")
    print(f"{'PASS' if logo_ok else 'FAIL'} [{tag}] brasão carregado na escolha do layout")
    await pg.screenshot(path=f"{OUT}/{tag}-1-layout.png")
    await steps.nth(7).click(); await pg.wait_for_timeout(6000)
    await pg.screenshot(path=f"{OUT}/{tag}-2-previa.png")
    txt = await g.inner_text(); print(f"INFO [{tag}] prévia:", " | ".join(l for l in txt.splitlines() if "inha" in l or "não" in l.lower())[:300])
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
