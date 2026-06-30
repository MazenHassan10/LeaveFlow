"use client";

type TimeSelectProps = {
  name: string;
  value: string;
  required?: boolean;
  disabled?: boolean;
  range?: "shift" | "full-day";
  onChange: (value: string) => void;
};

function buildTimeOptions(startMinutes: number, endMinutes: number) {
  const stepCount = Math.floor((endMinutes - startMinutes) / 15) + 1;

  return Array.from({ length: stepCount }, (_, index) => {
    const totalMinutes = startMinutes + index * 15;
    const hour24 = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const value = `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const period = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 || 12;
    const label = `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
    return { value, label };
  });
}

const shiftTimeOptions = buildTimeOptions(9 * 60, 17 * 60);
const fullDayTimeOptions = buildTimeOptions(0, 23 * 60 + 45);

export function TimeSelect({ name, value, required, disabled, range = "shift", onChange }: TimeSelectProps) {
  const timeOptions = range === "full-day" ? fullDayTimeOptions : shiftTimeOptions;
  const selectedValue = timeOptions.some((option) => option.value === value) ? value : "";

  return (
    <div className="time-select">
      <input name={name} type="hidden" value={value} required={required} />
      <select
        aria-label={name}
        disabled={disabled}
        value={selectedValue}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select time</option>
        {timeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}
