// GERADO por scripts/rpc-console-stages.mjs a partir das assinaturas reais dos writers. Não edite à mão.
import type { OperationStage } from "@/features/enrollments/enrollment-operations";

export const DEVELOPMENT_STAGES: readonly OperationStage[] = [
 {
  "id": "catalogo",
  "title": "Catálogo e trilhas",
  "summary": "Curso com código imutável e versões; trilha e versões só valem aprovadas por pessoa diferente do autor.",
  "reads": [],
  "actions": [
   {
    "id": "record_dev_catalog_course_version",
    "label": "Registrar versão de curso do catálogo",
    "rpc": "record_dev_catalog_course_version",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_assessment",
      "label": "Assessment",
      "kind": "text"
     },
     {
      "arg": "_code",
      "label": "Code",
      "kind": "text"
     },
     {
      "arg": "_completion",
      "label": "Completion",
      "kind": "text"
     },
     {
      "arg": "_contents",
      "label": "Contents",
      "kind": "list"
     },
     {
      "arg": "_course",
      "label": "Course",
      "kind": "text"
     },
     {
      "arg": "_expected_version",
      "label": "Expected version",
      "kind": "int"
     },
     {
      "arg": "_min_pct",
      "label": "Min pct",
      "kind": "int"
     },
     {
      "arg": "_minutes",
      "label": "Minutes",
      "kind": "int"
     },
     {
      "arg": "_modality",
      "label": "Modality",
      "kind": "text"
     },
     {
      "arg": "_prerequisites",
      "label": "Prerequisites",
      "kind": "list"
     },
     {
      "arg": "_program",
      "label": "Program",
      "kind": "text"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     },
     {
      "arg": "_syllabus",
      "label": "Syllabus",
      "kind": "text"
     },
     {
      "arg": "_title",
      "label": "Title",
      "kind": "text"
     }
    ]
   },
   {
    "id": "decide_dev_version",
    "label": "Decidir versão (aprovar/devolver)",
    "rpc": "decide_dev_version",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_decision",
      "label": "Decision",
      "kind": "text"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     },
     {
      "arg": "_subject",
      "label": "Subject",
      "kind": "text"
     },
     {
      "arg": "_version",
      "label": "Version",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_dev_track_version",
    "label": "Registrar versão de trilha",
    "rpc": "record_dev_track_version",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_audience",
      "label": "Audience",
      "kind": "text"
     },
     {
      "arg": "_competencies",
      "label": "Competencies",
      "kind": "list"
     },
     {
      "arg": "_criteria",
      "label": "Criteria",
      "kind": "text"
     },
     {
      "arg": "_expected_version",
      "label": "Expected version",
      "kind": "int"
     },
     {
      "arg": "_objectives",
      "label": "Objectives",
      "kind": "text"
     },
     {
      "arg": "_program",
      "label": "Program",
      "kind": "text"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     },
     {
      "arg": "_steps",
      "label": "Steps",
      "kind": "json"
     },
     {
      "arg": "_title",
      "label": "Title",
      "kind": "text"
     },
     {
      "arg": "_track",
      "label": "Track",
      "kind": "text"
     }
    ]
   },
   {
    "id": "decide_dev_track_version",
    "label": "Decidir versão de trilha",
    "rpc": "decide_dev_track_version",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_decision",
      "label": "Decision",
      "kind": "text"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     },
     {
      "arg": "_version",
      "label": "Version",
      "kind": "text"
     }
    ]
   }
  ]
 },
 {
  "id": "inscricoes",
  "title": "Inscrições",
  "summary": "Pedido não ocupa vaga; análise por outra pessoa; colocação só sob trava da turma, pelo critério de espera aprovado.",
  "reads": [],
  "actions": [
   {
    "id": "request_dev_enrollment",
    "label": "Pedir inscrição",
    "rpc": "request_dev_enrollment",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_class",
      "label": "Class",
      "kind": "text"
     },
     {
      "arg": "_link",
      "label": "Link",
      "kind": "text"
     },
     {
      "arg": "_mode",
      "label": "Mode",
      "kind": "text"
     },
     {
      "arg": "_person",
      "label": "Person",
      "kind": "text"
     },
     {
      "arg": "_school",
      "label": "School",
      "kind": "text"
     }
    ]
   },
   {
    "id": "review_dev_enrollment",
    "label": "Analisar inscrição",
    "rpc": "review_dev_enrollment",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_decision",
      "label": "Decision",
      "kind": "text"
     },
     {
      "arg": "_enrollment",
      "label": "Enrollment",
      "kind": "text"
     },
     {
      "arg": "_expected_seq",
      "label": "Expected seq",
      "kind": "int"
     },
     {
      "arg": "_priority",
      "label": "Priority",
      "kind": "int"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     }
    ]
   },
   {
    "id": "place_dev_enrollment",
    "label": "Colocar na turma ou na espera",
    "rpc": "place_dev_enrollment",
    "fields": [
     {
      "arg": "_enrollment",
      "label": "Enrollment",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_dev_waitlist_criteria",
    "label": "Registrar critério de espera",
    "rpc": "record_dev_waitlist_criteria",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_basis",
      "label": "Basis",
      "kind": "text"
     },
     {
      "arg": "_expected_version",
      "label": "Expected version",
      "kind": "int"
     },
     {
      "arg": "_keys",
      "label": "Keys",
      "kind": "list"
     },
     {
      "arg": "_logical",
      "label": "Logical",
      "kind": "text"
     }
    ]
   },
   {
    "id": "approve_dev_waitlist_criteria",
    "label": "Aprovar critério de espera",
    "rpc": "approve_dev_waitlist_criteria",
    "fields": [
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     }
    ]
   },
   {
    "id": "adopt_dev_class_waitlist_criteria",
    "label": "Adotar critério na turma",
    "rpc": "adopt_dev_class_waitlist_criteria",
    "fields": [
     {
      "arg": "_class",
      "label": "Class",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_dev_participation",
    "label": "Registrar desistência ou cancelamento",
    "rpc": "record_dev_participation",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_enrollment",
      "label": "Enrollment",
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
     }
    ],
    "fixed": {
     "_pct": null
    }
   }
  ]
 },
 {
  "id": "turmas",
  "title": "Turmas e encontros",
  "summary": "Turma é oferta de uma versão de curso; estado e encontros são versões com motivo.",
  "reads": [],
  "actions": [
   {
    "id": "record_dev_formative_class",
    "label": "Abrir turma formativa",
    "rpc": "record_dev_formative_class",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_audience",
      "label": "Audience",
      "kind": "text"
     },
     {
      "arg": "_course_version",
      "label": "Course version",
      "kind": "text"
     },
     {
      "arg": "_ends",
      "label": "Ends",
      "kind": "text"
     },
     {
      "arg": "_label",
      "label": "Label",
      "kind": "text"
     },
     {
      "arg": "_location",
      "label": "Location",
      "kind": "text"
     },
     {
      "arg": "_school",
      "label": "School",
      "kind": "text"
     },
     {
      "arg": "_seats",
      "label": "Seats",
      "kind": "int"
     },
     {
      "arg": "_starts",
      "label": "Starts",
      "kind": "text"
     },
     {
      "arg": "_trainer_engagements",
      "label": "Trainer engagements",
      "kind": "list"
     }
    ]
   },
   {
    "id": "record_dev_class_status",
    "label": "Registrar estado da turma",
    "rpc": "record_dev_class_status",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_class",
      "label": "Class",
      "kind": "text"
     },
     {
      "arg": "_expected_seq",
      "label": "Expected seq",
      "kind": "int"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     },
     {
      "arg": "_status",
      "label": "Status",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_dev_meeting_version",
    "label": "Registrar versão de encontro",
    "rpc": "record_dev_meeting_version",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_class",
      "label": "Class",
      "kind": "text"
     },
     {
      "arg": "_ends",
      "label": "Ends",
      "kind": "text"
     },
     {
      "arg": "_expected_version",
      "label": "Expected version",
      "kind": "int"
     },
     {
      "arg": "_location",
      "label": "Location",
      "kind": "text"
     },
     {
      "arg": "_meeting",
      "label": "Meeting",
      "kind": "text"
     },
     {
      "arg": "_on",
      "label": "On",
      "kind": "text"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     },
     {
      "arg": "_starts",
      "label": "Starts",
      "kind": "text"
     },
     {
      "arg": "_status",
      "label": "Status",
      "kind": "text"
     },
     {
      "arg": "_trainers",
      "label": "Trainers",
      "kind": "list"
     }
    ]
   }
  ]
 },
 {
  "id": "formadores",
  "title": "Formadores",
  "summary": "Designação temporal sem sobreposição; formador externo nunca recebe permissão.",
  "reads": [],
  "actions": [
   {
    "id": "designate_dev_trainer",
    "label": "Designar formador",
    "rpc": "designate_dev_trainer",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_basis",
      "label": "Basis",
      "kind": "text"
     },
     {
      "arg": "_class",
      "label": "Class",
      "kind": "text"
     },
     {
      "arg": "_engagement",
      "label": "Engagement",
      "kind": "text"
     },
     {
      "arg": "_from",
      "label": "From",
      "kind": "text"
     },
     {
      "arg": "_person",
      "label": "Person",
      "kind": "text"
     },
     {
      "arg": "_role",
      "label": "Role",
      "kind": "text"
     },
     {
      "arg": "_until",
      "label": "Until",
      "kind": "text"
     }
    ]
   },
   {
    "id": "end_dev_trainer_designation",
    "label": "Encerrar designação",
    "rpc": "end_dev_trainer_designation",
    "fields": [
     {
      "arg": "_designation",
      "label": "Designation",
      "kind": "text"
     }
    ]
   }
  ]
 },
 {
  "id": "frequencia",
  "title": "Frequência e atividades",
  "summary": "Presença só com evidência por encontro ou entrega; percentual nunca é digitado: sai da apuração.",
  "reads": [],
  "actions": [
   {
    "id": "record_dev_attendance",
    "label": "Registrar frequência por encontro/atividade",
    "rpc": "record_dev_attendance",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_activity",
      "label": "Activity",
      "kind": "text"
     },
     {
      "arg": "_enrollment",
      "label": "Enrollment",
      "kind": "text"
     },
     {
      "arg": "_evidence_kind",
      "label": "Evidence kind",
      "kind": "text"
     },
     {
      "arg": "_evidence_ref",
      "label": "Evidence ref",
      "kind": "text"
     },
     {
      "arg": "_expected_version",
      "label": "Expected version",
      "kind": "int"
     },
     {
      "arg": "_meeting",
      "label": "Meeting",
      "kind": "text"
     },
     {
      "arg": "_minutes",
      "label": "Minutes",
      "kind": "int"
     },
     {
      "arg": "_mode",
      "label": "Mode",
      "kind": "text"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     },
     {
      "arg": "_status",
      "label": "Status",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_dev_class_activity",
    "label": "Registrar atividade",
    "rpc": "record_dev_class_activity",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_class",
      "label": "Class",
      "kind": "text"
     },
     {
      "arg": "_closes",
      "label": "Closes",
      "kind": "text"
     },
     {
      "arg": "_evidence",
      "label": "Evidence",
      "kind": "text"
     },
     {
      "arg": "_opens",
      "label": "Opens",
      "kind": "text"
     },
     {
      "arg": "_title",
      "label": "Title",
      "kind": "text"
     }
    ]
   },
   {
    "id": "publish_dev_material",
    "label": "Publicar material",
    "rpc": "publish_dev_material",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_class",
      "label": "Class",
      "kind": "text"
     },
     {
      "arg": "_path",
      "label": "Path",
      "kind": "text"
     },
     {
      "arg": "_sha",
      "label": "Sha",
      "kind": "text"
     },
     {
      "arg": "_title",
      "label": "Title",
      "kind": "text"
     },
     {
      "arg": "_url",
      "label": "Url",
      "kind": "text"
     }
    ]
   },
   {
    "id": "withdraw_dev_material",
    "label": "Retirar material",
    "rpc": "withdraw_dev_material",
    "fields": [
     {
      "arg": "_material",
      "label": "Material",
      "kind": "text"
     }
    ]
   },
   {
    "id": "submit_dev_activity",
    "label": "Entregar atividade",
    "rpc": "submit_dev_activity",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_activity",
      "label": "Activity",
      "kind": "text"
     },
     {
      "arg": "_body",
      "label": "Body",
      "kind": "text"
     },
     {
      "arg": "_expected_version",
      "label": "Expected version",
      "kind": "int"
     },
     {
      "arg": "_path",
      "label": "Path",
      "kind": "text"
     },
     {
      "arg": "_sha",
      "label": "Sha",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_dev_feedback",
    "label": "Registrar devolutiva",
    "rpc": "record_dev_feedback",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_comment",
      "label": "Comment",
      "kind": "text"
     },
     {
      "arg": "_outcome",
      "label": "Outcome",
      "kind": "text"
     },
     {
      "arg": "_submission",
      "label": "Submission",
      "kind": "text"
     }
    ]
   }
  ]
 },
 {
  "id": "avaliacoes",
  "title": "Avaliações (rubricas)",
  "summary": "Resultado = nível e justificativa em cada critério da rubrica aprovada; nenhuma nota calculada.",
  "reads": [],
  "actions": [
   {
    "id": "record_dev_rubric_version",
    "label": "Registrar versão de rubrica",
    "rpc": "record_dev_rubric_version",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_course",
      "label": "Course",
      "kind": "text"
     },
     {
      "arg": "_criteria",
      "label": "Criteria",
      "kind": "json"
     },
     {
      "arg": "_expected_version",
      "label": "Expected version",
      "kind": "int"
     },
     {
      "arg": "_logical",
      "label": "Logical",
      "kind": "text"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     },
     {
      "arg": "_title",
      "label": "Title",
      "kind": "text"
     }
    ]
   },
   {
    "id": "approve_dev_rubric",
    "label": "Aprovar rubrica",
    "rpc": "approve_dev_rubric",
    "fields": [
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_dev_learning_result",
    "label": "Registrar resultado",
    "rpc": "record_dev_learning_result",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_enrollment",
      "label": "Enrollment",
      "kind": "text"
     },
     {
      "arg": "_evidence",
      "label": "Evidence",
      "kind": "list"
     },
     {
      "arg": "_expected_version",
      "label": "Expected version",
      "kind": "int"
     },
     {
      "arg": "_justification",
      "label": "Justification",
      "kind": "text"
     },
     {
      "arg": "_outcome",
      "label": "Outcome",
      "kind": "text"
     },
     {
      "arg": "_ratings",
      "label": "Ratings",
      "kind": "json"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     },
     {
      "arg": "_review_request",
      "label": "Review request",
      "kind": "text"
     },
     {
      "arg": "_rubric",
      "label": "Rubric",
      "kind": "text"
     }
    ]
   },
   {
    "id": "request_dev_result_review",
    "label": "Pedir revisão",
    "rpc": "request_dev_result_review",
    "fields": [
     {
      "arg": "_grounds",
      "label": "Grounds",
      "kind": "text"
     }
    ]
   },
   {
    "id": "decide_dev_result_review",
    "label": "Decidir revisão",
    "rpc": "decide_dev_result_review",
    "fields": [
     {
      "arg": "_decision",
      "label": "Decision",
      "kind": "text"
     },
     {
      "arg": "_new_result",
      "label": "New result",
      "kind": "text"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     },
     {
      "arg": "_request",
      "label": "Request",
      "kind": "text"
     }
    ]
   }
  ]
 },
 {
  "id": "conclusao",
  "title": "Conclusão",
  "summary": "Critério aprovado → apuração no banco pelas evidências e rubrica → confirmação por pessoa diferente do participante.",
  "reads": [],
  "actions": [
   {
    "id": "record_dev_completion_criteria",
    "label": "Registrar critério de conclusão",
    "rpc": "record_dev_completion_criteria",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_class",
      "label": "Class",
      "kind": "text"
     },
     {
      "arg": "_expected_version",
      "label": "Expected version",
      "kind": "int"
     },
     {
      "arg": "_min_acts",
      "label": "Min acts",
      "kind": "int"
     },
     {
      "arg": "_min_pct",
      "label": "Min pct",
      "kind": "int"
     },
     {
      "arg": "_outcomes",
      "label": "Outcomes",
      "kind": "list"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     },
     {
      "arg": "_rubric",
      "label": "Rubric",
      "kind": "text"
     }
    ]
   },
   {
    "id": "approve_dev_completion_criteria",
    "label": "Aprovar critério",
    "rpc": "approve_dev_completion_criteria",
    "fields": [
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     }
    ]
   },
   {
    "id": "assess_dev_completion",
    "label": "Apurar conclusão pelas evidências",
    "rpc": "assess_dev_completion",
    "fields": [
     {
      "arg": "_enrollment",
      "label": "Enrollment",
      "kind": "text"
     }
    ]
   },
   {
    "id": "confirm_dev_completion",
    "label": "Confirmar conclusão",
    "rpc": "confirm_dev_completion",
    "fields": [
     {
      "arg": "_assessment",
      "label": "Assessment",
      "kind": "text"
     }
    ]
   }
  ]
 },
 {
  "id": "certificados",
  "title": "Certificados",
  "summary": "Versão → validação humana por pessoa autorizada (≠ autor, titular e confirmador) → emissão com código. PDF só é oferecido depois da emissão.",
  "reads": [],
  "actions": [
   {
    "id": "record_dev_certificate_version",
    "label": "Registrar versão do certificado",
    "rpc": "record_dev_certificate_version",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_enrollment",
      "label": "Enrollment",
      "kind": "text"
     },
     {
      "arg": "_expected_version",
      "label": "Expected version",
      "kind": "int"
     },
     {
      "arg": "_institution",
      "label": "Institution",
      "kind": "text"
     },
     {
      "arg": "_pdf",
      "label": "Pdf",
      "kind": "text"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     }
    ]
   },
   {
    "id": "validate_dev_certificate",
    "label": "Validar ou recusar versão",
    "rpc": "validate_dev_certificate",
    "fields": [
     {
      "arg": "_decision",
      "label": "Decision",
      "kind": "text"
     }
    ]
   },
   {
    "id": "issue_dev_certificate",
    "label": "Emitir certificado validado",
    "rpc": "issue_dev_certificate",
    "fields": [
     {
      "arg": "_version",
      "label": "Version",
      "kind": "text"
     }
    ]
   },
   {
    "id": "revoke_dev_certificate",
    "label": "Revogar certificado",
    "rpc": "revoke_dev_certificate",
    "fields": [
     {
      "arg": "_issuance",
      "label": "Issuance",
      "kind": "text"
     }
    ]
   }
  ]
 },
 {
  "id": "externa",
  "title": "Formação externa",
  "summary": "Comprovante juntado no SIGEM Documentos; análise por outra pessoa.",
  "reads": [],
  "actions": [
   {
    "id": "submit_dev_external_training",
    "label": "Enviar formação externa",
    "rpc": "submit_dev_external_training",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_certificate",
      "label": "Certificate",
      "kind": "text"
     },
     {
      "arg": "_end",
      "label": "End",
      "kind": "text"
     },
     {
      "arg": "_expected_version",
      "label": "Expected version",
      "kind": "int"
     },
     {
      "arg": "_hours",
      "label": "Hours",
      "kind": "int"
     },
     {
      "arg": "_modality",
      "label": "Modality",
      "kind": "text"
     },
     {
      "arg": "_provider",
      "label": "Provider",
      "kind": "text"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     },
     {
      "arg": "_start",
      "label": "Start",
      "kind": "text"
     },
     {
      "arg": "_title",
      "label": "Title",
      "kind": "text"
     },
     {
      "arg": "_training",
      "label": "Training",
      "kind": "text"
     }
    ]
   },
   {
    "id": "review_dev_external_training",
    "label": "Analisar formação externa",
    "rpc": "review_dev_external_training",
    "fields": [
     {
      "arg": "_expected_seq",
      "label": "Expected seq",
      "kind": "int"
     },
     {
      "arg": "_grounds",
      "label": "Grounds",
      "kind": "text"
     },
     {
      "arg": "_outcome",
      "label": "Outcome",
      "kind": "text"
     },
     {
      "arg": "_stage",
      "label": "Stage",
      "kind": "text"
     },
     {
      "arg": "_version",
      "label": "Version",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_dev_partner_version",
    "label": "Registrar versão de parceiro",
    "rpc": "record_dev_partner_version",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_agreement",
      "label": "Agreement",
      "kind": "text"
     },
     {
      "arg": "_code",
      "label": "Code",
      "kind": "text"
     },
     {
      "arg": "_expected_version",
      "label": "Expected version",
      "kind": "int"
     },
     {
      "arg": "_from",
      "label": "From",
      "kind": "text"
     },
     {
      "arg": "_name",
      "label": "Name",
      "kind": "text"
     },
     {
      "arg": "_nature",
      "label": "Nature",
      "kind": "text"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     },
     {
      "arg": "_until",
      "label": "Until",
      "kind": "text"
     }
    ]
   },
   {
    "id": "approve_dev_partner",
    "label": "Aprovar parceiro",
    "rpc": "approve_dev_partner",
    "fields": [
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     }
    ]
   }
  ]
 },
 {
  "id": "pdi",
  "title": "Competências e PDI",
  "summary": "Competência só vale aprovada; PDI é da própria pessoa e o compartilhamento pode ser revogado.",
  "reads": [],
  "actions": [
   {
    "id": "record_dev_competency_version",
    "label": "Registrar versão de competência",
    "rpc": "record_dev_competency_version",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_code",
      "label": "Code",
      "kind": "text"
     },
     {
      "arg": "_description",
      "label": "Description",
      "kind": "text"
     },
     {
      "arg": "_expected_version",
      "label": "Expected version",
      "kind": "int"
     },
     {
      "arg": "_indicators",
      "label": "Indicators",
      "kind": "list"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     },
     {
      "arg": "_title",
      "label": "Title",
      "kind": "text"
     }
    ]
   },
   {
    "id": "approve_dev_competency",
    "label": "Aprovar competência",
    "rpc": "approve_dev_competency",
    "fields": [
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_dev_idp_version",
    "label": "Registrar versão do PDI",
    "rpc": "record_dev_idp_version",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_activities",
      "label": "Activities",
      "kind": "json"
     },
     {
      "arg": "_expected_version",
      "label": "Expected version",
      "kind": "int"
     },
     {
      "arg": "_goals",
      "label": "Goals",
      "kind": "json"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_dev_idp_activity",
    "label": "Registrar atividade do PDI",
    "rpc": "record_dev_idp_activity",
    "fields": [
     {
      "arg": "_activity",
      "label": "Activity",
      "kind": "text"
     },
     {
      "arg": "_expected_seq",
      "label": "Expected seq",
      "kind": "int"
     },
     {
      "arg": "_idp_version",
      "label": "Idp version",
      "kind": "text"
     },
     {
      "arg": "_note",
      "label": "Note",
      "kind": "text"
     },
     {
      "arg": "_status",
      "label": "Status",
      "kind": "text"
     }
    ]
   },
   {
    "id": "revoke_dev_idp_share",
    "label": "Revogar compartilhamento do PDI",
    "rpc": "revoke_dev_idp_share",
    "fields": [
     {
      "arg": "_share",
      "label": "Share",
      "kind": "text"
     }
    ]
   }
  ]
 },
 {
  "id": "questionarios",
  "title": "Questionários",
  "summary": "Questionário sem gabarito/nota e resposta única; pesquisa só aprovada; satisfação nunca entra na conclusão.",
  "reads": [],
  "actions": [
   {
    "id": "record_dev_questionnaire",
    "label": "Registrar questionário",
    "rpc": "record_dev_questionnaire",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_class",
      "label": "Class",
      "kind": "text"
     },
     {
      "arg": "_closes",
      "label": "Closes",
      "kind": "text"
     },
     {
      "arg": "_opens",
      "label": "Opens",
      "kind": "text"
     },
     {
      "arg": "_purpose",
      "label": "Purpose",
      "kind": "text"
     },
     {
      "arg": "_questions",
      "label": "Questions",
      "kind": "json"
     },
     {
      "arg": "_title",
      "label": "Title",
      "kind": "text"
     }
    ]
   },
   {
    "id": "answer_dev_questionnaire",
    "label": "Responder questionário",
    "rpc": "answer_dev_questionnaire",
    "fields": [
     {
      "arg": "_answers",
      "label": "Answers",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_dev_survey_version",
    "label": "Registrar versão de pesquisa",
    "rpc": "record_dev_survey_version",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_course",
      "label": "Course",
      "kind": "text"
     },
     {
      "arg": "_expected_version",
      "label": "Expected version",
      "kind": "int"
     },
     {
      "arg": "_moment",
      "label": "Moment",
      "kind": "text"
     },
     {
      "arg": "_questions",
      "label": "Questions",
      "kind": "json"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     },
     {
      "arg": "_reassess",
      "label": "Reassess",
      "kind": "int"
     }
    ]
   },
   {
    "id": "approve_dev_survey",
    "label": "Aprovar pesquisa",
    "rpc": "approve_dev_survey",
    "fields": [
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     }
    ]
   },
   {
    "id": "answer_dev_survey",
    "label": "Responder pesquisa",
    "rpc": "answer_dev_survey",
    "fields": [
     {
      "arg": "_answers",
      "label": "Answers",
      "kind": "text"
     }
    ]
   }
  ]
 },
 {
  "id": "indicadores",
  "title": "Indicadores",
  "summary": "Indicador e limiar só aprovados por outra pessoa; agregado só com grupo mínimo.",
  "reads": [],
  "actions": [
   {
    "id": "record_dev_impact_indicator",
    "label": "Registrar indicador",
    "rpc": "record_dev_impact_indicator",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_code",
      "label": "Code",
      "kind": "text"
     },
     {
      "arg": "_expected_version",
      "label": "Expected version",
      "kind": "int"
     },
     {
      "arg": "_program",
      "label": "Program",
      "kind": "text"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     },
     {
      "arg": "_source",
      "label": "Source",
      "kind": "text"
     },
     {
      "arg": "_title",
      "label": "Title",
      "kind": "text"
     },
     {
      "arg": "_unit",
      "label": "Unit",
      "kind": "text"
     }
    ]
   },
   {
    "id": "approve_dev_impact_indicator",
    "label": "Aprovar indicador",
    "rpc": "approve_dev_impact_indicator",
    "fields": [
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_dev_impact_reading",
    "label": "Registrar leitura",
    "rpc": "record_dev_impact_reading",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_indicator",
      "label": "Indicator",
      "kind": "text"
     },
     {
      "arg": "_interpretation",
      "label": "Interpretation",
      "kind": "text"
     },
     {
      "arg": "_limitations",
      "label": "Limitations",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_dev_impact_observation",
    "label": "Registrar observação",
    "rpc": "record_dev_impact_observation",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_group",
      "label": "Group",
      "kind": "int"
     },
     {
      "arg": "_indicator",
      "label": "Indicator",
      "kind": "text"
     },
     {
      "arg": "_moment",
      "label": "Moment",
      "kind": "text"
     },
     {
      "arg": "_observed_on",
      "label": "Observed on",
      "kind": "text"
     },
     {
      "arg": "_school",
      "label": "School",
      "kind": "text"
     },
     {
      "arg": "_source",
      "label": "Source",
      "kind": "text"
     },
     {
      "arg": "_value",
      "label": "Value",
      "kind": "int"
     }
    ]
   },
   {
    "id": "record_dev_threshold_version",
    "label": "Registrar limiar",
    "rpc": "record_dev_threshold_version",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_expected_version",
      "label": "Expected version",
      "kind": "int"
     },
     {
      "arg": "_min",
      "label": "Min",
      "kind": "int"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     }
    ]
   },
   {
    "id": "approve_dev_threshold",
    "label": "Aprovar limiar",
    "rpc": "approve_dev_threshold",
    "keyArg": "_key",
    "fields": []
   }
  ]
 }
];
