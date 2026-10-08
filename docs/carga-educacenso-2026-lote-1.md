# Carga real EducaCenso 2026 — LOTE 1 (Frentes B–E)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


Registro factual. Nenhum CPF, nome ou linha bruta aparece aqui.

## B — Infraestrutura: LOADED
- Fontes: `Aspectos_Infraestrutura_municipais.xlsx` (sha256 `5b82d019…5d33`, 40 escolas) e `Aspectos_Infraestrutura_conveniadas.xlsx` (`db804fad…1da6`, 15 escolas). Snapshot 2026-08-31.
- 54 atributos no catálogo aberto, 2.970 observações (55 escolas × 54), 0 rejeições, 0 autoria humana. Retry idempotente (0 linhas novas).
- Campos de gestor/informante excluídos. O Censo preliminar só traz agregados: não gera fato por escola.

## C — Turmas: LOADED (com ressalvas de data)
- `Todas_as_turmas.xlsx` e `Consolidado_-_Dados_das_Turmas.xlsx` são byte-idênticos (`43b79beb…b229`): uma evidência só.
- 698 turmas em 55 escolas; 698 identificadores EducaCenso (externos, não PK); 9.169 declarações literais (tipo de turma, etapa, mediação, multi/fluxo, contagens). Turno: ausente na fonte, não inferido. Nenhum catálogo estendido; nenhuma matriz, professor ou aluno criado.
- Autoria: `recorded_by` humano XOR `technical_operation_id` (0107); 0 versões com as duas.
- Reconciliação de matrículas declaradas × Censo preliminar: bate em todas as etapas (municipal EI 1.876, EF 5.759, EJA 185, AEE 320; conveniada EI 1.525, EF 331, EJA 86).
- Ressalvas: (1) o ano letivo 2026 foi criado tecnicamente com limites 01/01–31/12, uma convenção que a fonte não sustenta; (2) `valid_from` das turmas = 2026-08-31 (início do cadastro escolar), enquanto a fonte foi emitida em 2026-07-31.

## D — Profissionais: PARTIAL
- `Todos_os_prof.xlsx` (`0e7ff594…f8df`): 2.403 linhas, 1.057 pessoas com CPF válido. Foram criadas como pessoas canônicas, com identificadores CPF-HMAC e INEP privados.
- 2.403 declarações censitárias (função na turma ≠ regência); 551 vínculos/exercícios, só quando a fonte declara regime (287 efetivos, 264 temporários). 1.078 linhas sem regime: nenhum vínculo inventado. 0 lotações, 0 atuações/logins/capabilities.
- `Relacao_Servidores_por_Escola` e `Relacao_Funcionarios_SEMED`: não têm CPF. Não foram carregadas, porque casar por nome é proibido. A matrícula, sozinha, não identifica a pessoa.

## E — Jornadas: BLOCKED (fonte não é de profissionais)
- `Todas_as_jornadas.xlsx` (`e7f33aa1…10e`) é o relatório "Jornada Escolar" de **alunos**: 9.198 pessoas distintas, 0 em comum com os 1.057 profissionais, vínculos adicionais AEE/atividade complementar. Carregá-lo como jornada profissional seria fato falso.
- Não houve carga. A operação `technical_import_educacenso_2026_professional_schedules` existe, mas não foi usada. A fonte fica para a Frente F (LOTE 2). Os dados temporários derivados foram apagados.

## Migrations
0106 (transporte de payload técnico, sem acesso de app roles) e 0107 (autoria XOR, núcleo comum de turmas, identificadores privados, declarações, operações C/D/E).

## Prova
`supabase/tests/educacenso_2026_c_d_e.sql`: privilégios, kind/hash inválidos, CPF inválido, append-only, XOR de autoria, ausência de autoria falsa e automação desligada ⇒ recusa. Executada na Cloud com rollback (OK).
