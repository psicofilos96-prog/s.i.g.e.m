# NUI.2 — Vocabulário, status e microtextos

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Registro de lote**. Instantâneo do lote na data em que foi escrito.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


Registro único: `src/config/ui-vocabulary.ts` (ações, estados, status). Teste: `src/config/ui-vocabulary.test.ts` varre todas as telas.

- Ações: Voltar (retorna), Cancelar (desiste, nada grava), Salvar (grava, tarefa aberta), Concluir (último passo), Fechar (painel informativo), Confirmar (ação perigosa), Tentar novamente (só leitura), Limpar filtros / Limpar busca.
- Estados: "Carregando…", "Nenhum resultado.", "Nenhum registro.", ausência = "não disponível".
- Status equivalentes (pt/en) → um rótulo (Rascunho, Em revisão, Enviado, Devolvido, Aprovado, Homologado, Publicado, Pendente, Cancelado, Substituído, Expirado); desconhecido = "Situação não reconhecida".
- Datas: exibição pt-BR; números de gráfico em pt-BR. Cálculos internos com data ISO (`en-CA`) mantidos — não são exibidos.
- Corrigido: "Tentar de novo" (2) → "Tentar novamente"; "Carregando" (2) → "Carregando…"; "Sem resultados"/"Nada encontrado." (4 telas) → "Nenhum resultado."; número do gráfico sem locale → pt-BR.
- Mantido: "Login" no acesso (termo institucional das contas @sigem).
- Pendente: migrar badges existentes para `statusLabel` tela a tela (PENDENTE); zoom/leitor de tela com login (INTERACTIVE_BROWSER_VALIDATION_PENDING).
