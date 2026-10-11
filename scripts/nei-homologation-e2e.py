"""NEI.7 — navegador autenticado: rotas NEI por papel, PDF de plano, relatório de visita A4, exportação de indicadores."""
import asyncio, json, os
from playwright.async_api import async_playwright
B = "http://localhost:8080"; SH = "/tmp/nei7/shots"; os.makedirs(SH, exist_ok=True)
cfg = json.load(open("/tmp/nei7/s.json")); A = cfg["school"]
ROUTES = ["/inclusao/nei", "/inclusao/nei/ficha", "/inclusao/nei/aee", "/inclusao/nei/apoio", "/inclusao/nei/agenda", "/inclusao/nei/protocolos", "/inclusao/nei/indicadores"]
def p(ok, l, x=""): print(f"{'PASS' if ok else 'FAIL'} {l} {x}".rstrip())
async def as_user(br, tag):
    ctx = await br.new_context(viewport={"width": 1280, "height": 1800}, accept_downloads=True); pg = await ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:160])); pg.on("console", lambda m: errs.append("console:" + m.text[:300]) if m.type == "error" else None)
    await pg.goto(B + "/"); await pg.evaluate("([k,v]) => localStorage.setItem(k, v)", [cfg["key"], json.dumps(cfg["sessions"][tag])]); return ctx, pg, errs
async def visit(pg, r): await pg.goto(B + r); await pg.wait_for_timeout(3500); return await pg.inner_text("body")
async def pick_school(pg):
    sel = pg.get_by_label("Escola").first; opts = await sel.locator("option").evaluate_all("os => os.map(o => o.value)"); print("INFO opções", len(opts), A in opts); await sel.select_option(A); await pg.wait_for_timeout(3000)
async def main():
    async with async_playwright() as pw:
        br = await pw.chromium.launch(headless=True); all_errs = []
        ctx, pg, e = await as_user(br, "coord")
        for r in ROUTES:
            t = await visit(pg, r); p("Carregando…" not in t[:4000] or r == "/inclusao/nei/ficha", f"coordenação abre {r} sem ficar carregando")
            await pg.screenshot(path=f"{SH}/coord{r.replace('/', '_')}.png")
        t = await visit(pg, "/inclusao/nei/agenda"); await pick_school(pg); t = await pg.inner_text("body"); await pg.screenshot(path=f"{SH}/coord_agenda_A.png"); print("INFO errs", e[:3])
        p("Visita técnica " + cfg["op"] in t and "nº" in t, "agenda mostra visita e protocolo do fluxo")
        try:
            async with pg.expect_popup() as pp: await pg.get_by_role("button", name="Imprimir relatório (A4)").first.click()
            pop = await pp.value; await pop.wait_for_load_state(); await pop.pdf(path="/tmp/nei7/visita.pdf", format="A4")
            p(os.path.getsize("/tmp/nei7/visita.pdf") > 2000 and "Relatório de visita técnica" in await pop.content(), "relatório de visita gera PDF A4"); await pop.close()
        except Exception as x: p(False, "relatório de visita gera PDF A4", str(x)[:120])
        await visit(pg, "/inclusao/nei/indicadores"); await pg.wait_for_timeout(2000)
        for fmt in ["XLSX", "PDF"]:
            try:
                async with pg.expect_download() as dd: await pg.get_by_role("button", name=f"Exportar {fmt}").click()
                d = await dd.value; out = f"/tmp/nei7/indicadores.{fmt.lower()}"; await d.save_as(out)
                body = open(out, "rb").read(); p(len(body) > 1000 and cfg["op"].encode() not in body, f"indicadores exportam {fmt} sem identificar estudante", f"{len(body)} bytes")
            except Exception as x: p(False, f"indicadores exportam {fmt}", str(x)[:120])
        await pg.screenshot(path=f"{SH}/coord_indicadores_final.png")
        await visit(pg, "/inclusao/nei/ficha")
        try:
            await pick_school(pg)
            p(True, "ficha: seleção de escola disponível")
        except Exception as x: p(False, "ficha: seleção de escola", str(x)[:100])
        all_errs += e; await ctx.close()
        for tag, label in [("tecb", "técnico B"), ("apo", "apoio sem papel"), ("doc", "docente")]:
            ctx, pg, e = await as_user(br, tag)
            t = await visit(pg, "/inclusao/nei/agenda")
            try: await pick_school(pg); t = await pg.inner_text("body")
            except Exception: pass
            p(("Visita técnica " + cfg["op"]) not in t and ("Encaminhamento " + cfg["op"]) not in t, f"{label} não vê agenda/protocolos da escola A")
            t = await visit(pg, "/inclusao/nei/indicadores"); p(("Sem escolas no seu escopo" in t) if tag != "tecb" else (await pg.locator(f"option[value='{A}']").count() == 0), f"{label}: indicadores recusados sem vazar", t[t.find("Indicadores"):][:120].replace(chr(10)," "))
            await pg.screenshot(path=f"{SH}/{tag}_indicadores.png"); all_errs += e; await ctx.close()
        ctx, pg, e = await as_user(br, "dir")
        t = await visit(pg, "/inclusao/nei/protocolos"); await pg.screenshot(path=f"{SH}/dir_inbox.png"); print("INFO dir errs", e[:3]); p("Encaminhamento " + cfg["op"] in t and "Solicitamos" not in t, "direção vê protocolo na caixa sem o conteúdo")
        await pg.locator("button", has_text="Encaminhamento " + cfg["op"]).first.click(); await pg.wait_for_timeout(2000)
        t = await pg.inner_text("body"); p("Solicitamos reunião" in t and "Devolutiva dada" in t, "direção abre e vê a devolutiva registrada")
        await pg.screenshot(path=f"{SH}/dir_protocolos.png"); all_errs += e; await ctx.close()
        p(not all_errs, "sem erro de execução nas telas", str(all_errs[:3])); await br.close()
asyncio.run(main())
