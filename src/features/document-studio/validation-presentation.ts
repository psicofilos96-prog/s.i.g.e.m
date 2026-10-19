import type { ValidationIssue } from "./studio-engine";

const messages: Record<string, string> = {
  "markup-forbidden": "Use texto simples, sem marcação HTML.",
  "font-not-allowed": "Escolha uma fonte disponível no editor.",
  "size-out-of-range": "O tamanho da letra deve ficar entre 6 e 40.",
  "color-not-token": "Escolha uma cor disponível no editor.",
  "columns-1-to-3": "Use de uma a três colunas.",
  "image-source-not-allowed": "Escolha uma imagem do acervo autorizado.",
  "opacity-out-of-range": "A transparência da imagem deve ficar entre 5% e 100%.",
  "image-alt-required": "Informe a descrição da imagem.",
  "margin-out-of-range": "As margens devem ficar entre 5 e 50 mm.",
};

export function validationIssueText(issue: ValidationIssue): string {
  const match = issue.path.match(/^blocks\[(\d+)\]/);
  const location = match ? `Bloco ${Number(match[1]) + 1}` : "Página";
  const message = issue.code.startsWith("token-unknown:")
    ? "Escolha um campo disponível no catálogo."
    : messages[issue.code] ?? "Revise esta configuração antes de salvar.";
  return `${location}: ${message}`;
}