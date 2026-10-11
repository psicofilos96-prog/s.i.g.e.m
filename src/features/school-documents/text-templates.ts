/**
 * Modelos de texto por escola (Atestado de Escolaridade, Ata do Conselho de Classe). Versões no banco
 * (`school_text_template_versions`); aqui só padrão inicial, preenchimento de campos e validação.
 * Campo sem dado nunca vira texto inventado: sai como "[não registrado]" e a prévia avisa.
 */
export type TextTemplateKind = "atestado-de-escolaridade" | "ata-conselho-de-classe";
export const TEXT_TEMPLATE_KINDS: readonly TextTemplateKind[] = ["atestado-de-escolaridade", "ata-conselho-de-classe"];
export const TEXT_TEMPLATE_LABEL: Record<TextTemplateKind, string> = {
  "atestado-de-escolaridade": "Atestado de Escolaridade", "ata-conselho-de-classe": "Ata do Conselho de Classe",
};
export const TEXT_TEMPLATE_CAPABILITY: Record<TextTemplateKind, string> = {
  "atestado-de-escolaridade": "emitir-documento-escolar", "ata-conselho-de-classe": "conduzir-conselho-de-classe",
};

export const TEXT_TEMPLATE_FIELDS: Record<TextTemplateKind, readonly { token: string; label: string }[]> = {
  "atestado-de-escolaridade": [
    { token: "aluno.nome", label: "Nome do estudante" }, { token: "aluno.identificador", label: "Identificador" },
    { token: "turma", label: "Turma" }, { token: "escola", label: "Escola" }, { token: "ano_letivo", label: "Ano letivo" }, { token: "data", label: "Data" },
  ],
  "ata-conselho-de-classe": [
    { token: "turma", label: "Turma" }, { token: "periodo", label: "Período" }, { token: "escola", label: "Escola" },
    { token: "ano_letivo", label: "Ano letivo" }, { token: "data", label: "Data da reunião" }, { token: "presentes", label: "Presentes" }, { token: "deliberacoes", label: "Deliberações" },
  ],
};

/** Ponto de partida editável, marcado como rascunho até a escola salvar a própria versão. */
export const TEXT_TEMPLATE_DEFAULT: Record<TextTemplateKind, { title: string; body: string; signatures: string[] }> = {
  "atestado-de-escolaridade": {
    title: "ATESTADO DE ESCOLARIDADE",
    body: "Atestamos, para os devidos fins, que {{aluno.nome}}, identificador {{aluno.identificador}}, está regularmente matriculado(a) e frequenta a turma {{turma}} desta unidade escolar, {{escola}}, no ano letivo de {{ano_letivo}}.\n\nPor ser verdade, firmamos o presente.",
    signatures: ["Secretário(a) Escolar", "Diretor(a)"],
  },
  "ata-conselho-de-classe": {
    title: "ATA DO CONSELHO DE CLASSE",
    body: "Aos {{data}}, reuniu-se o Conselho de Classe da turma {{turma}}, referente ao {{periodo}} do ano letivo de {{ano_letivo}}, na unidade escolar {{escola}}.\n\nPresentes: {{presentes}}.\n\nDeliberações: {{deliberacoes}}\n\nNada mais havendo a tratar, lavrou-se a presente ata, que vai assinada pelos presentes.",
    signatures: ["Orientação Pedagógica", "Direção", "Professor(a) representante"],
  },
};

export const MISSING = "[não registrado]";
const TOKEN = /\{\{\s*([a-z_.]+)\s*\}\}/g;

export function fillTemplate(body: string, facts: Record<string, string | null | undefined>): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const text = body.replace(TOKEN, (_, k: string) => {
    const v = facts[k]?.trim();
    if (!v) { missing.add(k); return MISSING; }
    return v;
  });
  return { text, missing: [...missing] };
}

export function unknownTokens(kind: TextTemplateKind, body: string): string[] {
  const known = new Set(TEXT_TEMPLATE_FIELDS[kind].map((f) => f.token));
  return [...new Set([...body.matchAll(TOKEN)].map((m) => m[1]!))].filter((t) => !known.has(t));
}

export function validateTextTemplate(kind: TextTemplateKind, d: { title: string; body: string; signatures: string[]; reason: string }, hasBase: boolean): string | null {
  if (d.title.trim().length < 3) return "Informe o título (ao menos 3 caracteres).";
  if (d.body.trim().length < 10) return "O texto precisa ter ao menos 10 caracteres.";
  if (d.body.length > 8000) return "O texto pode ter no máximo 8000 caracteres.";
  const u = unknownTokens(kind, d.body); if (u.length) return `Campo desconhecido no texto: ${u.map((x) => `{{${x}}}`).join(", ")}.`;
  if (d.signatures.length > 6) return "No máximo 6 assinaturas.";
  if (hasBase && d.reason.trim().length < 5) return "Informe o motivo da alteração (ao menos 5 caracteres).";
  return null;
}

export function templateMessage(raw: string): string {
  if (raw.includes("capability-missing")) return "Sua conta não tem permissão para este modelo nesta escola.";
  if (raw.includes("base-superseded")) return "Outra pessoa salvou uma versão nova. Recarregue para continuar.";
  if (raw.includes("session-required")) return "Sua sessão expirou. Entre novamente.";
  return "Não foi possível concluir agora. Tente novamente.";
}
