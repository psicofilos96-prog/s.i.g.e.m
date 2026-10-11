"""PAINÉIS no navegador: monta barras (matrículas por escola), confere com o servidor, drill-down, mapa de calor, KPI,
salvar/reabrir, exporta PNG/SVG/XLSX e imprime PDF. Conta da escola A vê 1 barra; conta de rede vê todas."""
import asyncio, json, os, subprocess, zipfile
from playwright.async_api import async_playwright
B = "http://localhost:8080"; OUT = "/tmp/fdash"; SH = f"{OUT}/shots"; os.makedirs(SH, exist_ok=True)
cfg = json.load(open(f"{OUT}/s.json"))
def p(ok, l, x=""): print(f"{'PASS' if ok else 'FAIL'} {l} {x}".rstrip())

async def open_as(br, tag):
    ctx = await br.new_context(viewport={"width": 1280, "height": 1800}, accept_downloads=True); pg = await ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: (errs.append(str(e)[:160]), print("PGERR", str(e)[:400]))); pg.on("console", lambda c: c.type == "error" and print("CONERR", c.text[:400]))
    await pg.goto(B + "/", wait_until="networkidle"); await pg.wait_for_timeout(1500); await pg.evaluate("([k,v]) => localStorage.setItem(k, v)", [cfg["key"], json.dumps(cfg["sessions"][tag])])
    await pg.goto(B + "/relatorios/paineis"); await pg.wait_for_timeout(9000); await pg.screenshot(path=f"{SH}/0_{tag}.png"); print("PAGE", (await pg.inner_text("main"))[:300].replace("\n"," "))
    await pg.get_by_role("button", name="Adicionar gráfico").wait_for(timeout=30000)
    return ctx, pg, errs

async def add(pg, title, source, join, kind, groups, measure=None, calcs=1):
    await pg.get_by_role("button", name="Adicionar gráfico").click()
    ed = pg.locator("section[aria-labelledby=ed-w]")
    await ed.get_by_label("Título do gráfico").fill(title)
    await ed.get_by_label("Fonte principal").select_option(label=source)
    if join: await ed.get_by_label("Cruzar com").select_option(label=join)
    await ed.get_by_label("Tipo de gráfico").select_option(value=kind)
    for g in groups: await ed.get_by_label("Acrescentar agrupamento").select_option(label=g)
    for _ in range(calcs): await ed.get_by_role("button", name="Acrescentar cálculo").click()
    await ed.get_by_role("button", name="Pôr no painel").click()
    card = pg.get_by_role("article", name=title); await card.wait_for(timeout=15000)
    try: await card.get_by_text("linha(s)").wait_for(timeout=40000)
    except Exception: pass
    return card

