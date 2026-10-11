"""Gerador personalizado no navegador autenticado (conta sintética). Monta relatório de 3 cruzamentos pela tela,
prévia, salva modelo, reabre após recarregar, exporta XLSX e PDF com QR. Nunca imprime tokens."""
import asyncio, json, os
from playwright.async_api import async_playwright
B = "http://localhost:8080"; SH = "/tmp/rep/custom"; os.makedirs(SH, exist_ok=True)

async def pick(pg, label, value):
    try: await pg.get_by_label(label, exact=True).first.select_option(value=value, timeout=8000)
    except Exception:
        await pg.screenshot(path=f"{SH}/erro-{label}.png"); sec = await pg.get_by_role("region", name="Agrupamento e cálculos").inner_text() if await pg.get_by_role("region", name="Agrupamento e cálculos").count() else ""
        print("DEBUG", label, value, "|", sec[:400].replace("\n", " / ")); raise
    await pg.wait_for_timeout(250)
    if os.environ.get("RCQ_DEBUG"):
        r = pg.get_by_role("region", name="Agrupamento e cálculos")
        if await r.count(): print("TRACE", label, value, "|", (await r.inner_text())[:160].replace("\n", " / "))

async def main():
    cfg = json.load(open("/tmp/rep/s.json"))
    async with async_playwright() as p:
        br = await p.chromium.launch(headless=True)
        ctx = await br.new_context(viewport={"width": 1280, "height": 1800}); pg = await ctx.new_page()
        await pg.goto(B + "/relatorios/personalizado"); await pg.wait_for_timeout(3000)
        print(("PASS" if "Entre com sua conta" in await pg.inner_text("main") else "FAIL") + " anônimo vê só o convite para entrar"); await ctx.close()

        ctx = await br.new_context(viewport={"width": 1280, "height": 1800}, accept_downloads=True); pg = await ctx.new_page()
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
        await pg.goto(B + "/"); await pg.evaluate("([k,v]) => localStorage.setItem(k, v)", [cfg["key"], json.dumps(cfg["session"])])
        await pg.goto(B + "/relatorios/personalizado"); await pg.wait_for_selector("select[aria-label='Fonte principal']", timeout=30000)
        await pick(pg, "Fonte principal", "vinculos")
        for j in ["vinculo_turma", "vinculo_escola", "vinculo_estudante"]: await pick(pg, "Acrescentar cruzamento", j)
        gaps = await pg.locator("[aria-label='Ligações inexistentes']").count()
        await pick(pg, "Acrescentar agrupamento", "escolas.nome"); await pick(pg, "Acrescentar agrupamento", "turmas.turma")
        await pick(pg, "Cálculo 1", "count_distinct"); await pick(pg, "Campo do cálculo 1", "vinculos.student_id")
        await pg.get_by_label("Título do cálculo 1").fill("Estudantes distintos")
        await pg.get_by_label("Subtotais e total geral").check()
        await pg.get_by_role("button", name="+ condição").first.click(); await pg.wait_for_timeout(200)
        await pick(pg, "Campo do filtro", "vinculos.encerrado"); await pick(pg, "Operador", "eq"); await pg.get_by_label("Valor do filtro").select_option("false")
        await pg.get_by_label("Título do relatório").fill("Estudantes por escola e turma")
        await pick(pg, "Logo", (await pg.get_by_label("Logo").locator("option").nth(1).get_attribute("value")))
        await pg.get_by_label("Assinaturas").fill("Secretário(a) escolar\nDiretor(a)")
        await pg.get_by_role("button", name="Executar prévia").click()
        try: await pg.get_by_role("table", name="Resultado da prévia").wait_for(timeout=60000)
        except Exception: pass
        prev = pg.get_by_role("table", name="Resultado da prévia")
        ok = await prev.count() > 0
        txt = await prev.inner_text() if ok else (await pg.inner_text("main"))[-400:]
        print(("PASS" if ok and "Estudantes distintos" in txt else "FAIL") + " prévia de 3 cruzamentos com cálculo renomeado", "" if ok else txt)
        print(("PASS" if "TOTAL GERAL" in txt or "SUBTOTAL" in txt else "FAIL") + " subtotais na prévia")
        await pg.screenshot(path=f"{SH}/1-previa.png")
        # Gráfico no mesmo documento (motor SVG compartilhado)
        await pg.get_by_label("Incluir gráfico").check(); await pick(pg, "Tipo de gráfico", "barras-horizontais"); await pick(pg, "Categoria do gráfico", "c2")
        await pg.get_by_label("Medida Estudantes distintos").check(); await pg.get_by_label("Título do gráfico").fill("Estudantes por turma")
        await pick(pg, "Papel", "A3"); await pick(pg, "Orientação", "paisagem"); await pg.wait_for_timeout(500)
        gp = pg.get_by_label("Prévia do gráfico"); svgn = await gp.locator("svg rect").count() if await gp.count() else 0
        print(("PASS" if svgn > 1 else "FAIL") + f" prévia do gráfico desenhada ({svgn} barras)")
        await gp.screenshot(path=f"{SH}/1b-grafico.png") if await gp.count() else None
        for f in ["SVG", "PNG"]:
            try:
                async with pg.expect_download(timeout=60000) as d: await pg.get_by_role("button", name=f"Gráfico {f}").click()
                dl = await d.value; path = f"/tmp/rep/grafico.{f.lower()}"; await dl.save_as(path); head = open(path, "rb").read(8)
                ok = head.startswith(b"\x89PNG") if f == "PNG" else b"<svg" in open(path, "rb").read(200)
                print(("PASS" if ok else "FAIL") + f" gráfico {f} baixado", os.path.getsize(path), "bytes")
            except Exception as e: print("FAIL gráfico", f, str(e)[:200])
        await pg.get_by_label("Nome do modelo").fill("Aceite RCQ — alunos por turma")
        await pg.get_by_role("button", name="Salvar versão").click(); await pg.wait_for_timeout(2500)
        await pg.reload(); await pg.wait_for_selector("select[aria-label='Fonte principal']", timeout=30000); await pg.wait_for_timeout(2500)
        lst = pg.get_by_role("list", name="Meus modelos")
        has = "Aceite RCQ" in await lst.inner_text()
        print(("PASS" if has else "FAIL") + " modelo salvo aparece após recarregar")
        if has:
            await lst.get_by_role("button", name="Abrir").first.click(); await pg.wait_for_timeout(800)
            src = await pg.get_by_label("Fonte principal").input_value()
            title = await pg.get_by_label("Título do relatório").input_value()
            print(("PASS" if src == "vinculos" and title == "Estudantes por escola e turma" else "FAIL") + f" modelo reaberto restaura fonte e layout ({src} / {title})")
            await pg.get_by_role("button", name="Executar prévia").click(); await pg.wait_for_timeout(5000)
        try:
            async with pg.expect_download(timeout=60000) as d: await pg.get_by_role("button", name="XLSX").click()
            dl = await d.value; path = f"/tmp/rep/{dl.suggested_filename}"; await dl.save_as(path); print("PASS XLSX baixado", os.path.getsize(path), "bytes")
            import zipfile; z = zipfile.ZipFile(path); wbx = z.read("xl/workbook.xml").decode()
            sheets = [x for x in ["Relatório", "Dados do gráfico", "Identificação e verificação"] if x in wbx]; imgs = [n for n in z.namelist() if n.startswith("xl/media/")]
            print(("PASS" if len(sheets) == 3 and imgs else "FAIL") + f" XLSX com abas {sheets} e imagem do gráfico ({len(imgs)})")
        except Exception as e: print("FAIL XLSX", str(e)[:200])
        await pg.wait_for_timeout(1500)
        try:
            async with pg.expect_popup(timeout=60000) as pp: await pg.get_by_role("button", name="PDF (imprimir)").click()
            pop = await pp.value; await pop.wait_for_load_state(); html = await pop.content(); open("/tmp/rep/pdf.html","w").write(html)
            print(("PASS" if "QR de verificação" in html and "Estudantes por escola e turma" in html else "FAIL") + " PDF com QR e título")
            print(("PASS" if "chartimg" in html and "Dados do gráfico" in html and "A3 landscape" in html and "Secretário(a) escolar" in html else "FAIL") + " PDF A3 paisagem com gráfico, tabela e assinaturas")
            await pop.emulate_media(media="print"); await pop.pdf(path="/tmp/rep/custom.pdf", prefer_css_page_size=True); print("INFO PDF salvo /tmp/rep/custom.pdf")
            await pop.close()
        except Exception as e: print("FAIL PDF", str(e)[:200])
        await pg.wait_for_timeout(2000)
        em = pg.get_by_role("list", name="Minhas emissões")
        n = await em.get_by_role("button", name="Reprocessar").count() if await em.count() else 0
        print(("PASS" if n >= 2 else "FAIL") + f" emissões registradas e listadas ({n})")
        if n:
            async with pg.expect_download(timeout=60000) as d: await em.get_by_role("button", name="Reprocessar").nth(n - 1).click()
            await d.value; await pg.wait_for_timeout(1500)
            st = " ".join(await pg.get_by_role("status").all_inner_texts())
            print(("PASS" if "idêntico" in st else "FAIL") + " reprocessar compara com o original:", st[:160])
        await pg.screenshot(path=f"{SH}/2-final.png")
        print(("PASS" if not errs else "FAIL") + " sem erro de execução na tela", errs[:3])
        await br.close()
asyncio.run(main())
