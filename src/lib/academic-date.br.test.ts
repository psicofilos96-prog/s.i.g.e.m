import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  compareAcademicDates,
  formatAcademicDate,
  formatDateRange,
  formatDateTime,
  formatDayMonth,
  formatLongDate,
  formatMonthYear,
  parseBrazilianDate,
} from "./academic-date";

describe("padrão brasileiro de datas", () => {
  it("formata DD/MM/AAAA, DD/MM, MM/AAAA e por extenso", () => {
    expect(formatAcademicDate("2027-02-04")).toBe("04/02/2027");
    expect(formatAcademicDate("2027-12-17")).toBe("17/12/2027");
    expect(formatDayMonth("2027-02-04")).toBe("04/02");
    expect(formatMonthYear("2027-02-04")).toBe("02/2027");
    expect(formatMonthYear("2027-02")).toBe("02/2027");
    expect(formatLongDate("2027-02-04")).toBe("4 de fevereiro de 2027");
  });
  it("data + hora sem deslocamento de fuso", () => {
    expect(formatDateTime("2027-02-04T08:30")).toBe("04/02/2027 08:30");
    expect(formatDateTime("2027-02-04T11:30:00Z")).toBe("04/02/2027 08:30");
    expect(formatDateTime("2027-02-04T08:30", { textual: true })).toBe("04/02/2027 às 08:30");
  });
  it("intervalos", () => {
    expect(formatDateRange("2027-02-04", "2027-05-21")).toBe("04/02/2027 a 21/05/2027");
    expect(formatDateRange("2027-02-04", "2027-05-21", { compact: true })).toBe(
      "04/02 a 21/05/2027",
    );
  });
  it("entrada DD/MM/AAAA → ISO, com bissexto e inválidas", () => {
    expect(parseBrazilianDate("04/02/2027")).toBe("2027-02-04");
    expect(parseBrazilianDate("29/02/2028")).toBe("2028-02-29");
    expect(parseBrazilianDate("29/02/2027")).toBeNull();
    expect(parseBrazilianDate("31/04/2027")).toBeNull();
    expect(parseBrazilianDate("2027-02-04")).toBeNull();
    expect(formatAcademicDate("2027-01-31")).toBe("31/01/2027");
    expect(formatAcademicDate("2026-12-31")).toBe("31/12/2026");
  });
  it("ordenação usa o valor canônico, não o texto", () => {
    const sorted = ["2027-02-01", "2027-01-31"].sort(compareAcademicDates);
    expect(sorted.map((d) => formatAcademicDate(d))).toEqual(["31/01/2027", "01/02/2027"]);
  });
});

describe("saneamento: telas não exibem ISO nem campos de data nativos", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".tsx") && !p.includes(".test.")) files.push(p);
    }
  };
  walk("src/features");
  walk("src/routes");
  it("nenhum texto JSX com data ISO literal", () => {
    const bad = files.filter((f) => />\s*\d{4}-\d{2}-\d{2}\s*</.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
  it('campos de data usam DateInput (sem type="date" direto)', () => {
    const bad = files.filter((f) => /<[Ii]nput\b[^/]*?type="date"/.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });
});
