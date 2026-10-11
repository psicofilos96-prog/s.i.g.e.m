"""LOTE 16 — Alimentação no navegador: Núcleo abre janela → escola pede com teto → Núcleo analisa/autoriza com ciência e programa
entregas (uma atrasada) → escola confere entrega parcial com rejeição → estoque → baixa → Mapa de compras PDF/XLSX."""
import asyncio, json, os, datetime, zipfile
from playwright.async_api import async_playwright
B = "http://localhost:8080"; OUT = "/tmp/fs16"; SH = f"{OUT}/shots"; os.makedirs(SH, exist_ok=True)
cfg = json.load(open(f"{OUT}/s.json")); OP = cfg["op"]
def p(ok, l, x=""): print(f"{'PASS' if ok else 'FAIL'} {l} {x}".rstrip())
today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3))).date()
d = lambda n: (today + datetime.timedelta(days=n)).isoformat()
async def as_user(br, tag):
    ctx = await br.new_context(viewport={"width": 1280, "height": 1800}, accept_downloads=True); pg = await ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
    async def onresp(r):
        if "/rpc/" in r.url and r.status >= 400:
            try: print("RPCERR", r.url.split("/rpc/")[1], r.status, (await r.text())[:220])
            except Exception: pass
    pg.on("response", lambda r: asyncio.ensure_future(onresp(r)))
    await pg.goto(B + "/"); await pg.evaluate("([k,v]) => localStorage.setItem(k, v)", [cfg["key"], json.dumps(cfg["sessions"][tag])])
    await pg.goto(B + "/alimentacao-escolar"); await pg.wait_for_timeout(7000); return ctx, pg, errs
async def status(scope, ms=2500):
    await scope.page.wait_for_timeout(ms) if hasattr(scope, "page") else None
    return " | ".join(await scope.get_by_role("status").all_inner_texts())
async def answer(pg, text):
    dlg = pg.get_by_role("alertdialog"); await dlg.wait_for(timeout=10000)
    await dlg.locator("textarea").fill(text); await dlg.get_by_role("button", name="Continuar").click(); await pg.wait_for_timeout(800)
