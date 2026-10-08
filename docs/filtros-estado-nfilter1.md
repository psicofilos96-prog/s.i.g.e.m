# NFILTER.1 — Filtros, busca e estado das listas

## Situação atual
Classe: Registro de lote. 2026-10-08.

- `src/lib/list-url-state.ts` (`useListUrlFilters`): filtros de opção (situação, escola, período, turno etc.) vão para a URL só quando diferem do padrão; chaves não declaradas e valores fora do formato de opção são ignorados; atualização com `replace` (filtrar não empilha histórico; voltar do detalhe reencontra a lista filtrada; endereço pode ser compartilhado).
- Busca livre NUNCA vai para a URL (contém nomes de pessoas): fica na sessão do navegador (`usePersistentState`), apagada ao fechar a aba.
- Aplicado em Alunos, Profissionais e Turmas (lista). "Limpar filtros" já zera filtros e busca e agora também limpa a URL.
- Consultas redundantes: essas listas filtram no navegador sobre dados já carregados; nenhuma consulta nova por filtro.
- Testes: `src/lib/list-url-state.test.ts`; `src/test/setup.ts` limpa a sessão entre testes.

## Pendências
- REVISAR: CIECE, Relatórios (gerador em etapas) e Auditoria mantêm estado local; levar para a URL exige revisão tela a tela (CIECE já tem referência/turma por contexto; filtros de auditoria podem conter identificadores de pessoa e devem permanecer fora da URL até decisão).
- INTERACTIVE_BROWSER_VALIDATION_PENDING: voltar/avançar com login real.
