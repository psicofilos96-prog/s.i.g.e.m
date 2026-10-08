# NASSET.1 — Assets institucionais

## Situação atual
Classe: Registro de lote (2026-10-08).

Inventário (`src/assets`, ponteiros CDN; `public/` só ícones do PWA/favicon):
brasao-itaperuna (instituição, carteirinha, auth, identidade), logo-sigem (shell, login, auth, calendários, carteirinha), logo-educacao e logo-prefeitura (login; educação também como semente da identidade), itaperuna-home (Início, login, auth, Secretaria, calendários, carteirinha).

- Nenhum arquivo sem uso, nenhuma duplicata por conteúdo, nenhuma imagem externa carregada pelo código.
- Corrigido: descrição da foto no login dizia "Cristo Redentor"; agora "Cristo de Itaperuna", igual ao Início.
- Originais preservados; nenhum asset apagado.
- Guardado por `src/test/invariants/nasset1-assets.test.ts`.
- DEPENDE_DADO: confirmar que `itaperuna-home` é fotografia real do Cristo de Itaperuna (origem/autoria não registradas); se não for, enviar a foto oficial para substituir.
- INTERACTIVE_BROWSER_VALIDATION_PENDING: impressão da carteirinha e dos calendários com login real.

## NASSET.2 (2026-10-08) — revalidação após novos calendários e telas
- Inventário igual: 5 ponteiros CDN em `src/assets` + favicon/ícones do PWA em `public/`; todos usados, todos respondem 200 com `image/png`; nenhuma duplicata, nenhuma referência quebrada, nenhuma imagem externa. Nada apagado.
- Novos consumidores conferidos: folhas externas do calendário (capa padrão e rodapé SIGEM), Secretaria, carteirinha, entrada.
- Cristo de Itaperuna: a imagem `itaperuna-home` mostra a estátua branca sobre a cidade ao pôr do sol; textos dizem "Cristo de Itaperuna" em todo lugar. DEPENDE_DADO mantido: origem/autoria da foto não registradas; se não for a fotografia oficial, enviar a foto para substituir.
- Corrigido (fallback): a foto de fundo de Itaperuna some sem ícone quebrado quando não carrega — na tela e na impressão — no Início, login, entrada, Secretaria, carteirinha e capa do calendário externo (`src/lib/img-fallback.ts`, cobre falha antes e depois de a tela carregar). Logos sem carga mostram o nome por extenso (texto alternativo).
- Testado em navegador: login com imagens carregadas, impressão em PDF gerada, e com o servidor de imagens bloqueado (foto escondida, nomes dos logos visíveis).
- Guardado por `src/test/invariants/nasset1-assets.test.ts`.
- INTERACTIVE_BROWSER_VALIDATION_PENDING: impressão da carteirinha e dos calendários com login real.
