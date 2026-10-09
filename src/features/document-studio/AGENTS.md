## Studio de documentos (`src/features/document-studio/`)
- Modelo é dado declarativo (blocos fechados, estilos de lista fechada, tokens só do catálogo de readers); renderização sempre escapa, porque HTML/JS de usuário ou SQL em template ampliaria acesso.
- Estado do modelo é projeção de eventos e emissão congela versão+fatos+hash e exige homologado, porque editar o modelo não pode alterar documento já emitido.
- Persistência (DOCS.PRO.3, `studio-cloud.ts`, 0266): versões/eventos/emissões append-only gravados só por RPC `studio_*` que revalida Admin ou capability; verificação pública só por `verify_studio_document` (código opaco, resposta igual para inválido e inexistente), porque a tela nunca é garantia e código sequencial permitiria enumeração.
