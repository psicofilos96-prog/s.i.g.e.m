# Lote 40 — Vínculos escolares do Educacenso 2026

Situação atual: Registro de lote. Sem dado pessoal.

## Constatação
A planilha enviada (SHA-256 `0e7ff594…f8df`) é a mesma fonte já carregada pela operação técnica `technical_import_educacenso_2026_professionals` (ledger `technical_execution_operations`). Nada foi reimportado: a mesma fonte cai no mesmo registro (tipo de operação + hash).

## Estado persistido (antes = depois)
- 2.403 atuações em `professional_census_declarations`, 1.057 pessoas, 55 escolas, 698 turmas pelo código INEP, 0 sem turma correspondente, 0 duplicadas.
- 1.057 pessoas reconhecidas pela identificação única INEP (`institutional_person_identifiers`, tipo `inep-pessoa`); CPF só como HMAC, sem leitura por papéis de aplicação.
- 77 profissionais em mais de uma escola e 79 com mais de uma função, preservados como linhas distintas.
- Funções: Docente 1.584; apoio escolar (Lei 13.146) 477; atividade complementar 219; auxiliar 118; Libras 5.
- Folha preservada: 2.037 registros funcionais, 551 vínculos históricos, 10.822 pessoas, 0 ligações matrícula→pessoa (reconciliação continua separada).

## Implementado
- `CensusDeclaredStaff` (aba "Educacenso 2026" em Gestão de Pessoas e seção na Estação da Gestão Escolar), lido pela RLS existente (atuação na escola ou na rede), marcado como dado declarado ao Censo, sem lotação, regência ou matrícula.
- Teste `census-declared-staff-model.test.ts` 2/2.

## Controles conferidos
- Escrita: nenhum INSERT para anon/authenticated/service_role; carregador sem EXECUTE para authenticated/service_role.
- Leitura: só authenticated com atuação vigente (escola ou rede).

## Bloqueado
- Sem titular de atuação vigente com sessão real, a tela não foi exercida autenticada.
- CI e SHA do GitHub não verificados daqui.
