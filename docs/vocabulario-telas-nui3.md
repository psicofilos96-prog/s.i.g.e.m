# NUI.3 — Vocabulário e status canônicos aplicados às telas

## Situação atual
Classe: Registro de lote (2026-10-08).

## Feito
- `knownLabel` em `src/config/ui-vocabulary.ts`: status fora do mapa aparece como "Situação não reconhecida"; ausência como "Sem situação registrada". Nenhum código cru exibido como rótulo.
- Aplicado em: preparação do ano, Nova turma, organização da oferta, ciclo avaliativo, Mapa Estatístico (tela e PDF), contagem de estoque da alimentação.
- Catálogo das primitivas (`components/sigem/ui-vocabulary.ts`) passou a derivar do registro único; "Nada encontrado" → "Nenhum resultado." (inclusive Base de conhecimento).
- Cores cruas: varredura sem ocorrências (já barradas por teste).
- Varredura estática e regressão: `src/config/ui-vocabulary-nui3.test.ts`.
- Estados de negócio inalterados.

## Pendências
- DEPENDE_DECISAO: mapas descritivos por domínio (ex.: "Rascunho — sem valor institucional") mantidos por serem redação normativa de cada domínio.
- INTERACTIVE_BROWSER_VALIDATION_PENDING: conferência visual com login real.
- 2027 não configurado.
