## Ficha institucional (AQ — `school-profile.ts`, sem migration)
- A ficha é projeção de `institutional_school_record_versions` + observações 0105, com asOf (valid_from) e knownAt (registered_at/known_at); nenhuma tabela de perfil, porque cópia viraria segunda verdade.
- Versão cadastral é retrato completo: campo omitido fica NULL ("não informado"), nunca falso; infraestrutura importada só muda por nova carga da fonte.
- Pendência é só ausência de dado, sem nota nem ranking; edição só pelo writer `register_school_record_version` na administração.

## Nova/Editar unidade (ONDA 2 — `unit-editor-page.tsx`, `/unidades/nova`, `/unidades/editar/$id`)
- Tela própria reutiliza `SchoolsAdminSection` em modo `focus` e grava só por `register_school_record_version`; botão aparece só com `manter-cadastro-unidade-escolar`, porque formulário paralelo criaria segundo writer.

- Leitores do cadastro e dos nomes vigentes usam `readPages` com ordem estável, limite explícito e prazo; teto atingido ou resposta inválida nunca vira lista completa, porque o servidor corta respostas em mil linhas.
- A lista operacional resolve a versão por data (`schoolVersionAt`), e a ficha sem versão vigente usa título neutro; a cabeça futura continua disponível no histórico e na administração, porque agendamento não antecipa vigência.
- O carregamento do cadastro cancela a leitura anterior ao recarregar/desmontar e ignora gerações antigas, porque resposta atrasada não pode restaurar informação superada.
