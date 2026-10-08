# NLOGIN.2 — Tela de login (`/auth`)

**Situação atual:** Registro de lote (2026-10-08).

- Celular/tablet ganharam faixa institucional (brasão, Prefeitura de Itaperuna, Secretaria Municipal de Educação); computador mantém a foto de Itaperuna e o brasão.
- Estados de sessão: "Conferindo se você já está conectado…", "Você já está conectado. Abrindo o SIGEM…", formulário.
- Erros humanos (`src/features/authority/login-messages.ts`): campos vazios, login/senha (mesma mensagem para login inexistente), muitas tentativas, sem conexão, SIGEM indisponível; nunca texto técnico.
- Acessibilidade: dica do formato do login ligada ao campo, `aria-invalid`, `aria-busy`, botão de senha com `aria-pressed`, aviso de Caps Lock, um único `<main>`.
- Sem exemplo de credencial; política de autenticação inalterada (sem cadastro público, sem recuperação por e-mail).
- Regressão visual: 1440×900, 1366×768, tablet 820×1180, 390×844 — sem rolagem lateral nem erro de página.
