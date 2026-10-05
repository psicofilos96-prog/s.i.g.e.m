# Portal da Família — projeção read-only (migration 0069)

## Auditoria
Não existia modelo canônico de responsáveis/autorização no banco. O "contato autorizado" da Orientação (13F) é projeção de capacidade em memória, não vínculo de família. Foi criado o contrato abaixo, sem nenhum registro.

## Contrato
- `guardian_authorizations`: autorização de UMA conta (o responsável) para UM educando, numa escola de matrícula, com seções permitidas, vigência e natureza da relação opcional (só valor homologado de catálogo — nenhum valor semeado). Constituição / substituição / revogação append-only com motivo; cadeia por `supersedes_id` com sucessor único (concorrência otimista).
- Gravação: `record_guardian_authorization` exige `manter-autorizacao-de-responsavel` (escola do educando ou rede) — **sem regra de política: fechada para todos**. Responsável ≠ quem grava.
- Leitura: `family_students()` e `family_student_summary(aluno)` (DEFINER, `search_path=''`), sempre por `auth.uid()`; outra criança, autorização vencida, revogada ou substituída ⇒ `family:not-authorized` (mesma resposta para inexistente). Tabela sem acesso direto.
- Minimização: nome de exibição, escola, turma, datas e documentos (tipo, número, data, código de verificação). Nunca nascimento, documentos pessoais, endereço, saúde, inclusão/NEE ou snapshot de documento.

## Seções
| Seção | Estado |
|---|---|
| Vida escolar (matrícula/turma) | Real, se autorizada. |
| Documentos | Lista de emissões + verificação pública. |
| Calendário | Link ao calendário homologado. |
| Frequência, Avaliações/boletim, Comunicados | **Sem publicação à família**: não há ato de publicação para a família; nada interno é mostrado. |

## Pendências
1. Quem recebe `manter-autorizacao-de-responsavel`.
2. Catálogo de natureza da relação (valores homologados).
3. Como as contas dos responsáveis serão criadas (hoje contas só pela administração).
4. Ato de publicação à família para frequência, boletim e comunicados.
