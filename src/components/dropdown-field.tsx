"use client";

import { Check, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/src/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export type DropdownFieldOption = {
  value: string;
  label: string;
};

type DropdownFieldProps = {
  name?: string;
  value: string;
  options: DropdownFieldOption[];
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  onChange: (value: string) => void;
};

export function DropdownField({
  name,
  value,
  options,
  placeholder,
  required,
  disabled,
  ariaLabel,
  onChange,
}: DropdownFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => options.find((option) => option.value === value), [options, value]);

  return (
    <Popover modal={false} open={open} onOpenChange={(nextOpen) => setOpen(disabled ? false : nextOpen)}>
      {name ? <input name={name} type="hidden" value={value} required={required} /> : null}
      <PopoverTrigger
        aria-label={ariaLabel}
        className={cn("select-trigger", !selected && "is-placeholder")}
        disabled={disabled}
        type="button"
      >
        <span>{selected?.label || placeholder}</span>
        <ChevronDown aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="dropdown-field-content">
        <div className="dropdown-field-options" role="listbox" aria-label={ariaLabel || placeholder}>
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                aria-selected={isSelected}
                className="dropdown-field-option"
                key={option.value}
                role="option"
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="dropdown-field-check">
                  {isSelected ? <Check aria-hidden="true" /> : null}
                </span>
                <span>{option.label}</span>
                <span aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
