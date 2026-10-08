# NMOBILE.1 — Responsividade (2026-10-08)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Registro de lote**. Instantâneo do lote na data em que foi escrito.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.

Viewports: 390×844 (celular), 820×1180 (tablet), 1280 com zoom 200% (= 640 px CSS, DPR 2).
Rotas sem login (laboratório): /diario, /diario/chamadas, /diario/aulas, /secretaria, /secretaria/vagas,
/familia, /autorizacoes-familia, /central-de-acessos, /pendencias. (/busca e /notificacoes não são rotas próprias.)

## Resultado
- Rolagem horizontal: 0 em 27 combinações (largura da página = viewport).
- Alvo pequeno corrigido: botão do calendário do campo de data (16×16 → 36×36, `date-input.tsx`).
  Restam só o link "Pular para o conteúdo" (invisível até o foco, correto) e um item a revisar com login.
- Diálogos (`dialog.tsx`, `alert-dialog.tsx`): agora altura máxima da tela visível (100dvh), rolagem interna e
  margem lateral, para teclado aberto ou zoom 200% não esconderem os botões.
- Nenhuma regra de negócio alterada.

## Testes / evidências
`src/components/mobile-nmobile1.test.ts`; screenshots em Files, pasta `nmobile1-screenshots` (36).

## Pendências
- INTERACTIVE_BROWSER_VALIDATION_PENDING: telas com login real (tabelas com dados reais) e teclado virtual em celular físico.
