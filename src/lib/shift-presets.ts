export const SHIFT_PRESETS = [
  { value: "custom", label: "Custom", startTime: "", endTime: "", hours: 0 },
  { value: "full-day", label: "Full day", startTime: "09:00", endTime: "17:00", hours: 8 },
  { value: "first-half", label: "First half", startTime: "09:00", endTime: "13:00", hours: 4 },
  { value: "second-half", label: "Second half", startTime: "13:00", endTime: "17:00", hours: 4 },
  { value: "first-two", label: "First two hours", startTime: "09:00", endTime: "11:00", hours: 2 },
  { value: "second-two", label: "Second two hours", startTime: "11:00", endTime: "13:00", hours: 2 },
  { value: "third-two", label: "Third two hours", startTime: "13:00", endTime: "15:00", hours: 2 },
  { value: "fourth-two", label: "Fourth two hours", startTime: "15:00", endTime: "17:00", hours: 2 },
] as const;

export type ShiftPresetValue = typeof SHIFT_PRESETS[number]["value"];

export function shiftPresetFor(value: string) {
  return SHIFT_PRESETS.find((preset) => preset.value === value) || SHIFT_PRESETS[0];
}
