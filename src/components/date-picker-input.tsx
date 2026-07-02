"use client";

import { CalendarIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDateLabelInLosAngeles } from "@/src/lib/app-time";
import { cn } from "@/src/lib/utils";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

type DatePickerInputProps = {
  name: string;
  value: string;
  required?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
};

function parseDate(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DatePickerInput({
  name,
  value,
  required,
  placeholder = "Choose date",
  onChange,
}: DatePickerInputProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseDate(value), [value]);
  const label = value ? formatDateLabelInLosAngeles(value) : placeholder;

  return (
    <Popover modal={false} open={open} onOpenChange={setOpen}>
      <input name={name} type="hidden" value={value} required={required} />
      <PopoverTrigger
        type="button"
        className={cn("date-picker-trigger", !value && "is-placeholder")}
      >
        <span>{label}</span>
        <CalendarIcon aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="date-picker-popover">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (!date) return;
            onChange(formatDateValue(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
