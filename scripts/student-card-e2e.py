"""Carteirinha no navegador (conta sintética A=secretaria). Câmera falsa do Chromium, câmera negada, lote em PDF. Nunca imprime tokens nem nomes."""
import asyncio, json, os
from playwright.async_api import async_playwright
B = "http://localhost:8080"; SH = "/tmp/rep/cards"; os.makedirs(SH, exist_ok=True)
def ok(c, m): print(("PASS " if c else "FAIL ") + m)

async def login(br, cfg, perms, deny=False):
    ctx = await br.new_context(viewport={"width": 1280, "height": 1800}, permissions=perms)
    pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
    await pg.goto(B + "/"); await pg.evaluate("([k,v]) => localStorage.setItem(k, v)", [cfg["key"], json.dumps(cfg["A"])])
    if deny:  # simula recusa da permissão pelo usuário (só nesta página local)
        await pg.evaluate("1")
    await pg.goto(B + "/carteirinhas"); await pg.wait_for_selector("select", timeout=40000)
    await pg.wait_for_function(f"document.querySelector('select option[value=\"{cfg['school']}\"]')", timeout=40000)
    await pg.select_option("select", cfg["school"]); await pg.wait_for_selector("text=Modelo da carteirinha", timeout=40000)
    return ctx, pg, errs

async def pick(pg, cfg):
    await pg.get_by_label("Nome ou identificador").fill(cfg["student"]); await pg.get_by_role("button", name="Buscar", exact=True).click()
    await pg.get_by_role("button", name="Selecionar").first.click(); await pg.wait_for_selector("text=Estudante:")

