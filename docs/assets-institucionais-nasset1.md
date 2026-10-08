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
