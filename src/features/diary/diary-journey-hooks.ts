import { useLocalAttendance } from "./attendance";
import { useLocalLessonRecords } from "./lesson-records";
import { useLocalInfantExperiences } from "./infant-experiences";
import { journeyAgenda, primaryAction, type JourneySources } from "./diary-journey";
import type { DiarySearch } from "./diary-data";

export function useJourneySources(): JourneySources {
  return {
    lessons: useLocalLessonRecords(),
    attendance: useLocalAttendance(),
    experiences: useLocalInfantExperiences(),
  };
}

/** Ação principal contextual derivada da agenda. */
export function usePrimaryJourneyAction(search: DiarySearch, date: string) {
  const sources = useJourneySources();
  const items = search.professor ? journeyAgenda(search.professor, date, sources, search) : [];
  return primaryAction(items);
}
