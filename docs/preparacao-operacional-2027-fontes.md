# Preparação operacional 2027 — inventário de fontes (NCFG.1, 2026-10-07)

Somente leitura. Nada foi importado; 2027 não foi aberto; nenhuma turma, lotação, jornada, matriz ou política foi gravada.

- Gerador: `scripts/ncfg1/inventory.py` (abas, linhas, colunas, % vazias, duplicatas exatas, anos citados, SHA-256). Saída sem dados pessoais: `docs/ncfg1/inventario-fontes-2027.json`.
- Vínculos funcionais já no banco: **551**.

## Achados
- **Cópias idênticas (mesmo SHA-256):** `Todas_as_turmas` (1/-2/-3) = `Consolidado_-_Dados_das_Turmas`; `Todos_os_alunos` (1/-2/-3) = `Consolidado_-_Dados_dos_Alunos`; `Todos_os_prof` 1/-2/-3; `Todas_as_jornadas` 1/-2/-3; Infraestrutura municipais e conveniadas (1/-2). Cada grupo conta como **uma** fonte.
- **Sem cabeçalho:** Todas_as_turmas/alunos (`Coluna_N`, 165 linhas duplicadas exatas cada), INEP_-_ESCOLAS, Situacao_Escolas_*, RelacaoTurmaEscola → mapeamento de colunas exige revisão humana (BLOQUEIO).
- **Fonte com cabeçalho e chave:** `Consolidado_Escolas_Municipais_Conveniadas` e `..._Privadas` (código Educacenso da escola; abas Turmas, Alunos, Professores, Jornadas e Vínculos, Infraestrutura, Recibo).
- **Anos:** toda fonte tabular é referência 2026 (histórico). Menções a "2027" aparecem dentro de linhas de alunos/vínculos (datas), não como fonte 2027. **Não há fonte 2027 de turmas.**
- **Matriz/currículo:** só PDFs AvaliaRJ 2026 (LP/MT) — matriz de avaliação externa, não matriz curricular da rede; nenhuma utilizável como oficial. Correspondência: DEPENDE_DADO.
- **Calendários:** PDFs 2026; 2027 já vive no sistema.

## Não feito neste lote (sem PASS)
- Dry-run professores × 551 vínculos (match exato/não encontrado/ambíguo/escola/função/vigência).
- Mapeamento das jornadas para o modelo canônico e detecção de conflitos.
- Análise de turmas por escola/etapa/turno/multisseriada.
- Testes de parser/idempotência; secret scan.

## Sequência segura de futura importação
1. Humano confirma mapeamento de colunas das fontes sem cabeçalho.
2. Escolas por código Educacenso → `institutional_school_identifiers`.
3. Profissionais → staging governado (`stage_import_batch`), conflitos nunca sobrescrevem.
4. Lotações/jornadas só após 2027 aberto e regra de vigência decidida.
5. Turmas 2027 só com fonte 2027 real.

## NCFG.2 (parcial)
- `src/features/year-preparation/preimport-plan.ts`: plano determinístico puro (ligar | criar-candidato | rejeitar-duplicado | rejeitar-sem-chave) com chave de idempotência `adaptador@versão:sha256:chave`; 3/3 testes; nada gravado.
- Aplicado à aba Professores dos dois consolidados (chave Identificação única × inep-pessoa): municipais/conveniadas 2403 linhas → 539 ligar, 0 novos, 518 chaves repetidas; privadas 1713 → 14 ligar, 89 candidatos, 290 repetidas. Repetição = mesma pessoa em várias linhas (provável várias escolas/vínculos); a chave correta precisa incluir a escola — revisão pendente antes de qualquer uso. Contagens em docs/ncfg2/plano-preimportacao-professores.json.
- Pendentes: jornadas, turmas, matriz, catálogos etapa/turno, tela de prévia.

## NCFG.2 parte 2 (2026-10-07)
- Plano de turmas (preimport-plan.ts, somente leitura): 698 códigos de turma do consolidado do Censo 2026 → 698 "seria ligado", 0 criar, 0 recusar; duas execuções com o mesmo resultado (sha256 do plano 04c24743…). Arquivo é de 2026: serve para provar o parser, não como fonte 2027 (fonte 2027 de turmas ainda não recebida). docs/ncfg2/plano-preimportacao-turmas.json.
- Pendentes: jornadas, matriz/currículo, catálogos etapa/turno, chave de profissionais com escola, tela de prévia. Nada gravado, 2027 não aberto. Não passou: 2027_PREIMPORT_TOOLING_COMPLETE.
