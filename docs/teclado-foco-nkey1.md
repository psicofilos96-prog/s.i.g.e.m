# Atalhos de teclado e foco — NKEY.1

## Situação atual
Registro de lote (2026-10-08).

- Regras únicas em `src/lib/keyboard.ts` (`isSearchShortcut`, `isTypingTarget`) e indicação visual única `Kbd` (`src/components/sigem/kbd.tsx`, rótulo "Ctrl K").
- Corrigido: na Secretaria, Ctrl+K podia abrir duas buscas (a da tela e a global); agora a da tela trata primeiro e a global ignora o evento já tratado. Setas e desfazer do editor de layout do calendário não agem em campos editáveis (inclui texto formatável).
- Atalhos existentes, sem novos: Ctrl+K busca; Ctrl+Z/Ctrl+Y no editor externo do calendário; Alt+↑/↓, Ctrl+Enter e Esc na grade de notas. Nenhum atalho exclui ou grava ato institucional.
- Esc/Tab/foco de dialogs vêm dos componentes Radix compartilhados.
- Testado no navegador sem login (/alunos, /secretaria): Ctrl+K abre uma busca, digitação vai ao campo, Esc fecha, Tab segue pular-conteúdo → menu. Teste: `src/lib/keyboard.test.ts`. Com login real: INTERACTIVE_BROWSER_VALIDATION_PENDING.
