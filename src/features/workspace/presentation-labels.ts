/**
 * Etapa 13UX — tradução de APRESENTAÇÃO.
 *
 * Camada exclusivamente visual: converte identificadores institucionais em
 * linguagem humana. Não decide, não autoriza, não cria verdade e não conhece
 * papéis. Identificador desconhecido continua sendo exibido de forma legível,
 * nunca substituído por suposição.
 */

/** Catálogo aberto de rótulos humanos, por identificador configurado. */
const HUMAN_LABELS: Readonly<Record<string, string>> = {
  // Quem se aguarda
  "aguardando-secretaria-escolar": "Aguardando a Secretaria",
  "aguardando-familia-ou-responsavel": "Aguardando a família",
  "aguardando-outra-instituicao": "Aguardando outra escola",
  // Naturezas de processo
  "processo-inscricao-letiva-demo": "Matrícula",
  "processo-enturmacao-demo": "Turma",
  "processo-mobilidade-demo": "Transferência",
  "processo-juntada-documental-demo": "Documentos",
  // Capacidades (o que a pessoa pode fazer)
  "cap-consultar-vida-escolar": "Consultar a vida escolar do aluno",
  "cap-operar-inscricao-letiva": "Cuidar de matrículas",
  "cap-operar-enturmacao": "Colocar e mover alunos de turma",
  "cap-operar-mobilidade": "Cuidar de transferências",
  "cap-conferir-documento": "Conferir documentos",
  "cap-ler-anotacao-pedagogica": "Ler anotações da Orientação",
  "cap-consultar-identificador-tecnico": "Ver identificação interna do sistema",
  // Quem resolve
  "executor-secretaria-escolar": "Secretaria da escola",
  "executor-direcao-escolar": "Direção da escola",
  "executor-orientacao-pedagogica": "Orientação pedagógica",
};

/** Converte um identificador em texto legível quando não há rótulo cadastrado. */
export function humanizeIdentifier(identifier: string): string {
  const cleaned = identifier
    .replace(/^(cap|processo|fila|janela|operacao|executor|dominio|destino)-/, "")
    .replace(/-(demo|v\d+)$/, "")
    .replace(/-/g, " ")
    .trim();
  if (cleaned.length === 0) return identifier;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** Rótulo humano de um identificador; nunca inventa significado novo. */
export function humanLabelOf(identifier: string | undefined | null): string {
  if (!identifier) return "";
  return HUMAN_LABELS[identifier] ?? humanizeIdentifier(identifier);
}
