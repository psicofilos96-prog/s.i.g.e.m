# Busca ativa de alunos e servidores

Busca global, por finalidade (matrícula/lotação na escola de quem pesquisa), somente por igualdade exata.

| Busca | Identificadores aceitos | Capability (escola) | Função |
|---|---|---|---|
| Aluno | CPF completo (comparado pelo HMAC interno) ou identificação INEP de 12 dígitos | `localizar-estudante-para-matricula` | `locate_student_exact` |
| Servidor | matrícula funcional ou QP-MEC | `localizar-servidor-por-identificador` (ainda sem política) | `locate_professional_exact` |

- Não há busca por nome, prefixo, autocomplete ou listagem. A interface rejeita texto com letras/espaços e o banco usa só `=`.
- Resposta mínima: resultado, identificador interno, nome para confirmação e, para aluno, se está ativo nesta escola ou em outra (sem dizer qual).
- Resultados: `encontrado`, `nao-encontrado`, `conflito` (mais de um registro: nada é feito, sem merge), `entrada-invalida`.
- Anti-enumeração: até 20 buscas por usuário a cada 10 minutos (`exact_lookup_events`, append-only, sem o valor pesquisado; sem leitura por app roles).
- Não encontrado: `register_student_with_exact_identity` (rede: `cadastrar-estudante-na-rede`) reutiliza pessoa já existente com o mesmo identificador, recusa identificadores de pessoas diferentes (`identity:conflict`) e recusa aluno já existente (`identity:already-registered-use-search`). Depois segue a matrícula.
- Encontrado ativo em outra escola: só por transferência explícita.
- Servidor encontrado: a lotação 2027 é gravada pelo writer existente `record_posting_version`; múltiplas lotações são permitidas; lotação nunca cria regência.
- Matrícula funcional e QP-MEC são identificadores externos (`qp-mec` entrou como tipo de identificador de pessoa na 0113), nunca chave de pessoa. Hoje nenhum vínculo funcional carregado tem matrícula declarada (0 de 551) e não há QP-MEC: a busca de servidor retornará "não encontrado" até haver cadastro.
- Erros e mensagens nunca repetem o valor digitado.
