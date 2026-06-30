"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { submitTimeOffRequest, type SubmitRequestState } from "@/app/actions";
import { SHIFT_PRESETS, shiftPresetFor, type ShiftPresetValue } from "@/src/lib/shift-presets";
import { IconPlus, IconX } from "./icons";

type MakeupRow = {
  id: number;
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

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? <span className="spinner" aria-hidden="true" /> : null}
      {pending ? "Submitting..." : "Submit request"}
    </button>
  );
}

export function RequestForm() {
  const [timeOff, setTimeOff] = useState<TimeSelection>({ preset: "custom", startTime: "", endTime: "" });
  const [makeupRows, setMakeupRows] = useState<MakeupRow[]>([{ id: 1, preset: "custom", startTime: "", endTime: "" }]);
  const [state, formAction] = useActionState(submitTimeOffRequest, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const previousRowCount = useRef(makeupRows.length);

  function addMakeupRow() {
    setMakeupRows((rows) => [
      ...rows,
      { id: Math.max(...rows.map((row) => row.id)) + 1, preset: "custom", startTime: "", endTime: "" }
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
        <select name="requestType">
          <option>PTO</option>
          <option>Additional Time Off</option>
          <option>Emergency/Exception</option>
        </select>
      </label>
      <label>
        Reason
        <textarea name="reason" placeholder="Brief written request" />
      </label>
      <h3>Time off</h3>
      <div className="field-grid shift-grid">
        <label>Date <input name="segmentDate" type="date" required /></label>
        <label>
          Shift
          <select
            value={timeOff.preset}
            onChange={(event) => applyTimeOffPreset(event.target.value as ShiftPresetValue)}
          >
            {SHIFT_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}{preset.hours ? ` (${preset.hours}h)` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input
            name="segmentStart"
            type="time"
            required
            readOnly={timeOff.preset !== "custom"}
            value={timeOff.startTime}
            onChange={(event) => setTimeOff((current) => ({ ...current, startTime: event.target.value }))}
          />
        </label>
        <label>
          To
          <input
            name="segmentEnd"
            type="time"
            required
            readOnly={timeOff.preset !== "custom"}
            value={timeOff.endTime}
            onChange={(event) => setTimeOff((current) => ({ ...current, endTime: event.target.value }))}
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
              <label>Date <input name="makeupDate" type="date" /></label>
              <label>
                Shift
                <select
                  value={row.preset}
                  onChange={(event) => applyMakeupPreset(row.id, event.target.value as ShiftPresetValue)}
                >
                  {SHIFT_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}{preset.hours ? ` (${preset.hours}h)` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                From
                <input
                  name="makeupStart"
                  type="time"
                  readOnly={row.preset !== "custom"}
                  value={row.startTime}
                  onChange={(event) => setMakeupRows((rows) => rows.map((item) => item.id === row.id
                    ? { ...item, startTime: event.target.value }
                    : item
                  ))}
                />
              </label>
              <label>
                To
                <input
                  name="makeupEnd"
                  type="time"
                  readOnly={row.preset !== "custom"}
                  value={row.endTime}
                  onChange={(event) => setMakeupRows((rows) => rows.map((item) => item.id === row.id
                    ? { ...item, endTime: event.target.value }
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
      <SubmitButton />
    </form>
  );
}
