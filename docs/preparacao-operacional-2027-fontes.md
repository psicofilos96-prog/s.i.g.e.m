# Preparação operacional 2027 — inventário de fontes (NCFG.1, 2026-10-07)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


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

## NCFG.3 — dry-run de correspondências candidatas (2026-10-07)
Somente leitura: 2027 não aberto, nenhuma turma oficial criada, nenhuma política alterada, nada gravado.
- Motor puro `src/features/year-preparation/correspondence-dryrun.ts` (veredito match | ambiguo | recusa com motivo; chave `domínio@versão:sha256:chave`; impressão digital do plano). 6 testes (parser hh:mm nunca vira zero, ordem das linhas não muda o resultado, fonte 2026 nunca vira turma 2027). Extração sem nome/CPF: `scripts/ncfg3/extract.py`; execução: `scripts/ncfg3/dryrun.ts`. Duas execuções byte-idênticas. Saída: `docs/ncfg3/dryrun-2027.json`.
- **Municipais/conveniadas** (sha 1d212c63…, plano 418bf07f): lotações pessoa×escola 1.146 match (resolve as 518 "repetições" do NCFG.2 — eram a mesma pessoa em várias turmas/escolas); jornadas 9.171 match com carga legível, 28 recusas sem chave; turmas 698 recusadas como `fonte-2026-nao-e-2027`; etapas 17 e componentes 17 ambíguos (catálogo homologado vazio — DADO_AGUARDADO).
- **Privadas** (sha 12b4f27d…, plano 46550aa0): sem código de escola nas abas Professores/Turmas ⇒ 1.713 lotações recusadas sem chave; escolas privadas não estão no cadastro ⇒ 4.071 jornadas e 321 turmas recusadas `escola-desconhecida`; 1 jornada match. Nada inferido.
- **Matriz:** recusa — não há matriz curricular da rede entre as fontes (DADO_AGUARDADO; homologar — ASSIGNMENT_PENDING).
- **Sequência futura** (no JSON): mapeamento humano → catálogos homologados → matriz → pessoas por staging → abertura de 2027 (DEPENDE_DECISAO) → turmas só de fonte 2027 → lotações/jornadas.
- Pendentes: fonte 2027 de turmas; decisão sobre incluir escolas privadas; tela de prévia.
