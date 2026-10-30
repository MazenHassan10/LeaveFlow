"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { buildMonthDays, groupEventsByDate, type ReportCalendarEvent } from "@/src/lib/report-calendar";
import { formatDateLabelInLosAngeles, formatTimeRange12Hour, formatWeekdayDateLabel } from "@/src/lib/app-time";
import { cn } from "@/src/lib/utils";
import { Badge } from "./ui/badge";
import { StatusBadge } from "./status-badge";
import { IconX } from "./icons";

type TypeFilter = "all" | "off" | "makeup";
const TYPE_FILTERS: Array<{ value: TypeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "off", label: "Time off" },
  { value: "makeup", label: "Make-up" },
];
// A day cell shows this many entries; the rest sit behind "+N more".
const VISIBLE_PER_DAY = 3;

function dayNumber(date: string) {
  return Number(date.slice(8, 10));
}

function roundHours(value: number) {
  return Number(value.toFixed(2));
}

function typeLabel(event: ReportCalendarEvent) {
  return event.type === "off" ? "Off" : "Make-up";
}

function describe(event: ReportCalendarEvent) {
  return `${typeLabel(event)}: ${event.employeeName}, ${formatTimeRange12Hour(event.startTime, event.endTime)} PT, ${event.hours}h`;
}

function EventBadge({ event }: { event: ReportCalendarEvent }) {
  return <Badge variant={event.type === "off" ? "destructive" : "success"}>{typeLabel(event)}</Badge>;
}

// Full details for one entry: used by the day panel and the phone list.
function EventDetail({ event }: { event: ReportCalendarEvent }) {
  return (
    <div className={`calendar-detail calendar-pin-${event.type}`}>
      <div className="calendar-detail-head">
        <EventBadge event={event} />
        <strong>{event.employeeName}</strong>
        {event.makeupStatus ? <StatusBadge value={event.makeupStatus === "Pending" ? "Not marked" : event.makeupStatus} /> : null}
      </div>
      <span>{formatTimeRange12Hour(event.startTime, event.endTime)} PT · {event.hours}h</span>
      <small>{event.requestType}{event.reason ? ` · ${event.reason}` : ""}</small>
    </div>
  );
}

type ReportCalendarProps = {
  month: string;
  today: string;
  // Already narrowed to the person picked in the month bar.
  events: ReportCalendarEvent[];
  // Short, unique display names ("Adam", "Mohamed I.") keyed by employee id.
  shortNames: Map<string, string>;
};

