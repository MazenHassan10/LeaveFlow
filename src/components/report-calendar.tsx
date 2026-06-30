import Link from "next/link";
import type { AppSnapshot } from "@/src/lib/app-data";
import {
  addMonths,
  buildMonthDays,
  buildReportCalendarEvents,
  groupEventsByDate,
  monthLabel,
  parseMonthParam
} from "@/src/lib/report-calendar";
import { Badge } from "./ui/badge";
import { buttonVariants } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "@/src/lib/utils";
import { formatDateLabelInLosAngeles } from "@/src/lib/app-time";

function dayNumber(date: string) {
  return Number(date.slice(8, 10));
}

function sameMonth(date: string, month: string) {
  return date.startsWith(month);
}

function weekdayLabel(index: number) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][index];
}

export function ReportCalendar({ snapshot, month }: { snapshot: AppSnapshot; month?: string }) {
  const currentMonth = parseMonthParam(month);
  const days = buildMonthDays(currentMonth);
  const eventsByDate = groupEventsByDate(buildReportCalendarEvents(snapshot));
  const eventDates = days.filter((date) => sameMonth(date, currentMonth) && eventsByDate[date]?.length);

  return (
    <Card className="report-calendar">
      <CardHeader className="report-calendar-header">
        <div>
          <p className="eyebrow">Calendar</p>
          <CardTitle>{monthLabel(currentMonth)}</CardTitle>
        </div>
        <div className="calendar-actions">
          <Link
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "calendar-link-button")}
            href={`/reports?month=${addMonths(currentMonth, -1)}`}
          >
            Previous
          </Link>
          <Link
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "calendar-link-button")}
            href={`/reports?month=${addMonths(currentMonth, 1)}`}
          >
            Next
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="calendar-weekdays" aria-hidden="true">
          {Array.from({ length: 7 }, (_, index) => <span key={index}>{weekdayLabel(index)}</span>)}
        </div>
        <div className="calendar-grid">
          {days.map((date) => {
            const events = eventsByDate[date] || [];
            return (
              <div className={`calendar-day ${sameMonth(date, currentMonth) ? "" : "is-muted"}`} key={date}>
                <div className="calendar-day-number">{dayNumber(date)}</div>
                <div className="calendar-events">
                  {events.map((event) => (
                    <div className={`calendar-pin calendar-pin-${event.type}`} key={event.id}>
                      <Badge variant={event.type === "off" ? "destructive" : "success"}>
                        {event.type === "off" ? "Off" : "Make-up"}
                      </Badge>
                      <span title={event.employeeEmail}>{event.employeeName}</span>
                      <small>{event.startTime}-{event.endTime} · {event.hours}h</small>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="calendar-mobile-list">
          {eventDates.length ? eventDates.map((date) => (
            <div className="calendar-mobile-day" key={date}>
              <strong>{formatDateLabelInLosAngeles(date)}</strong>
              {(eventsByDate[date] || []).map((event) => (
                <div className={`calendar-pin calendar-pin-${event.type}`} key={event.id}>
                  <Badge variant={event.type === "off" ? "destructive" : "success"}>
                    {event.type === "off" ? "Off" : "Make-up"}
                  </Badge>
                  <span>{event.employeeName}</span>
                  <small>{event.startTime}-{event.endTime} · {event.hours}h</small>
                </div>
              ))}
            </div>
          )) : <p className="empty">No approved PTO or make-up plans this month.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