async def main():
    cfg = json.load(open("/tmp/rep/card.json"))
    async with async_playwright() as p:
        # 1) câmera negada: navegador sem permissão → mensagem e oferta de envio de arquivo
        br0 = await p.chromium.launch(headless=True, args=["--use-fake-ui-for-media-stream=deny", "--deny-permission-prompts"])
        ctx, pg, _ = await login(br0, cfg, [])
        await pg.add_init_script("")
        await pick(pg, cfg)
        await pg.evaluate("() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError')); }")
        await pg.get_by_role("button", name="Usar câmera").click()
        al = pg.locator("[role=alert]", has_text="câmera"); await al.wait_for(timeout=10000); t = await al.inner_text()
        ok("negado" in t and "envie uma foto" in t.lower(), "câmera negada mostra aviso e oferece envio de arquivo")
        ok(await pg.get_by_label("Enviar foto do aparelho").count() == 1, "envio de arquivo continua disponível")
        await pg.screenshot(path=f"{SH}/1-negada.png"); await ctx.close(); await br0.close()

        # 2) câmera concedida (dispositivo falso do Chromium, sem rosto real)
        br = await p.chromium.launch(headless=True, args=["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"])
        ctx, pg, errs = await login(br, cfg, ["camera"])
        # modelo: salvar nova versão
        await pg.get_by_role("button", name="Editar modelo").click()
        await pg.get_by_label("Título da frente").fill("Carteira Estudantil")
        await pg.get_by_label("Turno").check()
        await pg.get_by_role("button", name="Salvar nova versão do modelo").click()
        await pg.wait_for_selector("text=Modelo da carteirinha salvo", timeout=20000); ok(True, "modelo frente/verso salvo como versão")
        await pick(pg, cfg)
        await pg.get_by_role("button", name="Usar câmera").click()
        await pg.wait_for_function("(() => { const v = document.querySelector('video'); return v && v.videoWidth > 0; })()", timeout=20000)
        await pg.get_by_role("button", name="Tirar foto").click()
        await pg.get_by_label("Aproximar").fill("1.5")
        await pg.get_by_role("button", name="Salvar foto").click()
        await pg.wait_for_selector("text=Foto registrada", timeout=30000); ok(True, "foto da câmera enquadrada 3x4 e registrada")
        await pg.wait_for_selector("text=Foto 3×4 registrada", timeout=15000)
        await pg.get_by_label("Válida até").fill("31/12/2026") if await pg.get_by_label("Válida até").get_attribute("type") != "date" else await pg.get_by_label("Válida até").fill("2026-12-31")
        await pg.get_by_role("button", name="Emitir", exact=True).click()
        await pg.wait_for_selector("text=Carteirinha emitida", timeout=30000); ok(True, "emissão registrada pela tela")
        item = pg.locator("li", has_text=cfg["name"]).filter(has=pg.get_by_role("button", name="Abrir")).first
        await item.get_by_role("button", name="Abrir").click()
        await pg.wait_for_function("(() => [...document.querySelectorAll('img[alt=\"Foto do estudante\"]')].some(i => i.complete && i.naturalWidth > 0))()", timeout=20000)
        ok(True, "foto aparece na carteirinha (URL assinada)")
        front = await pg.locator("[data-card-face='frente']").first.inner_text()
        ok("Carteira Estudantil" in front and "turno" in front.lower(), "frente usa o modelo salvo (título e campo turno)")
        await pg.get_by_label("Motivo").fill("teste técnico de reemissão")
        await pg.get_by_role("button", name="Reemitir").click()
        await pg.wait_for_selector("text=Carteirinha reemitida", timeout=30000); ok(True, "reemissão com motivo")
        await pg.screenshot(path=f"{SH}/2-emitida.png")
        code = (await pg.locator("li", has_text=cfg["name"]).first.inner_text()).split("código ")[1].split()[0]
        # 3) lote frente/verso em PDF A4
        await pg.get_by_label(f"Selecionar {cfg['name']} para impressão").check()
        await pg.evaluate("() => { window.print = () => {}; }")
        await pg.get_by_role("button", name="Imprimir selecionadas (1)").click()
        await pg.wait_for_selector(".card-batch [data-sheet='versos']", timeout=15000)
        ok(await pg.locator(".card-batch [data-card-face='frente']").count() == 1 and await pg.locator(".card-batch [data-card-face='verso']").count() == 1, "lote tem folha de frentes e de versos")
        await pg.wait_for_function("(() => [...document.querySelectorAll('.card-batch img[alt=\"Foto do estudante\"]')].every(i => i.complete && i.naturalWidth > 0))()", timeout=20000)
        ok(True, "foto carregada no lote antes do PDF")
        await pg.emulate_media(media="print")
        await pg.pdf(path=f"{SH}/lote.pdf", format="A4", print_background=True)
        ok(os.path.getsize(f"{SH}/lote.pdf") > 5000, "PDF A4 do lote gerado")
        await pg.emulate_media(media="screen")
        ok(not errs, "sem erros de página na Secretaria " + ";".join(errs[:2]))
        # 4) arquivo digital responsivo (celular)
        await pg.set_viewport_size({"width": 375, "height": 800})
        if await pg.get_by_role("button", name="Voltar").count(): await pg.get_by_role("button", name="Voltar").click()
        await pg.wait_for_selector("text=Carteirinhas emitidas")
        await pg.wait_for_timeout(800)
        sw = await pg.evaluate("document.documentElement.scrollWidth"); ok(sw <= 380, f"cabe no celular sem rolagem lateral ({sw}px)")
        await ctx.close()
        # 5) verificação pública sem login
        ctx = await br.new_context(viewport={"width": 1280, "height": 1800}); pg = await ctx.new_page()
        pid, ver = code.split(".")
        await pg.goto(f"{B}/verificar/carteirinha/{pid}.{ver}"); await pg.wait_for_selector("[role=status]", timeout=20000)
        t = await pg.inner_text("main")
        ok("Carteirinha válida" in t, "QR/código atual verifica como válida")
        ok(cfg["name"] not in t and "Foto" not in t.split("Por proteção")[0], "página pública não mostra nome nem foto")
        await pg.goto(f"{B}/verificar/carteirinha/{pid}.1"); await pg.wait_for_selector("[role=status]", timeout=20000)
        ok("substituída" in await pg.inner_text("main"), "versão anterior aparece como substituída")
        await pg.screenshot(path=f"{SH}/3-publica.png"); await ctx.close(); await br.close()

asyncio.run(main())
