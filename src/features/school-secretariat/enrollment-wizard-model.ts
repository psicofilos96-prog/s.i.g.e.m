import { isValidCpf } from "@/lib/cpf";
/**
 * N5.2.1 — modelo puro da matrícula guiada. O rascunho é só ficha de trabalho; nada aqui é matrícula oficial.
 * CPF nunca entra no payload: vai uma vez ao banco, que guarda só HMAC + dois últimos dígitos.
 */
import { isIsoDate } from "@/lib/academic-date";
export type WizardPayload = {
  aluno?: { nome?: string; nascimento?: string; nomeSocial?: string };
  responsaveis?: { nome?: string; parentesco?: string; telefone?: string }[];
  endereco?: { logradouro?: string; numero?: string; bairro?: string; cidade?: string; cep?: string };
  documentos?: { certidao?: string; observacao?: string };
  escolar?: { escolaAnterior?: string; observacao?: string };
  matricula?: { ano?: string; data?: string };
  turma?: { id?: string; nome?: string };
  foto?: { path?: string };
};

export const WIZARD_STEPS = [
  { n: 1, title: "Aluno" }, { n: 2, title: "Responsáveis" }, { n: 3, title: "Endereço" }, { n: 4, title: "Documentos" },
  { n: 5, title: "Informações escolares" }, { n: 6, title: "Ano letivo" }, { n: 7, title: "Turma" }, { n: 8, title: "Revisar e concluir" },
] as const;

export type Identity = { existingStudentId: string | null; hasCpf: boolean; inep: string | null; birthDate?: string | null; certificate?: string | null; cpfRequiredFrom?: string };

/** The caller supplies the current versioned rule; the constant is only the initial system default. */
export const DEFAULT_CPF_REQUIRED_FROM = "2017-12-01";
export function identityProblems(p: WizardPayload, id: Identity): Partial<Record<WizardField, string>> {
  const birth = id.birthDate ?? p.aluno?.nascimento;
  const f: Partial<Record<WizardField, string>> = {};
  if (!birth || !isIsoDate(birth)) f["aluno.nascimento"] = "Informe uma data de nascimento válida.";
  else if (birth >= (id.cpfRequiredFrom ?? DEFAULT_CPF_REQUIRED_FROM)) {
    if (!id.hasCpf) f.identificacao = "Informe e guarde o CPF do aluno. A certidão e o INEP não substituem o CPF para esta data de nascimento.";
  } else if (!id.hasCpf && !(id.certificate ?? p.documentos?.certidao)?.trim()) {
    f["documentos.certidao"] = "Informe o número ou a matrícula da certidão de nascimento, ou guarde o CPF do aluno.";
  }
  return f;
}

/** O que falta em cada passo. Só o indispensável à cadeia canônica é obrigatório; o resto não tem norma que o exija. */
export function missingByStep(p: WizardPayload, id: Identity): Record<number, string[]> {
  const m: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [] };
  const first = m[1]; const documents = m[4]; const year = m[6]; const classes = m[7];
  if (!first || !documents || !year || !classes) return m;
  if (!id.existingStudentId) {
    if (!p.aluno?.nome?.trim()) first.push("Nome completo do aluno");
  }
  const problems = identityProblems(p, id);
  if (problems["aluno.nascimento"]) first.push("Data de nascimento válida");
  if (problems.identificacao) first.push("CPF do aluno");
  if (problems["documentos.certidao"]) documents.push("Certidão de nascimento ou CPF");
  if (!p.matricula?.ano) year.push("Ano letivo");
  if (!p.matricula?.data) year.push("Data de início");
  if (!p.turma?.id) classes.push("Turma");
  return m;
}

/** NFORM.2 — erro específico por campo (mesmas regras de `missingByStep`, nada novo). */
export type WizardField = "aluno.nome" | "aluno.nascimento" | "documentos.certidao" | "identificacao" | "matricula.ano" | "matricula.data" | "turma" | "cpf";
export function fieldProblems(p: WizardPayload, id: Identity, cpfDraft = ""): Partial<Record<WizardField, string>> {
  const f: Partial<Record<WizardField, string>> = identityProblems(p, id);
  if (!id.existingStudentId) {
    if (!p.aluno?.nome?.trim()) f["aluno.nome"] = "Informe o nome completo do aluno.";
  }
  if (cpfDraft.trim() && !validCpf(cpfDraft)) f.cpf = "CPF inválido: confira os 11 dígitos.";
  if (!p.matricula?.ano) f["matricula.ano"] = "Escolha o ano letivo.";
  if (!p.matricula?.data) f["matricula.data"] = "Informe a data de início na escola.";
  if (!p.turma?.id) f.turma = "Escolha uma turma.";
  return f;
}

