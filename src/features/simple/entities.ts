// SIGEM Simples — cadastros diretos (decisão do proprietário, 2026-10-15).
// Cada cadastro é descrito aqui; telas, formulários e relatórios leem esta lista.
export type FieldType = "text" | "date" | "number" | "select" | "ref";
export interface Field {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: string[];
  ref?: EntityKey;
  required?: boolean;
  list?: boolean;
  group?: boolean; // pode agrupar no relatório
}
export type EntityKey = "students" | "staff" | "classes" | "schools";
export interface Entity {
  key: EntityKey;
  table: "sg_students" | "sg_staff" | "sg_classes" | "sg_schools";
  path: "/cadastro/alunos" | "/cadastro/servidores" | "/cadastro/turmas" | "/cadastro/escolas";
  one: string;
  many: string;
  emoji: string;
  tone: string;
  fields: Field[];
}

const SEX = ["F", "M"];
const SHIFT = ["Manhã", "Tarde", "Noite", "Integral"];
const STAGE = ["Creche", "Pré-escola", "1º ano", "2º ano", "3º ano", "4º ano", "5º ano", "6º ano", "7º ano", "8º ano", "9º ano", "EJA", "Multisseriada"];

export const ENTITIES: Record<EntityKey, Entity> = {
  students: {
    key: "students", table: "sg_students", path: "/cadastro/alunos", one: "Aluno", many: "Alunos", emoji: "🎒", tone: "var(--sg-t1)",
    fields: [
      { key: "name", label: "Nome", type: "text", placeholder: "Ex.: Maria da Silva", required: true, list: true },
      { key: "birth_date", label: "Nascimento", type: "date", list: true },
      { key: "sex", label: "Sexo", type: "select", options: SEX, group: true },
      { key: "school_id", label: "Escola", type: "ref", ref: "schools", list: true, group: true },
      { key: "class_id", label: "Turma", type: "ref", ref: "classes", list: true, group: true },
      { key: "status", label: "Situação", type: "select", options: ["Ativo", "Transferido", "Remanejado", "Evadido", "Concluído"], group: true },
      { key: "race", label: "Cor/raça", type: "text", group: true },
      { key: "special_needs", label: "Necessidade especial", type: "text", group: true },
      { key: "mother_name", label: "Mãe", type: "text" },
      { key: "father_name", label: "Pai", type: "text" },
      { key: "guardian_name", label: "Responsável", type: "text" },
      { key: "phone", label: "Telefone", type: "text", placeholder: "(22) 99999-0000" },
      { key: "address", label: "Endereço", type: "text" },
    ],
  },
  staff: {
    key: "staff", table: "sg_staff", path: "/cadastro/servidores", one: "Servidor", many: "Servidores", emoji: "👩‍🏫", tone: "var(--sg-t2)",
    fields: [
      { key: "name", label: "Nome", type: "text", placeholder: "Ex.: João Souza", required: true, list: true },
      { key: "registration", label: "Matrícula", type: "text" },
      { key: "role", label: "Cargo", type: "text", placeholder: "Ex.: Professor I", list: true, group: true },
      { key: "function", label: "Função", type: "text", placeholder: "Ex.: Regente", group: true },
      { key: "bond", label: "Vínculo", type: "select", options: ["Efetivo", "Contratado", "Comissionado", "Cedido"], group: true },
      { key: "status", label: "Situação", type: "select", options: ["Em atividade", "Licença", "Afastado", "Desligado"], group: true },
      { key: "school_id", label: "Escola", type: "ref", ref: "schools", list: true, group: true },
      { key: "phone", label: "Telefone", type: "text" },
    ],
  },
  classes: {
    key: "classes", table: "sg_classes", path: "/cadastro/turmas", one: "Turma", many: "Turmas", emoji: "🏫", tone: "var(--sg-t3)",
    fields: [
      { key: "name", label: "Nome", type: "text", placeholder: "Ex.: 3º ano A", required: true, list: true },
      { key: "school_id", label: "Escola", type: "ref", ref: "schools", list: true, group: true },
      { key: "stage", label: "Etapa", type: "select", options: STAGE, list: true, group: true },
      { key: "shift", label: "Turno", type: "select", options: SHIFT, group: true },
      { key: "year", label: "Ano", type: "number", group: true },
      { key: "teacher_id", label: "Professor", type: "ref", ref: "staff", list: true },
      { key: "capacity", label: "Vagas", type: "number" },
    ],
  },
  schools: {
    key: "schools", table: "sg_schools", path: "/cadastro/escolas", one: "Escola", many: "Escolas", emoji: "🏛️", tone: "var(--sg-t4)",
    fields: [
      { key: "name", label: "Nome", type: "text", placeholder: "Ex.: E. M. Esperança", required: true, list: true },
      { key: "inep", label: "INEP", type: "text" },
      { key: "district", label: "Bairro", type: "text", list: true, group: true },
      { key: "zone", label: "Zona", type: "select", options: ["Urbana", "Rural"], group: true },
      { key: "address", label: "Endereço", type: "text" },
      { key: "phone", label: "Telefone", type: "text", list: true },
      { key: "email", label: "E-mail", type: "text" },
    ],
  },
};
export const ENTITY_LIST = [ENTITIES.students, ENTITIES.staff, ENTITIES.classes, ENTITIES.schools];