async def main():
    async with async_playwright() as pw:
        br = await pw.chromium.launch(headless=True)
        # escola A: 1 barra, valor = servidor
        ctx, pg, errs = await open_as(br, "a")
        card = await add(pg, "Matrículas por escola", "Matrículas", "Escolas (por school_id)", "bar", ["Escola (Escolas)"])
        bars = await card.locator(".recharts-bar-rectangle").count()
        txt = await card.inner_text()
        p(bars == 1 and "1 linha(s)" in txt, "escola A: uma barra (só a própria escola)", f"{bars} | {txt[-60:]}")
        await pg.screenshot(path=f"{SH}/1_escola_a.png"); p(not errs, "escola A sem erros de página", str(errs)); await ctx.close()
        # rede
        ctx, pg, errs = await open_as(br, "net")
        card = await add(pg, "Matrículas por escola", "Matrículas", "Escolas (por school_id)", "bar", ["Escola (Escolas)"])
        bars = await card.locator(".recharts-bar-rectangle").count()
        p(bars == cfg["netRows"], "rede: uma barra por escola, igual ao servidor", f"{bars}/{cfg['netRows']}")
        # drill-down: clique na primeira barra
        await card.locator(".recharts-bar-rectangle").first.click(); await pg.wait_for_timeout(800)
        chip = pg.get_by_role("list", name="Filtros ativos")
        try: await card.get_by_text("1 filtro(s) do painel").wait_for(timeout=30000)
        except Exception: pass
        p(await chip.count() == 1 and await card.locator(".recharts-bar-rectangle").count() == 1, "drill-down: clique vira filtro e o gráfico detalha 1 escola")
        await pg.get_by_role("button", name="Limpar filtros").click()
        # mapa de calor turmas: escola × etapa
        hm = await add(pg, "Turmas por escola e etapa", "Turmas", "Escolas (por school_id)", "heatmap", ["Etapa (Turmas)", "Escola (Escolas)"])
        p(await hm.locator("svg[data-chart=heatmap] rect").count() > 0, "mapa de calor desenhado com turmas reais")
        # incompatibilidade explicada
        await pg.get_by_role("button", name="Adicionar gráfico").click(); ed = pg.locator("section[aria-labelledby=ed-w]")
        await ed.get_by_label("Fonte principal").select_option(label="Matrículas"); await ed.get_by_label("Tipo de gráfico").select_option(value="pie")
        st = await ed.get_by_role("status").inner_text(); p("agrupamento" in st, "tipo incompatível explica o que falta", st[:120])
        p(await ed.get_by_role("button", name="Pôr no painel").is_disabled(), "botão bloqueado até a consulta servir ao gráfico")
        await ed.get_by_role("button", name="Cancelar").click()
        # exportações
        await card.get_by_text("linha(s)").wait_for(timeout=60000)
        async with pg.expect_download() as d: await card.get_by_role("button", name="SVG").click()
        f = await (await d.value).path(); s = open(f).read(); p(s.startswith("<svg") and "var(--" not in s, "SVG exportado com cores resolvidas")
        async with pg.expect_download() as d: await card.get_by_role("button", name="PNG").click()
        f = await (await d.value).path(); p(open(f, "rb").read(4) == b"\x89PNG", "PNG exportado")
        await pg.get_by_label("Nome do painel").fill("Painel teste técnico")
        async with pg.expect_download() as d: await pg.get_by_role("button", name="Exportar XLSX").click()
        f = await (await d.value).path(); z = zipfile.ZipFile(f); sheets = [n for n in z.namelist() if n.startswith("xl/worksheets/sheet")]
        p(len(sheets) == 2, "XLSX com uma aba por gráfico", str(len(sheets)))
        await pg.emulate_media(media="print"); await pg.pdf(path=f"{OUT}/painel.pdf", format="A4", landscape=True, print_background=True); await pg.emulate_media(media="screen")
        info = subprocess.run(["pdfinfo", f"{OUT}/painel.pdf"], capture_output=True, text=True).stdout
        p("A4" in info or "842" in info, "PDF A4 paisagem do painel", [l for l in info.splitlines() if "size" in l or l.startswith("Pages")].__str__())
        subprocess.run(["pdftoppm", "-png", "-r", "50", "-f", "1", "-l", "1", f"{OUT}/painel.pdf", f"{SH}/pdf"])
        # salvar e reabrir
        await pg.get_by_role("button", name="Salvar painel").click()
        await pg.get_by_role("status").filter(has_text="Painel salvo").wait_for(timeout=15000); p(True, "painel salvo")
        await pg.screenshot(path=f"{SH}/2_rede.png")
        await pg.reload(); await pg.get_by_role("button", name="Adicionar gráfico").wait_for(timeout=30000)
        sel = pg.get_by_label("Abrir painel salvo")
        await pg.wait_for_function("() => [...document.querySelectorAll('select[aria-label=\"Abrir painel salvo\"] option')].some(o => o.textContent.includes('Painel teste técnico'))", timeout=20000)
        await sel.select_option(label="Painel teste técnico (v1)")
        try: await pg.get_by_role("article", name="Turmas por escola e etapa").get_by_text("linha(s)").wait_for(timeout=40000)
        except Exception: pass
        p(await pg.get_by_role("article").count() == 2, "painel reaberto com os 2 gráficos relidos do servidor")
        p(not errs, "rede sem erros de página", str(errs)[:200]); await ctx.close()
        # cada família com dados reais
        ctx, pg, errs = await open_as(br, "net")
        fam1 = {"barh": ".recharts-bar-rectangle", "line": ".recharts-line-curve", "area": ".recharts-area-area", "pie": ".recharts-sector", "donut": ".recharts-sector",
                "treemap": ".recharts-treemap-depth-1, .recharts-rectangle", "funnel": ".recharts-funnel-trapezoid", "radar": ".recharts-radar-polygon", "waterfall": ".recharts-bar-rectangle"}
        for k, sel in fam1.items():
            c = await add(pg, f"F {k}", "Matrículas", "Escolas (por school_id)", k, ["Escola (Escolas)"])
            await pg.wait_for_timeout(2000); n = await c.locator(sel).count(); p(n > 0, f"família {k} desenhada com dados reais", str(n))
            if n == 0: await c.screenshot(path=f"{SH}/f_{k}.png")
            await c.get_by_role("button", name="Remover").dispatch_event("click")
        for k, sel in {"stacked": ".recharts-bar-rectangle", "stacked100": ".recharts-bar-rectangle", "pivot": "table[data-chart=pivot] tbody tr"}.items():
            c = await add(pg, f"F {k}", "Turmas", "Escolas (por school_id)", k, ["Escola (Escolas)", "Etapa (Turmas)"])
            n = await c.locator(sel).count(); p(n > 0, f"família {k} desenhada com dados reais", str(n))
            if k == "pivot": await pg.screenshot(path=f"{SH}/3_pivot.png")
            await c.get_by_role("button", name="Remover").dispatch_event("click")
        c = await add(pg, "F combo", "Matrículas", "Escolas (por school_id)", "combo", ["Escola (Escolas)"], calcs=2)
        p(await c.locator(".recharts-bar-rectangle").count() > 0 and await c.locator(".recharts-line-curve").count() > 0, "família misto (barras + linha)")
        p(await c.get_by_text("Ver dados do gráfico em tabela").count() == 1, "alternativa acessível: dados em tabela")
        await pg.get_by_role("button", name="Adicionar gráfico").click(); ed = pg.locator("section[aria-labelledby=ed-w]")
        await ed.get_by_label("Fonte principal").select_option(label="Escolas"); await ed.get_by_label("Tipo de gráfico").select_option(value="map"); await pg.wait_for_timeout(500)
        st = await ed.get_by_role("status").inner_text(); p("latitude" in st, "mapa recusado sem coordenadas reais", st[:110])
        await ed.get_by_role("button", name="Cancelar").click()
        await pg.set_viewport_size({"width": 390, "height": 1800}); await pg.wait_for_timeout(800)
        ov = await pg.evaluate("document.documentElement.scrollWidth - innerWidth")
        await pg.screenshot(path=f"{SH}/4_mobile.png"); p(ov <= 4, "celular sem rolagem lateral da página", str(ov))
        p(not errs, "famílias sem erros de página", str(errs)[:200]); await ctx.close()
        # designer: modelo do setor, arrastar, redimensionar, tema, duplicar, drill-through, salvar/reabrir
        ctx, pg, errs = await open_as(br, "net")
        await pg.get_by_label("Modelo do setor").select_option(label="Secretaria — Matrículas e turmas da escola")
        await pg.get_by_role("article", name="Turmas por escola").get_by_text("linha(s)").wait_for(timeout=60000)
        arts = await pg.get_by_role("article").evaluate_all("els => els.map(e => e.getAttribute('aria-label'))")
        p(arts == ["Matrículas por escola", "Turmas por escola", "Total de matrículas"], "modelo do setor abre 3 gráficos sobre o catálogo", str(arts))
        await pg.get_by_role("article", name="Total de matrículas").get_by_text("linha(s)").wait_for(timeout=60000)
        kpi = await pg.get_by_role("article", name="Total de matrículas").inner_text(); p("9.811" in kpi, "indicador do modelo = 9.811 matrículas reais", kpi[-40:])
        await pg.get_by_role("article", name="Total de matrículas").locator("h3").drag_to(pg.get_by_role("article", name="Matrículas por escola").locator("h3"))
        await pg.wait_for_timeout(500)
        arts = await pg.get_by_role("article").evaluate_all("els => els.map(e => e.getAttribute('aria-label'))")
        p(arts[0] == "Total de matrículas", "arrastar e soltar reordena", str(arts))
        t = pg.get_by_role("article", name="Turmas por escola")
        await t.get_by_label("Largura do gráfico").select_option(value="3"); await t.get_by_label("Altura do gráfico").select_option(value="l")
        p(await t.get_attribute("data-span") == "3" and await t.get_attribute("data-height") == "l", "redimensionar largura e altura")
        await pg.get_by_label("Fonte do painel").select_option(value="serif"); await pg.get_by_label("Paleta de cores").select_option(value="2")
        await pg.get_by_label("Descrição do painel").fill("Painel de teste técnico")
        p(await pg.locator("header[aria-label='Cabeçalho do painel'] img").count() == 1, "logo institucional no cabeçalho")
        # drill-through
        await t.get_by_role("button", name="Editar").click(); ed = pg.locator("section[aria-labelledby=ed-w]")
        await ed.get_by_label("Clique abre as linhas (detalhamento)").check(); await ed.get_by_label("Descrição do gráfico").fill("Clique abre as turmas")
        await ed.get_by_role("button", name="Pôr no painel").click()
        t = pg.get_by_role("article", name="Turmas por escola"); await t.get_by_text("linha(s)").wait_for(timeout=60000)
        await t.locator(".recharts-bar-rectangle").first.click()
        await t.locator("table[data-drill-through] tbody tr").first.wait_for(timeout=60000)
        n = await t.locator("table[data-drill-through] tbody tr").count(); p(n > 0, "drill-through abre as linhas reais da categoria", str(n))
        await pg.get_by_label("Nome do painel").fill("Designer técnico")
        await pg.get_by_role("button", name="Salvar painel").click(); await pg.get_by_role("status").filter(has_text="Painel salvo").wait_for(timeout=15000)
        await pg.get_by_role("button", name="Duplicar").click(); p(await pg.get_by_label("Nome do painel").input_value() == "Designer técnico (cópia)", "duplicar gera cópia nomeada")
        await pg.get_by_role("button", name="Salvar painel").click(); await pg.get_by_role("status").filter(has_text="Painel salvo").wait_for(timeout=15000)
        await pg.reload(); await pg.get_by_role("button", name="Adicionar gráfico").wait_for(timeout=30000)
        await pg.wait_for_function("() => [...document.querySelectorAll('select[aria-label=\"Abrir painel salvo\"] option')].some(o => o.textContent.includes('Designer técnico (cópia)'))", timeout=20000)
        await pg.get_by_label("Abrir painel salvo").select_option(label="Designer técnico (v1)")
        t = pg.get_by_role("article", name="Turmas por escola"); await t.wait_for(timeout=20000)
        p(await t.get_attribute("data-span") == "3" and await pg.get_by_label("Fonte do painel").input_value() == "serif" and "Clique abre as turmas" in await t.inner_text(), "reaberto preserva tamanho, tema e descrição")
        await pg.screenshot(path=f"{SH}/5_designer.png")
        p(not errs, "designer sem erros de página", str(errs)[:200]); await ctx.close()
        await br.close()
asyncio.run(main())
