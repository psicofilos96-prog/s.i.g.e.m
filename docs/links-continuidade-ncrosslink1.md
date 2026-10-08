# NCROSSLINK.1 — Links e continuidade entre módulos

## Situação atual
Classe: Registro de lote (2026-10-08).

- Destinos: todo `Link`/`navigate` é tipado pelo roteador; link para rota inexistente falha o typecheck (verde), portanto não há link órfão de página.
- Corrigido: três links internos usavam `<a href>` (recarregavam a aplicação e perdiam estado/filtros): Estação Cozinha (Alimentação), central de Ajuda (painel de ajuda) e Importação governada (implantação). Agora usam o roteador.
- Mantido: `openapi.json` (arquivo técnico, não página).
- Acesso não ampliado: nenhuma permissão, menu ou gate alterado; deep links continuam sob StationGate/banco (NPERM.3).
- Guardado por `src/test/invariants/ncrosslink1-links.test.ts`.
- REVISAR: preservação de ano/escola/filtros nos 25 "Voltar" e nos detalhes de aluno/turma/profissional/Mapa/Diário depende de cada tela; auditoria tela a tela pendente. Nenhum atalho redundante removido sem decisão.
- INTERACTIVE_BROWSER_VALIDATION_PENDING: percorrer aluno→turma→Diário→Mapa e retorno com login real.
