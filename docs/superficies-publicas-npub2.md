# NPUB.2 — Auditoria das superfícies públicas

Inventário (allowlist `isPublicPath`): `/publico`, `/publico/$slug`, `/verificar/$codigo`, `/verificar/carteirinha/$codigo`. Todo o resto é interno.

| Superfície | Estados | Minimização | Enumeração |
|---|---|---|---|
| Portal | publicado / indisponível (rascunho, revogado e inexistente iguais) | só texto autorado, tipos em lista fechada | resposta única `indisponivel` |
| Documento | válido, cancelado, retificado, não encontrado, formato inválido; desconhecido ⇒ não encontrado | tipo, número, data, campos públicos, hash; nunca notas/frequência/saúde/endereço | código não sequencial; noindex |
| Carteirinha | válida, expirada, cancelada, substituída, indisponível | nome, escola, turma, ano | noindex; inexistente = indisponível |
| Calendário | não público (DEPENDE_DECISAO) | — | — |
| 404 | texto em português, `h1` único | — | — |

Nada novo foi publicado. Testes: `public-portal.test.ts`, `public-surface-audit.test.ts`. Headless 1280/375: sem rolagem lateral, `lang=pt-BR`, nenhum botão/link sem nome, sem menu interno nas páginas públicas.
Pendente: limite de tentativas por IP = INFRAESTRUTURA_PENDENTE; calendário público = DEPENDE_DECISAO; leitura de QR por câmera = INTERACTIVE_BROWSER_VALIDATION_PENDING.