export const canComplete = (p: WizardPayload, id: Identity) =>
  Object.values(missingByStep(p, id)).every((l) => l.length === 0);

export const validCpf = isValidCpf;

export type ClassOption = { id: string; name: string; shift: string | null; capacity: number | null; occupancy: number };

/** "Há vaga / Lotada / Capacidade não informada": ausência de capacidade nunca vira zero. */
export function seatLabel(c: ClassOption): string {
  if (c.capacity == null) return `Capacidade não informada · ${c.occupancy} enturmado(s)`;
  return c.occupancy >= c.capacity ? `Lotada · ${c.occupancy}/${c.capacity}` : `Há vaga · ${c.occupancy}/${c.capacity}`;
}

const MESSAGES: Record<string, string> = {
  "student:birth-required": "Confira a data de nascimento do aluno antes de concluir.",
  "student:cpf-required-by-birth": "O CPF é obrigatório para esta data de nascimento. Informe e guarde o CPF; certidão ou INEP não o substituem.",
  "student:certificate-required": "Informe a certidão de nascimento ou o CPF do aluno.",
  "student:certificate-invalid": "Confira o número ou a matrícula da certidão de nascimento.",
  "student:birth-conflict": "A data de nascimento difere do cadastro oficial. Corrija a ficha do aluno antes de matricular.",
  "draft:stale-head": "Este rascunho foi alterado em outra janela. Recarregue para continuar.",
  "draft:capability-missing": "Sua conta não pode matricular nesta escola.",
  "draft:not-found": "Rascunho não encontrado.",
  "draft:closed": "Este rascunho já foi concluído ou descartado.",
  "draft:payload-invalid": "Há um campo não permitido no rascunho.",
  "draft:school-immutable": "A escola do rascunho não pode mudar.",
  "secretariat:year-not-open": "O ano letivo escolhido não está aberto para matrícula.",
  "secretariat:class-invalid": "A turma não pertence a esta escola e ano.",
  "secretariat:class-not-active-on-date": "A turma não está ativa na data de início escolhida.",
  "secretariat:outside-year": "A data de início está fora do ano letivo.",
  "secretariat:class-full": "A turma está lotada: a capacidade informada já foi atingida. Escolha outra turma.",
  "secretariat:active-class-exists": "O aluno já está em uma turma neste ano.",
  "identity:already-registered-use-search": "Já existe aluno com este CPF/INEP. Use \"Já tem cadastro?\" no passo 1.",
  "identity:conflict": "CPF e INEP pertencem a pessoas diferentes. Confira os documentos.",
  "student:name-required": "Informe o nome do aluno.",
  "student:exact-identifier-required": "Informe CPF ou INEP do aluno.",
};
export function wizardMessage(e: unknown): string {
  const t = e instanceof Error ? e.message : String(e);
  const k = Object.keys(MESSAGES).find((x) => t.includes(x));
  return k ? MESSAGES[k]! : "Não foi possível concluir. Nada foi gravado como matrícula; o rascunho continua salvo.";
}

/** Tipo REAL da imagem pelos primeiros bytes (não confia na extensão nem no navegador). */
export function sniffImage(b: Uint8Array): "jpg" | "png" | "webp" | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x)) return "png";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "webp";
  return null;
}
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export function photoProblem(kind: ReturnType<typeof sniffImage>, size: number): string | null {
  if (!kind) return "Use uma foto JPG, PNG ou WEBP.";
  if (size > PHOTO_MAX_BYTES) return "A foto passa de 5 MB. Escolha uma menor.";
  return null;
}
export const photoPath = (school: string, draft: string, id: string, ext: string) => `${school}/${draft}/${id}.${ext}`;
