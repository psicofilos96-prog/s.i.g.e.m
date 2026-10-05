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

## Fechamento S.1
- O cadastro de aluno não encontrado passou para `register_student_for_school(_school, …)`, com capability **escolar** `cadastrar-estudante-na-escola`. A identidade continua global e única; a autorização vem do caso de uso da escola. A autoria e a finalidade ficam em `student_registration_events` (append-only, sem identificadores). A função antiga, que exigia capability de rede, ficou sem EXECUTE para app roles e está marcada como DEPRECATED.
- **Identidade profissional ≠ vínculo funcional central ≠ lotação escolar ≠ regência.**
  - Identidade: pessoa + CPF-HMAC/INEP/QP-MEC.
  - Vínculo central: `professional_functional_links` / `record_posting_version` (contrato, cargo, situação), só com `manter-registro-funcional` de rede.
  - Lotação escolar: `school_staff_presence` via `record_school_staff_presence` (`manter-lotacao-da-escola`), append-only por vínculo×escola×ano, com base esperada e várias escolas possíveis.
  - Regência: `teaching_assignment*`, nunca criada pela lotação.
- **Servidor não encontrado:** o cadastro pela escola fica BLOQUEADO de propósito. A lotação exige um vínculo funcional, e esse vínculo é registro central. Deixar a escola criá-lo ampliaria privilégio. O fluxo fica: RH de rede cria o vínculo → a escola localiza e confirma a lotação.
- Testes DB confirmaram: uma pessoa que existe mas não é aluno aparece como "não encontrado", sem revelar o nome; nome ou prefixo dão "entrada inválida"; o limite de 20 buscas funciona; nenhum valor pesquisado fica gravado.
