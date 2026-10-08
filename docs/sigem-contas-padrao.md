# Padrões de contas institucionais (somente documentação)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Revisão NDOCS.2 (2026-10-08): conteúdo conferido com HEAD (rotas, nomes de função/tabela, AGENTS, decisões); nenhuma contradição encontrada.


Decisão do usuário (B4.6.6, item 5). Nenhuma conta abaixo é criada por agente; nenhuma senha é criada ou enviada.

| Conta | Padrão | Observação |
|---|---|---|
| Supervisão Escolar | `supervisao@sigem.itap.gov.br` | Instaladora designada (migration 0037, origem auditada). Cria o próprio acesso em Entrar → Criar conta e confirma o e-mail. |
| CIECE | `ciece@sigem.itap.gov.br` | Criada após a instalação por quem tiver `manter-contas-institucionais`. |
| Alimentação | `alimentacao@sigem.itap.gov.br` | Idem. |
| Avaliação | `avalia@sigem.itap.gov.br` | Idem. |
| Orientação Pedagógica | `orientaped.<INEP>@sigem.itap.gov.br` | Só com INEP real da escola cadastrada. |
| Direção Escolar | `diresc.<INEP>@sigem.itap.gov.br` | Só com INEP real. |
| Secretaria Escolar | `sec.<INEP>@sigem.itap.gov.br` | Só com INEP real. |

Nunca criar escola, INEP ou conta fictícia. Ter conta não concede capacidade: só atuação vigente × política homologada.

## Login é identificador, não caixa postal (decisão do usuário, 2026-10-04)
- `@sigem.itap.gov.br` é só identificador de login; nenhum endereço recebe e-mail.
- Cadastro público desligado; contas são provisionadas pela administração (`createInstitutionalAccount`, já confirmada na criação). Confirmação automática ativa na configuração de Auth.
- A conta da Supervisão (criada por signup normal) foi liberada pelo mecanismo administrativo suportado (`auth.admin.updateUserById(..., { email_confirm: true })`), sem alterar senha nem identidade.
- Instalação (`0042`) não exige mais caixa postal confirmada; continuam exigidos: sessão autenticada, designação explícita, confirmação de revisão e impressão digital.
- Recuperação de senha: não há envio por e-mail. Só por `resetInstitutionalCredential` (capacidade `manter-contas-institucionais`), que só existe após a instalação. Antes disso, perda de senha da Supervisão exige ação administrativa do responsável pelo projeto.
