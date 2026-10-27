import type { ReportCalendarEvent } from "@/src/lib/report-calendar";
import { formatPacificRangeIn, formatTimeRange12Hour, formatWeekdayDateLabel } from "@/src/lib/app-time";
import { UPCOMING_WINDOW_DAYS } from "@/src/lib/employee-schedule";
import { Badge } from "./ui/badge";

export function UpcomingSchedule({ events }: { events: ReportCalendarEvent[] }) {
  return (
    <section className="upcoming-schedule" aria-label="Upcoming schedule">
      <h2>Upcoming</h2>
      {events.length ? (
        <ul className="schedule-list">
          {events.map((event) => {
            const cairo = formatPacificRangeIn(event.date, event.startTime, event.endTime);
            return (
              <li className="schedule-row" key={event.id}>
                <div>
                  <strong>{formatWeekdayDateLabel(event.date)}</strong>
                  <span>{formatTimeRange12Hour(event.startTime, event.endTime)} PT · {event.hours}h</span>
                  {cairo ? <small>{cairo}</small> : null}
                </div>
                <Badge variant={event.type === "off" ? "violet" : "success"}>
                  {event.type === "off" ? "Day off" : "Make-up"}
                </Badge>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty">Nothing approved in the next {UPCOMING_WINDOW_DAYS} days.</p>
      )}
    </section>
  );
}
