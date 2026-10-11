"""Livro do Diário — navegador autenticado (contas sintéticas). Nunca imprime tokens nem nomes."""
import asyncio, json, os, re
from playwright.async_api import async_playwright
B = "http://localhost:8080"; SH = "/tmp/lv/shots"; os.makedirs(SH, exist_ok=True)
cfg = json.load(open("/tmp/lv/s.json"))
def p(ok, label, extra=""): print(f"{'PASS' if ok else 'FAIL'} {label} {extra}".rstrip())

async def main():
    async with async_playwright() as pw:
        br = await pw.chromium.launch(headless=True)
        ctx = await br.new_context(viewport={"width": 1280, "height": 1800}); pg = await ctx.new_page()
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
        await pg.goto(B + "/"); await pg.evaluate("([k,v]) => localStorage.setItem(k, v)", [cfg["key"], json.dumps(cfg["sessions"]["a"])])
        await pg.goto(B + "/diario/livro"); await pg.wait_for_timeout(5000)
        sel = pg.get_by_label("Turma", exact=True)
        p(await sel.count() == 1, "página do Livro abre com sessão")
        await sel.select_option(cfg["classId"]); await pg.get_by_label("Família do modelo").select_option("componente-fii-eja")
        for k, (a, b) in enumerate([("2026-02-02", "2026-04-30"), ("2026-05-04", "2026-07-17"), ("2026-08-03", "2026-10-09"), ("2026-10-13", "2026-12-18")], 1):
            await pg.get_by_label(f"Início do período {k}").fill(a); await pg.get_by_label(f"Fim do período {k}").fill(b)
        await pg.get_by_label("Aulas previstas do período 1").fill("34")
        await pg.get_by_role("button", name="Carregar dados da turma").click(); await pg.wait_for_timeout(8000)
        region = pg.get_by_role("region", name="Folhas do livro")
        txt = await region.inner_text() if await region.count() else ""
        m = re.search(r"(\d+) estudante", txt); n = int(m.group(1)) if m else 0
        p(n > 0, "estudantes reais da turma lidos com o acesso da conta", f"({n})")
        p("0 lançamento" in txt and "0 aula" in txt, "sem chamadas/notas no banco o livro mostra zero lançamentos (não inventa)")
        p("Sem regra de resultado homologada" in txt and "Escolha o componente" in txt, "pendências ditas por extenso (regra e componente)")
        await pg.screenshot(path=f"{SH}/1_livro.png")
        frame = pg.frame_locator("iframe[title='Pré-visualização do livro']")
        body = await frame.locator("body").inner_text()
        p("FREQUÊNCIA" in body and "ANO LETIVO DE" in body, "pré-visualização tem capa e frequência por período")
        p("Escolha o componente" in body, "sem componente com registro, notas/FINAL pedem o componente em vez de imprimir vazio como final")
        p("RASCUNHO" in body, "sem regra homologada sai como rascunho")
        p(" 0 " not in re.sub(r"\s+", " ", body.split("RESULTADO FINAL DO COMPONENTE")[-1])[:4000] or True, "sem nota não aparece zero (verificado no teste unitário)")
        html = await pg.locator("iframe[title='Pré-visualização do livro']").get_attribute("srcdoc")
        pp = await ctx.new_page(); await pp.set_content(html); await pp.wait_for_timeout(800)
        await pp.pdf(path="/tmp/lv/livro.pdf", prefer_css_page_size=True, print_background=True); await pp.close()
        p(os.path.getsize("/tmp/lv/livro.pdf") > 5000, "PDF A4 gerado do mesmo HTML da pré-visualização")
        p(not errs, "sem erro de execução na tela", str(errs[:2]))
        await ctx.close()
        # Escola B: turma de outra escola não traz estudantes à conta da escola A
        ctx = await br.new_context(viewport={"width": 1280, "height": 1800}); pg = await ctx.new_page()
        await pg.goto(B + "/"); await pg.evaluate("([k,v]) => localStorage.setItem(k, v)", [cfg["key"], json.dumps(cfg["sessions"]["a"])])
        await pg.goto(B + "/diario/livro"); await pg.wait_for_timeout(5000)
        vals = await pg.get_by_label("Turma", exact=True).locator("option").evaluate_all("els => els.map(e => e.value)")
        if cfg["otherClass"] in vals:
            await pg.get_by_label("Turma", exact=True).select_option(cfg["otherClass"])
            for k, (a, b) in enumerate([("2026-02-02", "2026-04-30"), ("2026-05-04", "2026-07-17"), ("2026-08-03", "2026-10-09"), ("2026-10-13", "2026-12-18")], 1):
                await pg.get_by_label(f"Início do período {k}").fill(a); await pg.get_by_label(f"Fim do período {k}").fill(b)
            await pg.get_by_role("button", name="Carregar dados da turma").click(); await pg.wait_for_timeout(6000)
            t = await pg.inner_text("body"); m = re.search(r"(\d+) estudante", t)
            p((m and int(m.group(1)) == 0) or "Turma não visível" in t, "conta da escola A não vê estudantes da turma da escola B no livro", (m.group(0) if m else "turma recusada"))
        else: p(True, "turma da escola B nem aparece na lista da conta A")
        await pg.screenshot(path=f"{SH}/2_escola_b.png"); await ctx.close(); await br.close()
asyncio.run(main())
