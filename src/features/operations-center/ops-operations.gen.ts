// GERADO por scripts/rpc-console-stages.mjs a partir das assinaturas reais dos writers. Não edite à mão.
import type { OperationStage } from "@/features/enrollments/enrollment-operations";

export const OPS_STAGES: readonly OperationStage[] = [
 {
  "id": "solicitacoes",
  "title": "Solicitações",
  "summary": "Solicitação dos setores com eventos append-only; responsável = atuação vigente.",
  "reads": [],
  "actions": [
   {
    "id": "open_ops_request",
    "label": "Abrir solicitação",
    "rpc": "open_ops_request",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_kind",
      "label": "Kind",
      "kind": "text"
     },
     {
      "arg": "_school",
      "label": "School",
      "kind": "text"
     },
     {
      "arg": "_sector",
      "label": "Sector",
      "kind": "text"
     },
     {
      "arg": "_subject",
      "label": "Subject",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_ops_request_event",
    "label": "Registrar evento",
    "rpc": "record_ops_request_event",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_case_event",
      "label": "Case event",
      "kind": "text"
     },
     {
      "arg": "_engagement",
      "label": "Engagement",
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
      "arg": "_object_kind",
      "label": "Object kind",
      "kind": "text"
     },
     {
      "arg": "_object_ref",
      "label": "Object ref",
      "kind": "text"
     },
     {
      "arg": "_protocol",
      "label": "Protocol",
      "kind": "text"
     },
     {
      "arg": "_request",
      "label": "Request",
      "kind": "text"
     },
     {
      "arg": "_valid_from",
      "label": "Valid from",
      "kind": "text"
     }
    ]
   }
  ]
 },
 {
  "id": "infraestrutura",
  "title": "Infraestrutura",
  "summary": "Espaços em versões, vistorias, disponibilidade e restrições de uso; evidência só juntada no SIGEM Documentos.",
  "reads": [],
  "actions": [
   {
    "id": "record_ops_space_version",
    "label": "Registrar versão do espaço",
    "rpc": "record_ops_space_version",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_accessibility",
      "label": "Accessibility",
      "kind": "list"
     },
     {
      "arg": "_assessed_on",
      "label": "Assessed on",
      "kind": "text"
     },
     {
      "arg": "_capacity",
      "label": "Capacity",
      "kind": "int"
     },
     {
      "arg": "_capacity_source",
      "label": "Capacity source",
      "kind": "text"
     },
     {
      "arg": "_condition",
      "label": "Condition",
      "kind": "text"
     },
     {
      "arg": "_expected_version",
      "label": "Expected version",
      "kind": "int"
     },
     {
      "arg": "_name",
      "label": "Name",
      "kind": "text"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     },
     {
      "arg": "_restrictions",
      "label": "Restrictions",
      "kind": "text"
     },
     {
      "arg": "_space",
      "label": "Space",
      "kind": "text"
     },
     {
      "arg": "_status",
      "label": "Status",
      "kind": "text"
     },
     {
      "arg": "_type_version",
      "label": "Type version",
      "kind": "text"
     },
     {
      "arg": "_valid_from",
      "label": "Valid from",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_ops_inspection",
    "label": "Registrar vistoria",
    "rpc": "record_ops_inspection",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_answers",
      "label": "Answers",
      "kind": "json"
     },
     {
      "arg": "_evidence",
      "label": "Evidence",
      "kind": "list"
     },
     {
      "arg": "_expected_seq",
      "label": "Expected seq",
      "kind": "int"
     },
     {
      "arg": "_inspection",
      "label": "Inspection",
      "kind": "text"
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
      "arg": "_performed_on",
      "label": "Performed on",
      "kind": "text"
     },
     {
      "arg": "_recommendations",
      "label": "Recommendations",
      "kind": "json"
     }
    ]
   },
   {
    "id": "record_ops_space_availability",
    "label": "Registrar disponibilidade",
    "rpc": "record_ops_space_availability",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_expected_seq",
      "label": "Expected seq",
      "kind": "int"
     },
     {
      "arg": "_from",
      "label": "From",
      "kind": "text"
     },
     {
      "arg": "_mo",
      "label": "Mo",
      "kind": "text"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     },
     {
      "arg": "_space",
      "label": "Space",
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
    "id": "record_ops_space_use_restriction",
    "label": "Impor/levantar restrição de uso",
    "rpc": "record_ops_space_use_restriction",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_action",
      "label": "Action",
      "kind": "text"
     },
     {
      "arg": "_doc",
      "label": "Doc",
      "kind": "text"
     },
     {
      "arg": "_expected_seq",
      "label": "Expected seq",
      "kind": "int"
     },
     {
      "arg": "_from",
      "label": "From",
      "kind": "text"
     },
     {
      "arg": "_limit",
      "label": "Limit",
      "kind": "int"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     },
     {
      "arg": "_rkey",
      "label": "Rkey",
      "kind": "text"
     },
     {
      "arg": "_severity",
      "label": "Severity",
      "kind": "text"
     },
     {
      "arg": "_shifts",
      "label": "Shifts",
      "kind": "list"
     },
     {
      "arg": "_space",
      "label": "Space",
      "kind": "text"
     },
     {
      "arg": "_to",
      "label": "To",
      "kind": "text"
     },
     {
      "arg": "_work",
      "label": "Work",
      "kind": "text"
     }
    ]
   }
  ]
 },
 {
  "id": "manutencao",
  "title": "Manutenção, serviços e obras",
  "summary": "Etapas impostas no banco; conferência por pessoa diferente de quem executou.",
  "reads": [],
  "actions": [
   {
    "id": "open_ops_maintenance_order",
    "label": "Abrir ordem de manutenção",
    "rpc": "open_ops_maintenance_order",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_catalog",
      "label": "Catalog",
      "kind": "text"
     },
     {
      "arg": "_protocol",
      "label": "Protocol",
      "kind": "text"
     },
     {
      "arg": "_request",
      "label": "Request",
      "kind": "text"
     },
     {
      "arg": "_space",
      "label": "Space",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_ops_maintenance_event",
    "label": "Registrar etapa da manutenção",
    "rpc": "record_ops_maintenance_event",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_assessment",
      "label": "Assessment",
      "kind": "text"
     },
     {
      "arg": "_category",
      "label": "Category",
      "kind": "text"
     },
     {
      "arg": "_evidence",
      "label": "Evidence",
      "kind": "list"
     },
     {
      "arg": "_executed_on",
      "label": "Executed on",
      "kind": "text"
     },
     {
      "arg": "_executor",
      "label": "Executor",
      "kind": "text"
     },
     {
      "arg": "_expected_seq",
      "label": "Expected seq",
      "kind": "int"
     },
     {
      "arg": "_note",
      "label": "Note",
      "kind": "text"
     },
     {
      "arg": "_order",
      "label": "Order",
      "kind": "text"
     },
     {
      "arg": "_requires_report",
      "label": "Requires report",
      "kind": "bool"
     },
     {
      "arg": "_result",
      "label": "Result",
      "kind": "text"
     },
     {
      "arg": "_scheduled_for",
      "label": "Scheduled for",
      "kind": "text"
     },
     {
      "arg": "_stage",
      "label": "Stage",
      "kind": "text"
     },
     {
      "arg": "_urgency",
      "label": "Urgency",
      "kind": "text"
     },
     {
      "arg": "_urgency_reason",
      "label": "Urgency reason",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_ops_service_event",
    "label": "Registrar evento da ordem de serviço",
    "rpc": "record_ops_service_event",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_amount",
      "label": "Amount",
      "kind": "int"
     },
     {
      "arg": "_doc",
      "label": "Doc",
      "kind": "text"
     },
     {
      "arg": "_engagement",
      "label": "Engagement",
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
      "arg": "_label",
      "label": "Label",
      "kind": "text"
     },
     {
      "arg": "_note",
      "label": "Note",
      "kind": "text"
     },
     {
      "arg": "_on",
      "label": "On",
      "kind": "text"
     },
     {
      "arg": "_origin",
      "label": "Origin",
      "kind": "text"
     },
     {
      "arg": "_origin_ref",
      "label": "Origin ref",
      "kind": "text"
     },
     {
      "arg": "_qty",
      "label": "Qty",
      "kind": "int"
     },
     {
      "arg": "_so",
      "label": "So",
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
    "id": "open_ops_work",
    "label": "Abrir obra",
    "rpc": "open_ops_work",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_kind",
      "label": "Kind",
      "kind": "text"
     },
     {
      "arg": "_request",
      "label": "Request",
      "kind": "text"
     },
     {
      "arg": "_school",
      "label": "School",
      "kind": "text"
     },
     {
      "arg": "_scope",
      "label": "Scope",
      "kind": "text"
     },
     {
      "arg": "_spaces",
      "label": "Spaces",
      "kind": "list"
     },
     {
      "arg": "_title",
      "label": "Title",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_ops_work_event",
    "label": "Registrar evento da obra",
    "rpc": "record_ops_work_event",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_doc",
      "label": "Doc",
      "kind": "text"
     },
     {
      "arg": "_engagement",
      "label": "Engagement",
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
      "arg": "_mkey",
      "label": "Mkey",
      "kind": "text"
     },
     {
      "arg": "_mlabel",
      "label": "Mlabel",
      "kind": "text"
     },
     {
      "arg": "_note",
      "label": "Note",
      "kind": "text"
     },
     {
      "arg": "_on",
      "label": "On",
      "kind": "text"
     },
     {
      "arg": "_registry",
      "label": "Registry",
      "kind": "text"
     },
     {
      "arg": "_w",
      "label": "W",
      "kind": "text"
     }
    ]
   }
  ]
 },
 {
  "id": "patrimonio",
  "title": "Patrimônio",
  "summary": "Bem com cadeia única; transferência, inventário e baixa só pelos processos próprios.",
  "reads": [],
  "actions": [
   {
    "id": "record_ops_asset_event",
    "label": "Registrar evento do bem",
    "rpc": "record_ops_asset_event",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_a",
      "label": "A",
      "kind": "text"
     },
     {
      "arg": "_condition",
      "label": "Condition",
      "kind": "text"
     },
     {
      "arg": "_doc",
      "label": "Doc",
      "kind": "text"
     },
     {
      "arg": "_engagement",
      "label": "Engagement",
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
      "arg": "_on",
      "label": "On",
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
      "arg": "_space",
      "label": "Space",
      "kind": "text"
     },
     {
      "arg": "_tag",
      "label": "Tag",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_ops_asset_transfer_event",
    "label": "Registrar evento de transferência",
    "rpc": "record_ops_asset_transfer_event",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_doc",
      "label": "Doc",
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
      "arg": "_on",
      "label": "On",
      "kind": "text"
     },
     {
      "arg": "_t",
      "label": "T",
      "kind": "text"
     }
    ]
   },
   {
    "id": "open_ops_asset_inventory",
    "label": "Abrir inventário",
    "rpc": "open_ops_asset_inventory",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_purpose",
      "label": "Purpose",
      "kind": "text"
     },
     {
      "arg": "_ref",
      "label": "Ref",
      "kind": "text"
     },
     {
      "arg": "_school",
      "label": "School",
      "kind": "text"
     },
     {
      "arg": "_spaces",
      "label": "Spaces",
      "kind": "list"
     }
    ]
   },
   {
    "id": "record_ops_asset_inventory_event",
    "label": "Registrar evento do inventário",
    "rpc": "record_ops_asset_inventory_event",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_action",
      "label": "Action",
      "kind": "text"
     },
     {
      "arg": "_asset",
      "label": "Asset",
      "kind": "text"
     },
     {
      "arg": "_condition",
      "label": "Condition",
      "kind": "text"
     },
     {
      "arg": "_engagement",
      "label": "Engagement",
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
      "arg": "_found_desc",
      "label": "Found desc",
      "kind": "text"
     },
     {
      "arg": "_found_space",
      "label": "Found space",
      "kind": "text"
     },
     {
      "arg": "_inv",
      "label": "Inv",
      "kind": "text"
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
      "arg": "_result",
      "label": "Result",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_ops_asset_disposal_event",
    "label": "Registrar evento da baixa",
    "rpc": "record_ops_asset_disposal_event",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_d",
      "label": "D",
      "kind": "text"
     },
     {
      "arg": "_decision",
      "label": "Decision",
      "kind": "text"
     },
     {
      "arg": "_dest_kind",
      "label": "Dest kind",
      "kind": "text"
     },
     {
      "arg": "_dest_party",
      "label": "Dest party",
      "kind": "text"
     },
     {
      "arg": "_doc",
      "label": "Doc",
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
      "arg": "_on",
      "label": "On",
      "kind": "text"
     }
    ]
   }
  ]
 },
 {
  "id": "almoxarifado",
  "title": "Almoxarifado",
  "summary": "Movimentos e requisições de material de consumo, separados do bem permanente.",
  "reads": [],
  "actions": [
   {
    "id": "record_ops_supply_movement",
    "label": "Registrar movimento",
    "rpc": "record_ops_supply_movement",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_destination",
      "label": "Destination",
      "kind": "text"
     },
     {
      "arg": "_doc",
      "label": "Doc",
      "kind": "text"
     },
     {
      "arg": "_expires",
      "label": "Expires",
      "kind": "text"
     },
     {
      "arg": "_item_key",
      "label": "Item key",
      "kind": "text"
     },
     {
      "arg": "_kind",
      "label": "Kind",
      "kind": "text"
     },
     {
      "arg": "_lot",
      "label": "Lot",
      "kind": "text"
     },
     {
      "arg": "_on",
      "label": "On",
      "kind": "text"
     },
     {
      "arg": "_qty",
      "label": "Qty",
      "kind": "int"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     },
     {
      "arg": "_reverses",
      "label": "Reverses",
      "kind": "text"
     },
     {
      "arg": "_wh",
      "label": "Wh",
      "kind": "text"
     }
    ]
   },
   {
    "id": "open_ops_supply_requisition",
    "label": "Abrir requisição",
    "rpc": "open_ops_supply_requisition",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_dest",
      "label": "Dest",
      "kind": "text"
     },
     {
      "arg": "_justification",
      "label": "Justification",
      "kind": "text"
     },
     {
      "arg": "_lines",
      "label": "Lines",
      "kind": "json"
     },
     {
      "arg": "_school",
      "label": "School",
      "kind": "text"
     },
     {
      "arg": "_supplier",
      "label": "Supplier",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_ops_supply_requisition_event",
    "label": "Registrar evento da requisição",
    "rpc": "record_ops_supply_requisition_event",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_doc",
      "label": "Doc",
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
      "arg": "_lines",
      "label": "Lines",
      "kind": "json"
     },
     {
      "arg": "_note",
      "label": "Note",
      "kind": "text"
     },
     {
      "arg": "_r",
      "label": "R",
      "kind": "text"
     }
    ]
   }
  ]
 },
 {
  "id": "transporte",
  "title": "Transporte",
  "summary": "Rotas em versões, veículos, equipe, viagens, ocorrências e custos só com comprovante.",
  "reads": [],
  "actions": [
   {
    "id": "record_ops_route_version",
    "label": "Registrar versão da rota",
    "rpc": "record_ops_route_version",
    "fields": [
     {
      "arg": "_capacity",
      "label": "Capacity",
      "kind": "int"
     },
     {
      "arg": "_capacity_source",
      "label": "Capacity source",
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
      "arg": "_itinerary",
      "label": "Itinerary",
      "kind": "json"
     },
     {
      "arg": "_reason",
      "label": "Reason",
      "kind": "text"
     },
     {
      "arg": "_route",
      "label": "Route",
      "kind": "text"
     },
     {
      "arg": "_schools",
      "label": "Schools",
      "kind": "list"
     },
     {
      "arg": "_shift",
      "label": "Shift",
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
    "id": "record_ops_vehicle_event",
    "label": "Registrar evento do veículo",
    "rpc": "record_ops_vehicle_event",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_accessible",
      "label": "Accessible",
      "kind": "int"
     },
     {
      "arg": "_available",
      "label": "Available",
      "kind": "bool"
     },
     {
      "arg": "_doc",
      "label": "Doc",
      "kind": "text"
     },
     {
      "arg": "_doc_key",
      "label": "Doc key",
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
      "arg": "_on",
      "label": "On",
      "kind": "text"
     },
     {
      "arg": "_result",
      "label": "Result",
      "kind": "text"
     },
     {
      "arg": "_seats",
      "label": "Seats",
      "kind": "int"
     },
     {
      "arg": "_service_order",
      "label": "Service order",
      "kind": "text"
     },
     {
      "arg": "_valid_until",
      "label": "Valid until",
      "kind": "text"
     },
     {
      "arg": "_vehicle",
      "label": "Vehicle",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_ops_crew_credential",
    "label": "Registrar credencial da equipe",
    "rpc": "record_ops_crew_credential",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_cred",
      "label": "Cred",
      "kind": "text"
     },
     {
      "arg": "_d",
      "label": "D",
      "kind": "text"
     },
     {
      "arg": "_doc",
      "label": "Doc",
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
    "id": "record_ops_trip_execution",
    "label": "Registrar viagem",
    "rpc": "record_ops_trip_execution",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_end",
      "label": "End",
      "kind": "text"
     },
     {
      "arg": "_km_end",
      "label": "Km end",
      "kind": "int"
     },
     {
      "arg": "_km_start",
      "label": "Km start",
      "kind": "int"
     },
     {
      "arg": "_outcome",
      "label": "Outcome",
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
      "arg": "_trip",
      "label": "Trip",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_ops_trip_measure",
    "label": "Registrar medida da viagem",
    "rpc": "record_ops_trip_measure",
    "keyArg": "_key",
    "fields": []
   },
   {
    "id": "record_ops_trip_occurrence",
    "label": "Registrar ocorrência",
    "rpc": "record_ops_trip_occurrence",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_at",
      "label": "At",
      "kind": "text"
     },
     {
      "arg": "_category",
      "label": "Category",
      "kind": "text"
     },
     {
      "arg": "_description",
      "label": "Description",
      "kind": "text"
     },
     {
      "arg": "_trip",
      "label": "Trip",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_ops_transport_measurement",
    "label": "Registrar medição",
    "rpc": "record_ops_transport_measurement",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_contract",
      "label": "Contract",
      "kind": "text"
     },
     {
      "arg": "_doc",
      "label": "Doc",
      "kind": "text"
     },
     {
      "arg": "_end",
      "label": "End",
      "kind": "text"
     },
     {
      "arg": "_start",
      "label": "Start",
      "kind": "text"
     }
    ]
   },
   {
    "id": "record_ops_transport_cost",
    "label": "Registrar custo",
    "rpc": "record_ops_transport_cost",
    "keyArg": "_key",
    "fields": [
     {
      "arg": "_cents",
      "label": "Cents",
      "kind": "int"
     },
     {
      "arg": "_m",
      "label": "M",
      "kind": "text"
     },
     {
      "arg": "_official_ref",
      "label": "Official ref",
      "kind": "text"
     },
     {
      "arg": "_receipt",
      "label": "Receipt",
      "kind": "text"
     }
    ]
   }
  ]
 }
];
