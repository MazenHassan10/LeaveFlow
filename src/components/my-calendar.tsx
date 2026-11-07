import Link from "next/link";
import type { AppSnapshot, UserProfile } from "@/src/lib/app-data";
import { losAngelesDate } from "@/src/lib/app-time";
import { addMonths, buildReportCalendarEvents, monthLabel } from "@/src/lib/report-calendar";
import { IconChevronLeft } from "./icons";
import { PageHeader } from "./page-header";
import { ReportCalendar } from "./report-calendar";

function monthHref(month: string) {
  return `/employee/calendar?month=${month}`;
}

// One employee's approved days off and make-up shifts, a month at a time.
export function MyCalendar({ profile, snapshot, month }: { profile: UserProfile; snapshot: AppSnapshot; month: string }) {
  const today = losAngelesDate();
  const thisMonth = today.slice(0, 7);
  // The employee snapshot only holds this person's requests; the filter keeps it that way if that ever changes.
  const events = buildReportCalendarEvents(snapshot).filter((event) => event.employeeId === profile.id);
  const monthEvents = events.filter((event) => event.date.startsWith(month));
  const offHours = Number(monthEvents.filter((event) => event.type === "off").reduce((sum, event) => sum + event.hours, 0).toFixed(2));
  const makeupHours = Number(monthEvents.filter((event) => event.type === "makeup").reduce((sum, event) => sum + event.hours, 0).toFixed(2));

  return (
    <section id="my-calendar" className="page-section my-calendar">
      <PageHeader eyebrow="Employee portal" title="My calendar" />
      <div className="report-month-bar" role="group" aria-label="Calendar month">
        <div className="report-month-nav">
          <Link className="btn-ghost compact icon-only month-step" href={monthHref(addMonths(month, -1))} aria-label={`Previous month, ${monthLabel(addMonths(month, -1))}`}>
            <IconChevronLeft />
          </Link>
          <h2 className="report-month-title">{monthLabel(month)}</h2>
          <Link className="btn-ghost compact icon-only month-step is-next" href={monthHref(addMonths(month, 1))} aria-label={`Next month, ${monthLabel(addMonths(month, 1))}`}>
            <IconChevronLeft />
          </Link>
          {month !== thisMonth ? <Link className="btn-ghost compact" href={monthHref(thisMonth)}>This month</Link> : null}
        </div>
        <p className="my-calendar-totals">
          <span>Off <strong>{offHours}h</strong></span>
          <span>Make-up <strong>{makeupHours}h</strong></span>
        </p>
      </div>
      <ReportCalendar month={month} today={today} events={events} personal />
    </section>
  );
}
