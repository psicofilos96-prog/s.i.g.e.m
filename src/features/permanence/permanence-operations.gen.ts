// GERADO por scripts/rpc-console-stages.mjs a partir das assinaturas reais dos writers. Não edite à mão.
import type { OperationStage } from "@/features/enrollments/enrollment-operations";

export const PERMANENCE_STAGES: readonly OperationStage[] = [
 {
  "id": "regras",
  "title": "Regras e catálogos",
  "summary": "Regra preventiva, tipo de barreira e prioridade: versões validadas e aprovadas no banco por pessoa diferente do autor.",
  "reads": [],
  "actions": [
   {
    "id": "register_permanence_rule_version",
    "label": "Registrar versão de regra",
    "rpc": "register_permanence_rule_version",
    "fields": [
     {
      "arg": "_change_reason",
      "label": "Change reason",
      "kind": "text"
     },
     {
      "arg": "_combine",
      "label": "Combine",
      "kind": "text"
     },
     {
      "arg": "_conditions",
      "label": "Conditions",
      "kind": "json"
     },
     {
      "arg": "_expected_version",
      "label": "Expected version",
      "kind": "int"
     },
     {
      "arg": "_rule_key",
      "label": "Rule key",
      "kind": "text"
     },
     {
      "arg": "_scope",
      "label": "Scope",
      "kind": "json"
     },
     {
      "arg": "_source_ref",
      "label": "Source ref",
      "kind": "text"
     },
     {
      "arg": "_title",
      "label": "Title",
      "kind": "text"
     },
     {
      "arg": "_valid_from",
      "label": "Valid from",
      "kind": "text"
     },
     {
      "arg": "_valid_to",
      "label": "Valid to",
      "kind": "text"
     }
    ]
   },
   {
    "id": "register_permanence_barrier_type",
    "label": "Registrar tipo de barreira",
    "rpc": "register_permanence_barrier_type",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_expected_version",
      "label": "Expected version",
      "kind": "int"
     },
     {
      "arg": "_label",
      "label": "Label",
      "kind": "text"
     },
     {
      "arg": "_requires_confirmation",
      "label": "Requires confirmation",
      "kind": "bool"
     },
     {
      "arg": "_sensitivity",
      "label": "Sensitivity",
      "kind": "text"
     }
    ]
   },
   {
    "id": "register_permanence_priority",
    "label": "Registrar prioridade",
    "rpc": "register_permanence_priority",
    "fields": [
     {
      "arg": "_code",
      "label": "Code",
      "kind": "text"
     },
     {
      "arg": "_decision",
      "label": "Decision",
      "kind": "text"
     },
     {
      "arg": "_label",
      "label": "Label",
      "kind": "text"
     },
     {
      "arg": "_rank",
      "label": "Rank",
      "kind": "int"
     }
    ]
   }
  ]
 },
 {
  "id": "alertas",
  "title": "Alertas",
  "summary": "Alerta só de regra aprovada vigente; conferir antes de agir e encerrar com justificativa.",
  "reads": [],
  "actions": [
   {
    "id": "register_permanence_alert",
    "label": "Registrar alerta",
    "rpc": "register_permanence_alert",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_enrollment",
      "label": "Enrollment",
      "kind": "text"
     },
     {
      "arg": "_observation",
      "label": "Observation",
      "kind": "json"
     },
     {
      "arg": "_observed_on",
      "label": "Observed on",
      "kind": "text"
     },
     {
      "arg": "_origin",
      "label": "Origin",
      "kind": "text"
     },
     {
      "arg": "_rule_version",
      "label": "Rule version",
      "kind": "text"
     },
     {
      "arg": "_school",
      "label": "School",
      "kind": "text"
     },
     {
      "arg": "_student",
      "label": "Student",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_permanence_alert_event",
    "label": "Registrar evento do alerta",
    "rpc": "record_permanence_alert_event",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_alert",
      "label": "Alert",
      "kind": "text"
     },
     {
      "arg": "_case",
      "label": "Case",
      "kind": "text"
     },
     {
      "arg": "_expected_seq",
      "label": "Expected seq",
      "kind": "int"
     },
     {
      "arg": "_justification",
      "label": "Justification",
      "kind": "text"
     },
     {
      "arg": "_kind",
      "label": "Kind",
      "kind": "text"
     }
    ]
   }
  ]
 },
 {
  "id": "contatos",
  "title": "Contatos e visitas",
  "summary": "Destinatário é sempre o responsável autorizado vigente; visita só com segurança conferida. Não registre endereço, CPF, telefone ou laudo.",
  "reads": [],
  "actions": [
   {
    "id": "record_permanence_contact_attempt",
    "label": "Registrar tentativa de contato",
    "rpc": "record_permanence_contact_attempt",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_attempted_on",
      "label": "Attempted on",
      "kind": "text"
     },
     {
      "arg": "_authorization",
      "label": "Authorization",
      "kind": "text"
     },
     {
      "arg": "_case",
      "label": "Case",
      "kind": "text"
     },
     {
      "arg": "_channel",
      "label": "Channel",
      "kind": "text"
     },
     {
      "arg": "_next",
      "label": "Next",
      "kind": "text"
     },
     {
      "arg": "_providence",
      "label": "Providence",
      "kind": "text"
     },
     {
      "arg": "_result",
      "label": "Result",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_permanence_visit",
    "label": "Registrar visita/atendimento",
    "rpc": "record_permanence_visit",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_case",
      "label": "Case",
      "kind": "text"
     },
     {
      "arg": "_companion",
      "label": "Companion",
      "kind": "text"
     },
     {
      "arg": "_expected_seq",
      "label": "Expected seq",
      "kind": "int"
     },
     {
      "arg": "_justification",
      "label": "Justification",
      "kind": "text"
     },
     {
      "arg": "_kind",
      "label": "Kind",
      "kind": "text"
     },
     {
      "arg": "_objective",
      "label": "Objective",
      "kind": "text"
     },
     {
      "arg": "_occurred_on",
      "label": "Occurred on",
      "kind": "text"
     },
     {
      "arg": "_professional",
      "label": "Professional",
      "kind": "text"
     },
     {
      "arg": "_providences",
      "label": "Providences",
      "kind": "text"
     },
     {
      "arg": "_return_needed",
      "label": "Return needed",
      "kind": "bool"
     },
     {
      "arg": "_return_on",
      "label": "Return on",
      "kind": "text"
     },
     {
      "arg": "_safety_checked",
      "label": "Safety checked",
      "kind": "bool"
     },
     {
      "arg": "_safety_note",
      "label": "Safety note",
      "kind": "text"
     },
     {
      "arg": "_scheduled_on",
      "label": "Scheduled on",
      "kind": "text"
     },
     {
      "arg": "_status",
      "label": "Status",
      "kind": "text"
     },
     {
      "arg": "_visit_ref",
      "label": "Visit ref",
      "kind": "text"
     }
    ]
   }
  ]
 },
 {
  "id": "plano",
  "title": "Plano, encaminhamento e retorno",
  "summary": "Plano individual em versões; encaminhamento só pela allowlist do destino aprovado; retorno referencia a enturmação oficial.",
  "reads": [],
  "actions": [
   {
    "id": "record_permanence_plan_version",
    "label": "Registrar versão do plano",
    "rpc": "record_permanence_plan_version",
    "fields": [
     {
      "arg": "_actions",
      "label": "Actions",
      "kind": "json"
     },
     {
      "arg": "_barrier_refs",
      "label": "Barrier refs",
      "kind": "list"
     },
     {
      "arg": "_case",
      "label": "Case",
      "kind": "text"
     },
     {
      "arg": "_expected_version",
      "label": "Expected version",
      "kind": "int"
     },
     {
      "arg": "_intervention",
      "label": "Intervention",
      "kind": "text"
     },
     {
      "arg": "_objectives",
      "label": "Objectives",
      "kind": "json"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     },
     {
      "arg": "_resources",
      "label": "Resources",
      "kind": "json"
     }
    ]
   },
   {
    "id": "record_permanence_plan_review",
    "label": "Registrar reavaliação",
    "rpc": "record_permanence_plan_review",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_action_key",
      "label": "Action key",
      "kind": "text"
     },
     {
      "arg": "_case",
      "label": "Case",
      "kind": "text"
     },
     {
      "arg": "_evidence",
      "label": "Evidence",
      "kind": "text"
     },
     {
      "arg": "_expected_seq",
      "label": "Expected seq",
      "kind": "int"
     },
     {
      "arg": "_kind",
      "label": "Kind",
      "kind": "text"
     },
     {
      "arg": "_outcome",
      "label": "Outcome",
      "kind": "text"
     },
     {
      "arg": "_plan_version",
      "label": "Plan version",
      "kind": "int"
     }
    ]
   },
   {
    "id": "record_permanence_referral_event",
    "label": "Registrar evento de encaminhamento",
    "rpc": "record_permanence_referral_event",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_evidence_ref",
      "label": "Evidence ref",
      "kind": "text"
     },
     {
      "arg": "_evidence_sha",
      "label": "Evidence sha",
      "kind": "text"
     },
     {
      "arg": "_expected_seq",
      "label": "Expected seq",
      "kind": "int"
     },
     {
      "arg": "_kind",
      "label": "Kind",
      "kind": "text"
     },
     {
      "arg": "_note",
      "label": "Note",
      "kind": "text"
     },
     {
      "arg": "_referral",
      "label": "Referral",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_permanence_return",
    "label": "Registrar retorno escolar",
    "rpc": "record_permanence_return",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_case",
      "label": "Case",
      "kind": "text"
     },
     {
      "arg": "_episode",
      "label": "Episode",
      "kind": "text"
     },
     {
      "arg": "_returned_on",
      "label": "Returned on",
      "kind": "text"
     },
     {
      "arg": "_welcome_note",
      "label": "Welcome note",
      "kind": "text"
     }
    ]
   }
  ]
 }
];
