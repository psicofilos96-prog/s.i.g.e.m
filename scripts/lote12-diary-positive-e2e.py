"""LOTE 12 — navegador autenticado com contas sintéticas: regra (autor ≠ revisor), Folha Final (rascunho → conferência; homologação recusada com pendências), Boletim/Ficha em PDF real. Nunca imprime tokens."""
import asyncio, json, os
from playwright.async_api import async_playwright
B = "http://localhost:8080"; SH = "/tmp/fs12/shots"; os.makedirs(SH, exist_ok=True)
cfg = json.load(open("/tmp/fs12/s.json")); LOGICAL = cfg["op"] + "-fund2"
def p(ok, label, extra=""): print(f"{'PASS' if ok else 'FAIL'} {label} {extra}".rstrip())

async def as_user(br, tag):
    ctx = await br.new_context(viewport={"width": 1280, "height": 1800}); pg = await ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
    await pg.goto(B + "/"); await pg.evaluate("([k,v]) => localStorage.setItem(k, v)", [cfg["key"], json.dumps(cfg["sessions"][tag])])
    return ctx, pg, errs

async def status(pg):
    await pg.wait_for_timeout(2500); return " | ".join(await pg.get_by_role("status").all_inner_texts())

async def main():
    async with async_playwright() as pw:
        br = await pw.chromium.launch(headless=True)
        # 1) autor escreve rascunho
        ctx, pg, e1 = await as_user(br, "regra-autor")
        await pg.goto(B + "/diario/regras-folha-final"); await pg.wait_for_timeout(4000)
        await pg.get_by_label("Identificador (opcional; repita para criar nova versão)").fill(LOGICAL)
        await pg.get_by_label("Nome da regra").fill("E2E sintético Fund II"); await pg.get_by_label("Vigente a partir de").fill("2026-01-01")
        await pg.get_by_label("Nota mínima de aprovação (0–100)").fill("50"); await pg.get_by_label("Frequência mínima % (vazio = não exigida)").fill("75")
        await pg.get_by_label("Fonte da regra (documento, deliberação ou decisão)").fill("teste técnico sintético — não normativo")
        await pg.get_by_role("button", name="Registrar rascunho").click(); st = await status(pg)
        p("Rascunho registrado" in st, "autor registra rascunho da regra", st)
        row = pg.locator("tr", has_text="E2E sintético Fund II")
        btn = row.get_by_role("button", name="Revisar e homologar")
        p(await btn.count() == 1 and await btn.is_disabled(), "autor não pode homologar a própria regra")
        await pg.screenshot(path=f"{SH}/1_regra_autor.png"); await ctx.close()
        # 2) revisor homologa
        ctx, pg, e2 = await as_user(br, "regra-revisor")
        await pg.goto(B + "/diario/regras-folha-final"); await pg.wait_for_timeout(4000)
        btn = pg.locator("tr", has_text="E2E sintético Fund II").get_by_role("button", name="Revisar e homologar")
        await btn.click(); st = await status(pg); p("Regra homologada" in st, "segundo ator homologa", st)
        await pg.screenshot(path=f"{SH}/2_regra_revisor.png"); await ctx.close()
        # 3) secretaria A1: Folha Final
        ctx, pg, e3 = await as_user(br, "secretaria-a1")
        await pg.goto(B + "/diario/folha-final"); await pg.wait_for_timeout(5000)
        sel = pg.get_by_label("Turma"); opts = await sel.locator("option").all_inner_texts(); print("INFO turmas visíveis:", len(opts) - 1)
        chosen = None
        for i in range(1, min(len(opts), 25)):
            await sel.select_option(index=i); await pg.get_by_label("Modalidade da folha (declarada por você)").select_option("fundamental-anos-finais"); await pg.wait_for_timeout(3500)
            if await pg.get_by_role("button", name="Salvar rascunho").count() and not await pg.get_by_role("button", name="Salvar rascunho").is_disabled(): chosen = i; break
        p(chosen is not None, "turma real com estudantes encontrada na escola da conta")
        if chosen:
            t = await pg.inner_text("main") if await pg.locator("main").count() else await pg.inner_text("body")
            p("E2E sintético Fund II" in t, "Folha Final usa a regra homologada pelos atores de teste")
            p("Frequência: lida das chamadas gravadas" in t, "frequência lida das chamadas reais")
            p("APROVADO" not in t and "REPROVADO" not in t, "sem nota gravada, ninguém é aprovado/reprovado (ausência ≠ zero)")
            await pg.get_by_role("button", name="Salvar rascunho").click(); st = await status(pg); p("registrad" in st.lower(), "rascunho da Folha gravado", st)
            await pg.get_by_role("button", name="Registrar conferência").click(); st = await status(pg); p("registrad" in st.lower(), "conferência gravada", st)
            p(await pg.get_by_role("button", name="Homologar").is_disabled(), "homologação indisponível enquanto houver pendência")
            await pg.screenshot(path=f"{SH}/3_folha.png")
            for name, f in [("Boletins A4 (PDF)", "boletim"), ("Fichas individuais A4 (PDF)", "ficha"), ("Folha Final A4 (PDF)", "folha")]:
                b = pg.get_by_role("button", name=name)
                if await b.is_disabled(): p(False, name, "desabilitado"); continue
                async with pg.expect_popup(timeout=15000) as pp: await b.click()
                pop = await pp.value; await pop.wait_for_load_state(); h = await pop.content()
                await pop.pdf(path=f"/tmp/fs12/{f}.pdf", format="A4", print_background=True)
                p(os.path.getsize(f"/tmp/fs12/{f}.pdf") > 2000, f"{name} gerado como PDF real", f"{os.path.getsize(f'/tmp/fs12/{f}.pdf')} bytes")
                if f != "folha": p("impressão digital" in h, f"{name} cita a mesma fonte (impressão digital)")
                await pop.close()
            await pg.get_by_label("Modalidade da folha (declarada por você)").select_option("educacao-infantil"); await pg.wait_for_timeout(800)
            p(await pg.get_by_role("link", name="Abrir o parecer descritivo desta turma").count() == 1, "EI encaminha ao parecer descritivo")
            await pg.get_by_label("Modalidade da folha (declarada por você)").select_option("eja"); await pg.wait_for_timeout(800)
            t = await pg.inner_text("body"); p("E2E sintético Fund II" not in t.split("Regra aplicada")[-1][:80] if "Regra aplicada" in t else True, "regra de Fund II não se aplica à EJA")
        await ctx.close()
        # 4) secretaria A2 vê a cadeia; homologação continua travada pela pendência
        ctx, pg, e4 = await as_user(br, "secretaria-a2")
        await pg.goto(B + "/diario/folha-final"); await pg.wait_for_timeout(5000)
        if chosen:
            await pg.get_by_label("Turma").select_option(index=chosen); await pg.get_by_label("Modalidade da folha (declarada por você)").select_option("fundamental-anos-finais"); await pg.wait_for_timeout(4000)
            t = await pg.inner_text("body"); p("Conferida" in t and "Rascunho" in t, "segunda secretaria lê a cadeia de atos")
            await pg.screenshot(path=f"{SH}/4_folha_a2.png")
        await ctx.close()
        errs = e1 + e2 + e3 + e4; p(not errs, "sem erro de execução no navegador", str(errs[:2]))
        await br.close()
asyncio.run(main())
