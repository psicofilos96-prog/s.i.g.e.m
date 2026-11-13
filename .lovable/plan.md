# Corrigir "Não foi possível confirmar seu acesso" e ano letivo único no sistema

## 1. Erro "Não foi possível confirmar seu acesso"

O que se sabe: essa tela aparece quando a leitura da sessão de login falha ou demora mais que o prazo, antes mesmo de consultar permissões. Hoje qualquer falha passageira (rede lenta, aba reaberta, sessão antiga após nova publicação) vira essa tela fixa, e "Tentar novamente" só recarrega a página e pode cair no mesmo ponto.

A causa exata ainda não está confirmada; o primeiro passo é reproduzir.

Passos:
- Reproduzir no navegador com uma conta real (abertura fria, aba reaberta, sessão vencida) e registrar qual leitura falhou e com qual motivo.
- Leitura da sessão: tentar de novo automaticamente (2 tentativas curtas) antes de mostrar o erro; sessão vencida ou inválida leva à tela de login, nunca a esta mensagem.
- "Tentar novamente" refaz só a leitura da sessão e das permissões, sem recarregar a página inteira; se continuar falhando, oferecer "Entrar de novo" (sai e volta ao login).
- Mensagem humana explicando o que fazer, sem códigos técnicos.
- Continua fechado por segurança: enquanto o acesso não for confirmado, nenhum dado aparece.

## 2. Ano letivo corrente como padrão em todo o SIGEM

Regra pedida:
- O ano mostrado em todo o sistema é o ano letivo corrente pela data de hoje (em 2026, 2026; ao entrar em 2027, 2027).
- No menu superior fica um seletor "Ano letivo" para consultar outro ano (ex.: 2026 estando em 2027).
- A escolha vale para todas as telas até a pessoa trocar de novo ou sair; ao entrar de novo, volta ao ano corrente.
- Se o ano corrente ainda não estiver cadastrado, o sistema avisa e mostra o mais recente cadastrado, sem inventar ano.

Passos:
- Criar uma escolha de ano única, compartilhada por todas as telas, partindo do ano corrente pela data do servidor.
- Colocar o seletor no menu superior (computador e celular).
- Trocar os seletores de ano locais das cerca de 29 telas (Secretaria, Mapa Estatístico, Diário, Turmas, Matrículas, Transferências, Alocações, Avaliação, Calendário, Matrizes, Direção, Supervisão, Painéis etc.) para lerem essa escolha; telas que precisam comparar anos (Preparação 2027, Referência 2026) mantêm seus dois anos explícitos.
- Teste: data em 2026 escolhe 2026; data em 2027 escolhe 2027; escolha manual de 2026 é respeitada; ano ausente não é inventado.

## Detalhes técnicos
- Sessão: `session-authority.ts` (getSession com withListTimeout → phase "error") e `password-change-gate.tsx` (reload). Adicionar retry com backoff no boot, tratar erros de token como signed-out, e expor `retry()` no origin que reinicia `startOrigin` e invalida `session-authority`.
- Ano: novo `src/features/academic-year/current-year.tsx` (provider + `useActiveAcademicYear()`), ano corrente pela data operacional do servidor sobre `academic_years`; escolha em sessionStorage chaveada por userId#revision; seletor no AppShell; pathAllowed e RLS inalterados (filtro de tela não autoriza).
- Registrar a regra em AGENTS.md e a decisão do usuário na memória.
