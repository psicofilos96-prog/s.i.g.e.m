# SIGEM — UX Premium 2027 ("Premium Civic Operating System")

## Situação atual (UX.PREMIUM.0, 2026-10-09)
- Classe: **Registro de lote**. Fundação aplicada; redesign global NÃO concluído.
- Resultado: PARCIAL — fundação de tokens e componentes compartilhados aplicada; rotas autenticadas não verificadas visualmente (sem sessão no ambiente de prova).

## Princípios
Onde estou / o que está acontecendo / o que faço agora, em 3 segundos. Uma ação principal; avançados recolhidos; zero ≠ sem dado; nada de cartão dentro de cartão.

## Tokens (src/styles.css)
- Paleta: navy institucional (`--sidebar`, `--institutional`), azul Itaperuna (`--primary`), ciano só como acento (`--territory-accent`), superfícies off-white (`--background`), bordas azul-acinzentadas finas (`--border`).
- Raio base `--radius: 0.625rem`.
- Elevações `--elevation-0/1/2` (sombras muito sutis).
- Espaço `--space-1…12`, `--page-gap`; larguras `--content-max` (88rem), `--content-reading` (46rem).
- Tabela `--table-row` / `--table-row-compact`; números tabulares em toda `<table>`.
- Movimento `--motion-fast/base`, `--motion-ease`; `prefers-reduced-motion` respeitado.
- Utilitários: `eyebrow` (rótulo com traço de acento), `page-container`, `surface-panel`, `text-tabular`.

## Anatomia da página
`PageHeader` (eyebrow opcional → título 28–32px → descrição em largura de leitura → ações à direita) → tarefa/estado → conteúdo. Área de trabalho com respiro lateral maior (40px no desktop).

## Componentes afetados nesta fundação
AppShell (menu lateral com item ativo por barra de acento + superfície), PageHeader, Card (borda fina + elevação 1), Table (cabeçalho discreto, linha 48px, hover sutil).

## Antes/depois
- Login: removida a placa decorativa por trás do cartão de acesso (antes/depois em `/tmp/browser/ux/`, não versionados).
- Rotas autenticadas: herdam AppShell/PageHeader/Card/Table; comparação visual pendente.

## Rotas ainda não migradas individualmente
Admin/Visão Geral, Secretaria, CIECE, Avaliação, Meu Diário, Alunos/Profissionais, Matrícula/Nova Turma, Mapa, Calendário (chrome) — recebem só a fundação compartilhada; reestruturação de "mesa de trabalho" por estação fica para UX.PREMIUM.1. Impressões/PDFs não foram tocados.

## UX.PREMIUM.1 (2026-10-09) — PARCIAL
- Barra superior: trilha "domínio do menu › página" (`breadcrumbForPath`, teste `src/config/breadcrumb.test.ts`); rota fora do menu mostra só a página.
- Homes de estação (Admin, CIECE, Supervisão, Secretaria, Direção, OP, Avaliação, Alimentação, Docente, NEI, Família): já seguem tarefas por estação dos lotes NSEC/NAVAL/CIECE/admin/docente; reestruturação visual para "mesa de trabalho" premium NÃO migrada.
- Screenshots das homes: não produzidos — ambiente sem sessão autenticada.
