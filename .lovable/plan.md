# Etapa 12C — Instrumentos e Lançamentos Avaliativos

## Objetivo

Permitir que o professor, dentro do Diário, registre **o que usou para avaliar** (instrumento) e **o registro individual de cada aluno** (lançamento), dentro de um período oficial e na escala definida pela configuração avaliativa.

A etapa não calcula nada. Ela registra, valida a forma e mostra o que está pendente.

## Base consolidada que será reaproveitada (sem uma segunda fonte de verdade)

- **12A:** tipos `AssessmentInstrument`, `AssessmentEntry` e `EntryValue`; `validateEntryValue`, `recordingReadiness`, `studentPlacements`, `eligibilityInPeriod`, `placementOn` e `deriveResult` (sempre `sem-regra-homologada`); pendências normativas.
- **12B:** configuração avaliativa por turma, escalas, tipos de instrumento permitidos, `allowsGrades` e `usesPedagogicalRecords`, e a rota `/diario/turmas/$turmaId/avaliacao`.
- **12B.1 e 12B.2:** períodos referenciados por `calendarPeriodId`. As datas vêm do calendário, e só um calendário publicado vale como fonte oficial.
- **Diário (11A–11F):** atuação pedagógica, contexto da turma, rascunhos, histórico, correções que não apagam o registro anterior, confirmação ao sair com alterações e filtros.

## Percurso do professor

```text
Meu Diário → Turma → Avaliações → Instrumentos do período → Instrumento → Lançamentos
```

1. **Avaliações da turma** (a rota existente ganha a aba "Instrumentos"). Mostra os períodos da estrutura em que o usuário está. Para cada período aparecem os instrumentos e a indicação de lançamentos pendentes e registrados, sem médias.
2. **Novo instrumento.** Campos:
   - tipo (somente os permitidos pela configuração);
   - título;
   - data de aplicação;
   - componente ou campo, vindo da atuação pedagógica;
   - descrição opcional.

   O período é **derivado da data** por `periodOn`. O professor não escolhe um período que não corresponda à data.
3. **Lançamentos do instrumento.** Lista dos alunos elegíveis na data de aplicação, com a colocação acadêmica daquele momento. O campo de cada aluno segue a escala da configuração:
   - numérica: mínimo, máximo e passo vêm da configuração;
   - conceitual: as opções configuradas;
   - descritiva: texto livre;
   - "não registrado", com motivo livre e sem motivos inventados.
4. **Salvar e concluir.**
   - O rascunho vale apenas enquanto a aba estiver aberta.
   - Um instrumento concluído fica somente para leitura.
   - Uma correção posterior cria uma nova versão com justificativa e histórico, sem apagar a anterior (mesmo padrão da 11B).

## Regras estruturais (não normativas) que serão aplicadas

Todas já existem ou decorrem da 12A:

- um lançamento por aluno e instrumento;
- valor compatível com a escala configurada;
- instrumento vinculado a atuação, turma, componente e período vigentes na data (`recordingReadiness`);
- aluno sem vínculo com a turma na data não recebe lançamento;
- aluno que entrou depois ou saiu antes aparece identificado (`eligibilityInPeriod`), sem nenhuma regra de aproveitamento;
- período vindo de calendário em rascunho ou de estrutura demonstrativa: os registros aparecem como **"não oficial / demonstrativo"**;
- instrumento com data fora de qualquer período: bloqueado, com explicação.

## Educação Infantil

- A configuração de acompanhamento não admite instrumentos (`allowedInstrumentTypeIds` vazio e `allowsGrades=false`).
- A aba de instrumentos **não aparece** para turmas de EI. No lugar dela, uma mensagem remete aos registros de experiências do Diário.
- A decisão vem da configuração, nunca de um teste do tipo "é Educação Infantil?".

## Consulta

- Na página do instrumento, a Direção e a Supervisão têm apenas leitura (mesmo modelo de perfis de demonstração, sem permissões reais).
- Nenhuma média, nenhuma soma de pesos e nenhuma situação. Onde um resultado seria esperado, aparece "Sem regra homologada", com as pendências normativas relacionadas.

## O que NÃO será feito

Não serão implementados:

- médias, somatórios, pesos ou arredondamento;
- recuperação;
- resultado de período, componente ou final;
- aprovação ou reprovação;
- Conselho de Classe como regra;
- frequência oficial;
- boletim, ficha individual, folha final ou fechamento;
- visão consolidada por aluno (etapa posterior);
- backend, persistência real ou permissões reais.

Não serão criadas quantidade mínima de instrumentos, notas mínimas, prazos de lançamento ou motivos padronizados de ausência.

## Ponto de atenção para sua decisão (durante a aprovação)

Os dados de demonstração do Diário são de **2026**. Para 2026 existe apenas uma estrutura de períodos demonstrativa; o calendário oficial existe somente para 2027, e ainda em rascunho. Proposta:
- os lançamentos usam os períodos da estrutura configurada da turma;
- quando esses períodos não vierem de um calendário homologado, tudo fica marcado como "não oficial";
- não crio um calendário 2026 oficial nem invento datas oficiais.

## Validação prevista

- Testes para:
  - criação de instrumento restrita aos tipos permitidos;
  - período derivado da data;
  - bloqueio fora de período;
  - escalas numérica, conceitual e descritiva;
  - valor inválido;
  - lançamento duplicado;
  - aluno sem vínculo, ingresso posterior e saída anterior;
  - "não registrado" com motivo;
  - conclusão só para leitura e correção com histórico;
  - EI sem instrumentos;
  - perfis sem edição;
  - `deriveResult` continuando `sem-regra-homologada`;
  - calendário e documentos de 2027 sem alteração.
- Total de testes igual ou maior que 836, além de tipos, build e lint.
- Verificação visual em 390, 768, 1024, 1366, 1440 e 1920 px, com zoom de 125% e 150% e menu aberto e recolhido.

## Detalhes técnicos

- Novo `src/features/assessment/assessment-entry-draft.ts`: estado temporário por aba e mutações puras (criar, editar e concluir instrumento; lançar; marcar "não registrado"; corrigir), com um único ponto de escrita e histórico.
- `assessment-repository.ts`: operações de instrumentos e lançamentos em memória.
- Novas rotas:
  - `diario.turmas.$turmaId.avaliacao.index.tsx`: a página atual passa a ter um item filho;
  - `diario.turmas.$turmaId.avaliacao.instrumentos.novo.tsx`;
  - `diario.turmas.$turmaId.avaliacao.instrumentos.$instrumentoId.tsx`.

  A rota atual `avaliacao.tsx` vira o nível que contém as filhas (`<Outlet />`).
- Os componentes seguem o Design System aprovado: tabelas de lançamento com o mesmo padrão da chamada da 11C e cartões em telas pequenas.
- As datas continuam em ISO canônico, e o período é resolvido por `calendarPeriodId` quando existir.
