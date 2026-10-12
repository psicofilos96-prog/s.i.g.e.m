# Matriz evidência/pendência por setor — Lote corretivo 17

**Situação atual:** Registro de lote (2026-10-12). Números gerados por `node scripts/sector-evidence-matrix.mjs` em `docs/data/sector-evidence-matrix.json`, conferidos por `src/test/invariants/sector-evidence-matrix.test.ts`. Evidência é só de código; não afirma homologação, titular de permissão nem fluxo autenticado.

| Setor (ordem de dependência) | Módulos | Com teste | Com tela | Rotas | Pendência principal |
|---|---|---|---|---|---|
| Gestão de Pessoas | 42 | 33 | 16 | 21 | 26 núcleos sem tela; permissões sem titular |
| Organização da Rede | 59 | 52 | 22 | 13 | 37 núcleos sem tela (planejamento/simulação) |
| SIGEM Documentos | 21 | 15 | 13 | 5 | 6 módulos sem teste |
| Secretaria | 37 | 31 | 15 | 7 | 22 núcleos sem tela |
| Direção | 6 | 2 | 4 | 1 | 4 módulos sem teste |
| Docente | 70 | 35 | 38 | 26 | 35 módulos sem teste |
| NEI | 12 | 9 | 9 | 8 | 3 módulos sem teste |
| Mediador | 19 | 19 | 2 | 2 | 17 núcleos sem tela |
| Permanência | 26 | 25 | 4 | 2 | nova `/sigem-permanencia/operacao` (11 writers); projeções L02/L08/L15 sem leitor de tela |
| Centro de Operações | 29 | 26 | 4 | 3 | nova `/centro-de-operacoes/operacao` (27 writers); painéis por projeção sem tela |
| Desenvolvimento | 24 | 23 | 5 | 3 | 19 núcleos sem tela |
| Família | 22 | 9 | 14 | 6 | 13 módulos sem teste |

A lista nominal de módulos sem tela e sem teste por setor está no JSON (`withoutScreen`, `withoutTest`).

Bloqueios: nenhuma permissão nova tem titular (gravação recusada pelo banco até decisão institucional); consoles novos sem teste logado; leitores de tabela não declarados nos consoles gerados (só ações).
