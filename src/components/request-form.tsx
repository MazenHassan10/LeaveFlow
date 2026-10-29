"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { adminUpdateRequestAction, submitTimeOffRequest, updateTimeOffRequest, type SubmitRequestState } from "@/app/actions";
import type { TimeOffRequest } from "@/src/lib/app-data";
import { formatPacificRangeIn } from "@/src/lib/app-time";
import { calculateHours } from "@/src/lib/pto";
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

function presetForTimes(startTime: string, endTime: string): ShiftPresetValue {
  return SHIFT_PRESETS.find((preset) => preset.value !== "custom" && preset.startTime === startTime && preset.endTime === endTime)?.value ?? "custom";
}

function initialMakeupRows(request?: TimeOffRequest | null): MakeupRow[] {
  if (!request?.makeupEntries.length) return [{ id: 1, date: "", preset: "custom", startTime: "", endTime: "" }];
  return request.makeupEntries.map((entry, index) => ({
    id: index + 1,
    date: entry.date,
    preset: presetForTimes(entry.startTime, entry.endTime),
    startTime: entry.startTime,
    endTime: entry.endTime
  }));
}

function roundHours(value: number) {
  return Number(value.toFixed(2));
}

function CairoHint({ date, startTime, endTime }: { date: string; startTime: string; endTime: string }) {
  const range = formatPacificRangeIn(date, startTime, endTime);
  if (!range) return null;
  return <p className="form-hint tz-hint">= {range}</p>;
}

type RequestFormProps = {
  // Remaining PTO for the current year, used to warn before submitting.
  ptoRemaining: number;
  // When set, the form edits this pending request instead of creating a new one.
  editRequest?: TimeOffRequest | null;
  // "admin": an Admin or Manager fixing someone's pending or approved request from the dashboard.
  mode?: "employee" | "admin";
  onCancel?: () => void;
  onDone?: (message: string) => void;
};

// Adapts the admin action's { done | error } result to this form's state shape.
async function adminSave(_previousState: SubmitRequestState, formData: FormData): Promise<SubmitRequestState> {
  const result = await adminUpdateRequestAction({ status: "idle", message: "" }, formData);
  return result.status === "done" ? { status: "updated", message: result.message } : { status: "error", message: result.message };
}

export function RequestForm({ ptoRemaining, editRequest, mode = "employee", onCancel, onDone }: RequestFormProps) {
  const isAdmin = mode === "admin" && Boolean(editRequest);
  const router = useRouter();
  const editSegment = editRequest?.segments[0];
  const [requestType, setRequestType] = useState<string>(editRequest?.requestType ?? "PTO");
  const [segmentDate, setSegmentDate] = useState(editSegment?.date ?? "");
  const [timeOff, setTimeOff] = useState<TimeSelection>(editSegment
    ? { preset: presetForTimes(editSegment.startTime, editSegment.endTime), startTime: editSegment.startTime, endTime: editSegment.endTime }
    : { preset: "custom", startTime: "", endTime: "" });
  const [makeupRows, setMakeupRows] = useState<MakeupRow[]>(() => initialMakeupRows(editRequest));
  const [state, formAction] = useActionState(isAdmin ? adminSave : editRequest ? updateTimeOffRequest : submitTimeOffRequest, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const previousRowCount = useRef(makeupRows.length);

  const requestedHours = calculateHours(timeOff.startTime, timeOff.endTime);
  const makeupHours = roundHours(makeupRows.reduce((total, row) => total + calculateHours(row.startTime, row.endTime), 0));
  const needsMakeup = requestType !== "PTO";
  const makeupCovered = makeupHours >= requestedHours && makeupHours > 0;
  const exceedsPto = requestType === "PTO" && requestedHours > ptoRemaining;

  useEffect(() => {
    if (state.status !== "updated") return;
    if (isAdmin) {
      router.refresh();
      onDone?.(state.message);
    } else {
      router.replace("/employee?updated=1");
    }
    // onDone is intentionally not a dependency: it should run once per result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, router, isAdmin]);

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
    <form action={formAction} className={isAdmin ? "admin-edit-form" : "panel form-panel"} ref={formRef} id={isAdmin ? undefined : "request-form"}>
      <div className="split">
        {isAdmin ? <h3>Edit request</h3> : <h2>{editRequest ? "Edit request" : "New request"}</h2>}
        {isAdmin
          ? <button type="button" className="btn-ghost compact" onClick={onCancel}>Cancel</button>
          : editRequest ? <Link className="btn-ghost compact" href="/employee">Cancel editing</Link> : null}
      </div>
      {editRequest ? <input type="hidden" name="requestId" value={editRequest.id} /> : null}
      <p className="form-hint">
        All times are <strong>Pacific Time (PT)</strong>. The Cairo time is shown under each entry so you can double-check.
      </p>
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
        <textarea name="reason" placeholder="Brief written request" defaultValue={editRequest?.reason ?? ""} />
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
      <CairoHint date={segmentDate} startTime={timeOff.startTime} endTime={timeOff.endTime} />
      {requestType === "PTO" ? (
        <p className={`notice ${exceedsPto ? "warning" : "info"}`} role={exceedsPto ? "alert" : undefined}>
          {exceedsPto
            ? `This needs ${requestedHours}h of PTO but ${isAdmin ? "they" : "you"} only have ${ptoRemaining}h left. It will be refused.`
            : `${isAdmin ? "They have" : "You have"} ${ptoRemaining}h of PTO left this year${isAdmin && editRequest?.status === "Approved" && editRequest.requestType === "PTO" ? ", counting this request's own hours" : ""}.`}
        </p>
      ) : null}
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
              <CairoHint date={row.date} startTime={row.startTime} endTime={row.endTime} />
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
      {needsMakeup && requestedHours > 0 ? (
        <p className={`notice ${makeupCovered ? "success" : "warning"}`} aria-live="polite">
          Make-up planned: <strong>{makeupHours}h</strong> of <strong>{requestedHours}h</strong> needed
          {makeupCovered ? " ✓" : ` (add ${roundHours(requestedHours - makeupHours)}h more)`}
        </p>
      ) : null}
      {isAdmin ? (
        <label>
          Note for the email (optional)
          <textarea name="note" maxLength={500} rows={2} placeholder="Fixed the date to match what we agreed on the phone." />
        </label>
      ) : null}
      <PendingSubmitButton pendingLabel={editRequest ? "Saving..." : "Submitting..."}>
        {editRequest ? "Save changes" : "Submit request"}
      </PendingSubmitButton>
    </form>
  );
}
