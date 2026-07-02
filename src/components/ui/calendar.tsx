"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/src/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("leaveflow-calendar", className)}
      classNames={{
        root: "leaveflow-calendar-root",
        month_caption: "leaveflow-calendar-caption",
        caption_label: "leaveflow-calendar-caption-label",
        nav: "leaveflow-calendar-nav",
        button_previous: "leaveflow-calendar-nav-button",
        button_next: "leaveflow-calendar-nav-button",
        weekdays: "leaveflow-calendar-weekdays",
        weekday: "leaveflow-calendar-weekday",
        month_grid: "leaveflow-calendar-grid",
        week: "leaveflow-calendar-week",
        day: "leaveflow-calendar-day",
        day_button: "leaveflow-calendar-day-button",
        outside: "leaveflow-calendar-day-outside",
        today: "leaveflow-calendar-day-today",
        selected: "leaveflow-calendar-day-selected",
        disabled: "leaveflow-calendar-day-disabled",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => (
          orientation === "left"
            ? <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            : <ChevronRight className="h-4 w-4" aria-hidden="true" />
        ),
      }}
      {...props}
    />
  );
}
