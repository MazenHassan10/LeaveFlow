export const REPORT_VIEWS = ["calendar", "people", "makeup", "activity"] as const;
export type ReportView = (typeof REPORT_VIEWS)[number];

export function parseReportView(value: string | undefined): ReportView {
  return REPORT_VIEWS.includes(value as ReportView) ? (value as ReportView) : "calendar";
}
