"""LOTE 13 — Quadro Permanente: criar etapa, nova versão com motivo, histórico, PDF A4 real, conta sem permissão recusada."""
import asyncio, json, os
from playwright.async_api import async_playwright
B = "http://localhost:8080"; SH = "/tmp/fs13/shots"; os.makedirs(SH, exist_ok=True)
cfg = json.load(open("/tmp/fs13/s.json")); STAGE = cfg["op"] + " Fundamental I — 3º ano"
def p(ok, l, x=""): print(f"{'PASS' if ok else 'FAIL'} {l} {x}".rstrip())
async def as_user(br, tag):
    ctx = await br.new_context(viewport={"width": 1280, "height": 1800}); pg = await ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
    await pg.goto(B + "/"); await pg.evaluate("([k,v]) => localStorage.setItem(k, v)", [cfg["key"], json.dumps(cfg["sessions"][tag])])
    await pg.goto(B + "/quadro-permanente-op"); await pg.wait_for_timeout(4000); return ctx, pg, errs
async def st(pg): await pg.wait_for_timeout(2000); return " | ".join(await pg.get_by_role("status").all_inner_texts())
async def main():
    async with async_playwright() as pw:
        br = await pw.chromium.launch(headless=True)
        ctx, pg, e1 = await as_user(br, "op")
        await pg.get_by_role("button", name="Novo quadro de etapa").click()
        await pg.get_by_label("Etapa", exact=True).fill(STAGE); await pg.get_by_label("Título", exact=True).fill("Quadro E2E sintético")
        await pg.get_by_label("Seção 1", exact=True).fill("Rotina"); await pg.get_by_label("Texto da seção 1").fill("Texto sintético de teste — não normativo.")
        await pg.get_by_role("button", name="Gravar versão").click(); s = await st(pg); p("Versão gravada" in s, "técnico de teste grava v1", s)
        item = pg.locator("li", has_text=STAGE)
        p(await item.count() == 1 and "v1" in await item.inner_text(), "quadro da etapa aparece como v1")
        await item.get_by_role("button", name="Nova versão").click()
        await pg.get_by_label("Título", exact=True).fill("Quadro E2E sintético revisto")
        await pg.get_by_role("button", name="Gravar versão").click(); s = await st(pg); p("motivo" in s.lower(), "nova versão sem motivo é recusada", s)
        await pg.get_by_label("Motivo").fill("ajuste de teste"); await pg.get_by_role("button", name="Gravar versão").click(); s = await st(pg)
        p("Versão gravada" in s and "v2" in await item.inner_text(), "v2 gravada com motivo", s)
        await item.get_by_role("button", name="Histórico").click(); await pg.wait_for_timeout(500)
        h = await item.inner_text(); p("v1" in h and "v2" in h and "ajuste de teste" in h, "histórico preserva v1 e v2 com motivo")
        await pg.screenshot(path=f"{SH}/1_quadro.png")
        async with pg.expect_popup() as pp: await item.get_by_role("button", name="Imprimir / PDF").click()
        pop = await pp.value; await pop.wait_for_load_state(); await pop.pdf(path="/tmp/fs13/quadro.pdf", format="A4")
        p(os.path.getsize("/tmp/fs13/quadro.pdf") > 2000 and "versão 2" in await pop.content(), "PDF A4 real da versão vigente", f"{os.path.getsize('/tmp/fs13/quadro.pdf')} bytes"); await pop.close(); await ctx.close()
        ctx, pg, e2 = await as_user(br, "np")
        p(STAGE in await pg.inner_text("body"), "outra conta autenticada lê o quadro (orientação da rede)")
        await pg.get_by_role("button", name="Novo quadro de etapa").click()
        await pg.get_by_label("Etapa", exact=True).fill(STAGE + " B"); await pg.get_by_label("Título", exact=True).fill("tentativa"); await pg.get_by_label("Seção 1", exact=True).fill("x")
        await pg.get_by_role("button", name="Gravar versão").click(); s = await st(pg); p("não tem permissão" in s, "conta sem permissão é recusada pelo servidor", s)
        await pg.screenshot(path=f"{SH}/2_sem_permissao.png"); await ctx.close()
        p(not (e1 + e2), "sem erro de execução", str((e1 + e2)[:2])); await br.close()
asyncio.run(main())
