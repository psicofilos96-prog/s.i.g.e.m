# Plano — Unidades Escolares

## Objetivo
Criar a primeira experiência operacional do SIGEM para consulta e contexto de unidades escolares, preservando integralmente Home, Login, branding e identidade territorial.

## Implementação
- Adicionar `/unidades` com cabeçalho compacto, busca local por teclado, filtros demonstrativos, chips ativos, ordenação, seleção e tabela densa com cabeçalho fixo, ações e paginação apenas visual.
- Adicionar `/unidades/$id` como página contextual, com cabeçalho da unidade, navegação interna escalável e somente a visão geral implementada.
- Criar fixtures locais, pequenos e explicitamente demonstrativos, separados da interface e sem assumir um modelo definitivo do domínio.
- Extrair padrões operacionais reutilizáveis: cabeçalhos, barra de dados/filtros, tabela, detalhes semânticos, contexto e linha do tempo de auditoria.
- Demonstrar futura edição em painel lateral acessível, com poucos campos ilustrativos e sem persistência.
- Documentar no Design System os estados operacionais: carregamento, vazio, erro, acesso negado, não encontrado, dados desatualizados, conflito, alterações não salvas e somente leitura.
- Integrar “Unidades escolares” à navegação e ajustar o contexto da barra superior sem alterar a direção visual aprovada.

## Comportamento responsivo
- Desktop: alta densidade, várias linhas visíveis e contexto lateral no detalhe.
- Tablet: colunas secundárias reduzidas e composição preservada.
- Mobile: tabela com colunas prioritárias e acesso às demais informações pelo detalhe, sem compressão ilegível.

## Qualidade
- Garantir semântica de tabela, foco visível, rótulos, estados textuais e controles acessíveis.
- Validar rotas, busca, filtros, seleção, ordenação, painel de edição e navegação por teclado.
- Verificar 1366×768, 1440×900, 1920×1080, tablet e mobile, além de console, overflow, build, typecheck, lint e testes existentes.

## Limites preservados
Sem backend, banco, autenticação, APIs, migrations, persistência, schema definitivo, regras institucionais inferidas ou outros módulos educacionais.