export function ReportCalendar({ month, today, events, shortNames }: ReportCalendarProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  const days = buildMonthDays(month);
  const visibleEvents = events.filter((event) => typeFilter === "all" || event.type === typeFilter);
  const eventsByDate = groupEventsByDate(visibleEvents);
  const eventDates = days.filter((date) => date.startsWith(month) && eventsByDate[date]?.length);
  const weeks = Array.from({ length: days.length / 7 }, (_, index) => days.slice(index * 7, index * 7 + 7));
  const selectedEvents = selectedDate ? eventsByDate[selectedDate] || [] : [];

  useEffect(() => {
    if (selectedDate) panelRef.current?.focus();
  }, [selectedDate]);

  // A new month starts with the panel closed.
  useEffect(() => setSelectedDate(null), [month]);

  function onPanelKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") setSelectedDate(null);
  }

  function weekTotals(week: string[]) {
    let off = 0;
    let makeup = 0;
    for (const date of week) {
      if (!date.startsWith(month)) continue;
      for (const event of eventsByDate[date] || []) {
        if (event.type === "off") off += event.hours;
        else makeup += event.hours;
      }
    }
    return { off: roundHours(off), makeup: roundHours(makeup) };
  }

  return (
    <section className="panel report-calendar" aria-label="Calendar">
      <div className="report-calendar-toolbar">
        <div className="segmented" role="group" aria-label="Show">
          {TYPE_FILTERS.map((filter) => (
            <button key={filter.value} type="button" className="segment" aria-pressed={typeFilter === filter.value} onClick={() => setTypeFilter(filter.value)}>
              {filter.label}
            </button>
          ))}
        </div>
        <small className="form-hint">Click a day to see everyone on it. All times are Pacific.</small>
      </div>

      <div className={cn("report-calendar-body", selectedDate && "has-panel")}>
        <div className="report-calendar-month">
          <div className="calendar-weekdays" aria-hidden="true">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => <span key={label}>{label}</span>)}
          </div>
          <div className="calendar-grid">
            {weeks.flatMap((week) => {
              const totals = weekTotals(week);
              return [
                ...week.map((date) => {
                  const dayEvents = eventsByDate[date] || [];
                  const hidden = dayEvents.length - VISIBLE_PER_DAY;
                  const shown = hidden > 0 ? dayEvents.slice(0, VISIBLE_PER_DAY - 1) : dayEvents;
                  const open = () => setSelectedDate(date);
                  return (
                    <div
                      className={cn(
                        "calendar-day",
                        !date.startsWith(month) && "is-muted",
                        date === today && "is-today",
                        date === selectedDate && "is-selected"
                      )}
                      key={date}
                    >
                      <button
                        type="button"
                        className="calendar-day-number"
                        onClick={open}
                        aria-label={`${formatWeekdayDateLabel(date)}: ${dayEvents.length ? `${dayEvents.length} entr${dayEvents.length === 1 ? "y" : "ies"}` : "nothing scheduled"}`}
                      >
                        {dayNumber(date)}
                      </button>
                      <div className="calendar-events">
                        {shown.map((event) => (
                          <button
                            type="button"
                            className={`calendar-pin calendar-pin-${event.type}`}
                            key={event.id}
                            title={describe(event)}
                            aria-label={describe(event)}
                            onClick={open}
                          >
                            <EventBadge event={event} />
                            <span>{shortNames.get(event.employeeId) ?? event.employeeName} · {event.hours}h</span>
                          </button>
                        ))}
                        {hidden > 0 ? (
                          <button type="button" className="calendar-more" onClick={open}>
                            +{hidden + 1} more
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                }),
                totals.off || totals.makeup ? (
                  <div className="calendar-week-total" key={`total-${week[0]}`}>
                    {totals.off ? <span>Off {totals.off}h</span> : null}
                    {totals.makeup ? <span>Make-up {totals.makeup}h</span> : null}
                  </div>
                ) : null,
              ];
            })}
          </div>
        </div>

        {selectedDate ? (
          <aside className="calendar-day-panel" ref={panelRef} tabIndex={-1} onKeyDown={onPanelKeyDown} aria-label={`Entries on ${formatWeekdayDateLabel(selectedDate)}`}>
            <div className="calendar-day-panel-head">
              <div>
                <strong>{formatWeekdayDateLabel(selectedDate)}</strong>
                <small>{selectedEvents.length ? `${selectedEvents.length} entr${selectedEvents.length === 1 ? "y" : "ies"}` : "Nothing scheduled"}</small>
              </div>
              <button type="button" className="btn-ghost compact icon-only" aria-label="Close day details" onClick={() => setSelectedDate(null)}>
                <IconX />
              </button>
            </div>
            {selectedEvents.map((event) => <EventDetail key={event.id} event={event} />)}
          </aside>
        ) : null}
      </div>

      {/* Phones: a day-by-day list with full details instead of the grid. */}
      <div className="calendar-mobile-list">
        {eventDates.length ? eventDates.map((date) => (
          <div className="calendar-mobile-day" key={date}>
            <strong>{formatDateLabelInLosAngeles(date)}</strong>
            {(eventsByDate[date] || []).map((event) => <EventDetail key={event.id} event={event} />)}
          </div>
        )) : <p className="empty">Nothing approved {typeFilter === "makeup" ? "for make-up " : typeFilter === "off" ? "as time off " : ""}this month.</p>}
      </div>
    </section>
  );
}
