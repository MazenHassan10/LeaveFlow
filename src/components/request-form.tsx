"use client";

import { useState } from "react";
import { submitTimeOffRequest } from "@/app/actions";
import { IconPlus, IconX } from "./icons";

type MakeupRow = {
  id: number;
};

export function RequestForm() {
  const [makeupRows, setMakeupRows] = useState<MakeupRow[]>([{ id: 1 }]);

  function addMakeupRow() {
    setMakeupRows((rows) => [...rows, { id: Math.max(...rows.map((row) => row.id)) + 1 }]);
  }

  function removeMakeupRow(id: number) {
    setMakeupRows((rows) => rows.filter((row) => row.id !== id));
  }

  return (
    <form action={submitTimeOffRequest} className="panel form-panel">
      <h2>New request</h2>
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
      <div className="field-grid">
        <label>Date <input name="segmentDate" type="date" required /></label>
        <label>From <input name="segmentStart" type="time" required /></label>
        <label>To <input name="segmentEnd" type="time" required /></label>
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
            <div className="field-grid">
              <label>Date <input name="makeupDate" type="date" /></label>
              <label>From <input name="makeupStart" type="time" /></label>
              <label>To <input name="makeupEnd" type="time" /></label>
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
      <button type="submit">Submit request</button>
    </form>
  );
}
