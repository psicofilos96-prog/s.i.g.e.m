# NHELP.1 — ajuda contextual curta

## Situação atual (2026-10-08)
- Classe: **Registro de lote**. Regras em `src/features/help/AGENTS.md`.

## O que existe
- Bloco recolhível **"O que isso significa?"** abaixo da orientação da tela, renderizado uma vez pelo AppShell a partir de `SCREEN_MEANINGS` (`help-content.ts`): Mapa, Avaliação (inclui regras e avaliação no Diário), Calendário, Matrícula/Enturmação, Turmas, Diário, AEE/Inclusão (`/inclusao`) e Relatórios.
- Cada bloco tem só duas frases: o que se faz na tela e de onde vêm os dados. Termos ganham dica (popover do glossário, botão "O que é …?", alvo ≥ 36 px).
- Teste proíbe dígitos no texto (sem prazo, patamar ou contagem inventados).
- Corrigido o glossário "Vínculo funcional", que ainda dizia DP externo (decisão N12.1).

## Testes
`src/features/help/screen-meanings.test.tsx`: cobertura das oito telas, prefixo mais específico, rotas/termos existentes, ausência de números, axe sem violações.

## Pendências
- INTERACTIVE_BROWSER_VALIDATION_PENDING: conferir leitura com leitor de tela real e no celular.
- REVISAR: textos de Avaliação e AEE são genéricos de propósito; ajustar quando houver regra homologada ou decisão do responsável.
