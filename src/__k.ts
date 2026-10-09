import { buildImportPlan, referenceCalendars2027 } from "@/features/calendar/calendar-browser-import";
console.log(JSON.stringify(buildImportPlan(referenceCalendars2027()[0]!).presentation["dayTypeCatalog"]));
