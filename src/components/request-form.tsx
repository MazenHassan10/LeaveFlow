"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { submitTimeOffRequest, type SubmitRequestState } from "@/app/actions";
import { SHIFT_PRESETS, shiftPresetFor, type ShiftPresetValue } from "@/src/lib/shift-presets";
import { DatePickerInput } from "./date-picker-input";
import { DropdownField } from "./dropdown-field";
import { IconPlus, IconX } from "./icons";
import { PendingSubmitButton } from "./pending-submit-button";
import { TimeSelect } from "./time-select";

type MakeupRow = {
  id: number;
  date: string;
  preset: ShiftPresetValue;
  startTime: string;
  endTime: string;
};

type TimeSelection = {
  preset: ShiftPresetValue;
  startTime: string;
  endTime: string;
};

const initialState: SubmitRequestState = {
  status: "idle",
  message: ""
};

const requestTypeOptions = [
  { value: "PTO", label: "PTO" },
  { value: "Additional Time Off", label: "Additional Time Off" },
  { value: "Emergency/Exception", label: "Emergency/Exception" },
];

const shiftPresetOptions = SHIFT_PRESETS.map((preset) => ({
  value: preset.value,
  label: `${preset.label}${preset.hours ? ` (${preset.hours}h)` : ""}`,
}));

export function RequestForm() {
  const [requestType, setRequestType] = useState("PTO");
  const [segmentDate, setSegmentDate] = useState("");
  const [timeOff, setTimeOff] = useState<TimeSelection>({ preset: "custom", startTime: "", endTime: "" });
  const [makeupRows, setMakeupRows] = useState<MakeupRow[]>([{ id: 1, date: "", preset: "custom", startTime: "", endTime: "" }]);
  const [state, formAction] = useActionState(submitTimeOffRequest, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const previousRowCount = useRef(makeupRows.length);

  function addMakeupRow() {
    setMakeupRows((rows) => [
      ...rows,
      { id: Math.max(...rows.map((row) => row.id)) + 1, date: "", preset: "custom", startTime: "", endTime: "" }
    ]);
  }

  function removeMakeupRow(id: number) {
    setMakeupRows((rows) => rows.filter((row) => row.id !== id));
  }

  function applyTimeOffPreset(value: ShiftPresetValue) {
    const preset = shiftPresetFor(value);
    setTimeOff({ preset: preset.value, startTime: preset.startTime, endTime: preset.endTime });
  }

  function applyMakeupPreset(id: number, value: ShiftPresetValue) {
    const preset = shiftPresetFor(value);
    setMakeupRows((rows) => rows.map((row) => row.id === id
      ? { ...row, preset: preset.value, startTime: preset.startTime, endTime: preset.endTime }
      : row
    ));
  }

  useEffect(() => {
    if (makeupRows.length <= previousRowCount.current) {
      previousRowCount.current = makeupRows.length;
      return;
    }

    let cleanup: (() => void) | undefined;
    let active = true;

    import("gsap").then(({ default: gsap }) => {
      if (!active || !formRef.current) return;

      const context = gsap.context(() => {
        const mm = gsap.matchMedia();

        mm.add("(prefers-reduced-motion: no-preference)", () => {
          gsap.from(".makeup-plan-row:last-child", {
            autoAlpha: 0,
            y: -10,
            scale: 0.98,
            duration: 0.28,
            ease: "power2.out",
          });
        });
      }, formRef);

      cleanup = () => context.revert();
    });

    previousRowCount.current = makeupRows.length;
    return () => {
      active = false;
      cleanup?.();
    };
  }, [makeupRows.length]);

  return (
    <form action={formAction} className="panel form-panel" ref={formRef}>
      <h2>New request</h2>
      {state.status !== "idle" ? (
        <p className={`notice ${state.status === "error" ? "warning" : "success"}`}>{state.message}</p>
      ) : null}
      <label>
        Request type
        <DropdownField
          name="requestType"
          value={requestType}
          options={requestTypeOptions}
          placeholder="Choose request type"
          onChange={setRequestType}
        />
      </label>
      <label>
        Reason
        <textarea name="reason" placeholder="Brief written request" />
      </label>
      <h3>Time off</h3>
      <div className="field-grid shift-grid">
        <label>
          Date
          <DatePickerInput name="segmentDate" required value={segmentDate} onChange={setSegmentDate} />
        </label>
        <label>
          Shift
          <DropdownField
            value={timeOff.preset}
            options={shiftPresetOptions}
            placeholder="Choose shift"
            onChange={(value) => applyTimeOffPreset(value as ShiftPresetValue)}
          />
        </label>
        <label>
          From
          <TimeSelect
            name="segmentStart"
            required
            disabled={timeOff.preset !== "custom"}
            value={timeOff.startTime}
            onChange={(value) => setTimeOff((current) => ({ ...current, startTime: value }))}
          />
        </label>
        <label>
          To
          <TimeSelect
            name="segmentEnd"
            required
            disabled={timeOff.preset !== "custom"}
            value={timeOff.endTime}
            onChange={(value) => setTimeOff((current) => ({ ...current, endTime: value }))}
          />
        </label>
      </div>
      <div className="split">
        <h3>Make-up plan</h3>
        <button className="btn-ghost compact" type="button" onClick={addMakeupRow}>
          <IconPlus />
          Add row
        </button>
      </div>
      <div className="makeup-plan-rows">
        {makeupRows.map((row) => (
          <div className="makeup-plan-row" key={row.id}>
            <div className="field-grid shift-grid">
              <label>
                Date
                <DatePickerInput
                  name="makeupDate"
                  value={row.date}
                  onChange={(value) => setMakeupRows((rows) => rows.map((item) => item.id === row.id
                    ? { ...item, date: value }
                    : item
                  ))}
                />
              </label>
              <label>
                Shift
                <DropdownField
                  value={row.preset}
                  options={shiftPresetOptions}
                  placeholder="Choose shift"
                  onChange={(value) => applyMakeupPreset(row.id, value as ShiftPresetValue)}
                />
              </label>
              <label>
                From
                <TimeSelect
                  name="makeupStart"
                  range="full-day"
                  disabled={row.preset !== "custom"}
                  value={row.startTime}
                  onChange={(value) => setMakeupRows((rows) => rows.map((item) => item.id === row.id
                    ? { ...item, startTime: value }
                    : item
                  ))}
                />
              </label>
              <label>
                To
                <TimeSelect
                  name="makeupEnd"
                  range="full-day"
                  disabled={row.preset !== "custom"}
                  value={row.endTime}
                  onChange={(value) => setMakeupRows((rows) => rows.map((item) => item.id === row.id
                    ? { ...item, endTime: value }
                    : item
                  ))}
                />
              </label>
            </div>
            {makeupRows.length > 1 ? (
              <button
                aria-label="Remove make-up row"
                className="btn-ghost compact icon-only"
                type="button"
                onClick={() => removeMakeupRow(row.id)}
              >
                <IconX />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <PendingSubmitButton pendingLabel="Submitting...">Submit request</PendingSubmitButton>
    </form>
  );
}