async def main():
    errs = []
    async with async_playwright() as pw:
        br = await pw.chromium.launch(headless=True)
        # 1) Núcleo abre a janela da competência
        ctx, pg, e = await as_user(br, "nu"); errs += e
        ord_ = pg.locator("section[aria-labelledby=ord]"); await ord_.wait_for(timeout=20000)
        comp = await ord_.get_by_label("Competência").input_value()
        f = ord_.get_by_role("form", name="Abrir janela de pedidos")
        await f.get_by_label("Fecha em").fill(d(5)); await f.get_by_label("Motivo da abertura").fill("Abertura sintética de teste")
        await f.get_by_role("button", name="Abrir janela").click(); s = await status(ord_)
        p("Janela de" in s, "Núcleo abre a janela de pedidos pela tela", s); await ctx.close()
        # 2) Escola monta o pedido, vê o teto explicado e submete
        ctx, pg, e = await as_user(br, "es"); errs += e
        ord_ = pg.locator("section[aria-labelledby=ord]"); await ord_.wait_for(timeout=20000)
        await ord_.get_by_label("Competência").fill(comp); await pg.wait_for_timeout(2500)
        sel = pg.get_by_label("Escola", exact=True)
        if await sel.count() and not await sel.input_value(): await sel.select_option(cfg["schoolA"]); await pg.wait_for_timeout(4000); ord_ = pg.locator("section[aria-labelledby=ord]")
        await ord_.get_by_role("button", name="Adicionar item").click()
        await ord_.get_by_label("Quantidade", exact=True).fill("100")
        await ord_.get_by_label("Público (per capita)").select_option(index=1)
        await ord_.get_by_label("Público atendido").fill("10"); await ord_.get_by_label("Base do público").fill("declaração sintética")
        await ord_.get_by_label("Dias letivos").fill("20"); await ord_.get_by_label("Base dos dias").fill("calendário sintético")
        await pg.wait_for_timeout(3000)
        teto = await ord_.get_by_label("Teto por item").inner_text() if await ord_.get_by_label("Teto por item").count() else ""
        p(len(teto) > 10, "teto do item explicado pelo banco antes de enviar", teto[:160])
        await ord_.get_by_role("button", name="Salvar rascunho").click(); s = await status(ord_); p("Registrado" in s, "escola salva rascunho do pedido", s)
        await ord_.get_by_role("button", name="Submeter pedido").click(); s = await status(ord_); p("Registrado" in s, "escola submete o pedido", s)
        await pg.screenshot(path=f"{SH}/1_escola_pedido.png"); await ctx.close()
        # 3) Núcleo analisa, autoriza com ciência do teto pendente e programa duas entregas (uma já vencida)
        ctx, pg, e = await as_user(br, "nu"); errs += e
        ord_ = pg.locator("section[aria-labelledby=ord]"); await ord_.wait_for(timeout=20000)
        await ord_.get_by_label("Competência").fill(comp); await pg.wait_for_timeout(3000)
        await ord_.get_by_role("button", name="Iniciar análise").click(); s = await status(ord_); p("Registrado" in s, "Núcleo inicia análise", s)
        await ord_.get_by_label("Contrato/empenho para atender").select_option(label=f"{cfg['contract']} · empenho NE-SINTETICA")
        await ord_.get_by_role("button", name="Autorizar como solicitado").click()
        await answer(pg, "Estoque da escola sem registro; conferido com a declaração sintética")
        await answer(pg, "Vinculação ao contrato sintético para consolidação")
        s = await status(ord_, 3500); p("Registrado" in s, "Núcleo autoriza com ciência registrada (teto pendente não autoriza em silêncio)", s)
        sf = ord_.get_by_role("form", name="Programar entrega"); await sf.wait_for(timeout=15000)
        await sf.get_by_label("Quantidade desta entrega").fill("40"); await sf.get_by_label("Data prevista").fill(d(0))
        await sf.get_by_role("button", name="Programar entrega").click(); s = await status(ord_); p("Entrega programada" in s, "programa entrega 1 (40, hoje, contrato da linha)", s)
        sf = ord_.get_by_role("form", name="Programar entrega")
        await sf.get_by_label("Quantidade desta entrega").fill("20"); await sf.get_by_label("Data prevista").fill(d(-1))
        await sf.get_by_role("button", name="Programar entrega").click(); s = await status(ord_); p("Entrega programada" in s, "programa entrega 2 (20, ontem: deve aparecer atrasada)", s)
        sf = ord_.get_by_role("form", name="Programar entrega")
        await sf.get_by_label("Quantidade desta entrega").fill("41"); await sf.get_by_role("button", name="Programar entrega").click(); await pg.wait_for_timeout(2500)
        al = " ".join(await sf.get_by_role("alert").all_inner_texts()); p(len(al) > 0, "programar acima do autorizado é recusado pelo banco", al[:140])
        await pg.screenshot(path=f"{SH}/2_nucleo_autorizado.png")
        # Mapa de compras: XLSX e PDF A4 da mesma consolidação
        try:
            async with pg.expect_download(timeout=20000) as dl: await ord_.get_by_role("button", name="Mapa de compras (XLSX)").click()
            path = f"{OUT}/mapa-compras.xlsx"; await (await dl.value).save_as(path)
            with zipfile.ZipFile(path) as z: xml = " ".join(z.read(n).decode("utf8", "ignore") for n in z.namelist() if n.startswith("xl/"))
            p(cfg["contract"] in xml and "100" in xml, "XLSX do mapa tem item autorizado (100) e contrato", "")
        except Exception as x: p(False, "XLSX do mapa de compras", str(x)[:160])
        try:
            async with pg.expect_popup(timeout=20000) as pop: await ord_.get_by_role("button", name="Mapa de compras (PDF A4)").click()
            w = await pop.value; await w.wait_for_load_state(); html = await w.content()
            await w.pdf(path=f"{OUT}/mapa-compras.pdf", format="A4", print_background=True)
            p("Mapa" in html and "100" in html and "Somente pedidos autorizados" in html, "PDF A4 do mapa gerado com a consolidação autorizada")
        except Exception as x: p(False, "PDF do mapa de compras", str(x)[:160])
        await ctx.close()
        # 4) Escola confere a entrega 1 (40 entregues, 30 aceitos, 10 rejeitados) e vê a entrega 2 atrasada
        ctx, pg, e = await as_user(br, "es"); errs += e
        rec = pg.locator("section[aria-labelledby=rec]"); await rec.wait_for(timeout=20000); await pg.wait_for_timeout(2000)
        tabs = " ".join(await rec.get_by_role("tab").all_inner_texts()); p("Atrasadas (1)" in tabs, "entrega vencida aparece em Atrasadas", tabs)
        await rec.get_by_role("tab", name="Entregas de hoje").click()
        await rec.locator("li", has_text="programado 40").get_by_role("button", name="Conferir entrega").click()
        dlg = rec.get_by_role("dialog", name="Conferir entrega")
        await dlg.get_by_label("Quantidade entregue").fill("40"); await dlg.get_by_label("Quantidade aceita").fill("30")
        await dlg.get_by_role("button", name="Continuar").click(); await dlg.get_by_label("Lote").fill("L-SINT-1"); await dlg.get_by_label("Validade").fill(d(90))
        await dlg.get_by_role("button", name="Continuar").click(); await dlg.get_by_label("Observações").fill("10 avariados (sintético)")
        await dlg.get_by_role("button", name="Confirmar", exact=False).last.click(); s = await status(rec, 3500)
        p("Recebimento confirmado: 30" in s, "escola confirma recebimento parcial (30 aceitos, 10 rejeitados)", s)
        await pg.screenshot(path=f"{SH}/3_escola_recebimento.png")
        # 5) baixa diária no estoque
        fs = pg.locator("fieldset", has_text="Consumo observado, perda ou devolução"); await fs.wait_for(timeout=20000)
        await fs.get_by_label("Item").select_option(index=1); await fs.get_by_label("Classe").select_option(index=0)
        await fs.get_by_label("Quantidade").fill("5"); await fs.get_by_label("Motivo").fill("baixa diária sintética")
        await fs.get_by_role("button", name="Registrar").click(); s = await status(fs); p("Movimento registrado" in s, "escola registra baixa diária no livro de estoque", s)
        await pg.wait_for_timeout(2000); body = await pg.locator("main, body").first.inner_text()
        p("origem: aceite" in body, "livro mostra a entrada com origem no aceite")
        await pg.screenshot(path=f"{SH}/4_escola_estoque.png"); await ctx.close()
        await br.close()
    p(not errs, "sem erro de execução nas telas", str(errs[:3]))
asyncio.run(main())
