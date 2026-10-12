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

## Lote 41 — Folha × Gestão de Pessoas
- View `payroll_servant_registrations` (0511, INVOKER): uma linha por matrícula com chave de servidor = nome (espaços/caixa) + nascimento; sem nascimento a matrícula fica sozinha. Resultado: 2.037 vínculos, 1.952 servidores, 85 com 2 matrículas, 0 homônimos com nascimento diferente, 0 ligações comprovadas a pessoas.
- Folha × Educacenso: a folha não tem INEP-pessoa nem CPF; nenhuma ligação foi criada. As 1.057 pessoas/2.403 atuações do Educacenso seguem intactas.
- Tela: Gestão de Pessoas → "Folha de agosto/2026 — vínculos por servidor", com matrícula, cargo, admissão e jornada por vínculo; sem remuneração.
- Testes: `payroll-servants-model.test.ts` 4/4 (inclui dupla matrícula e homônimos).
- Bloqueado: tela autenticada não exercida (sem titular de `consultar-registro-funcional`); CI/SHA do commit não verificados.
