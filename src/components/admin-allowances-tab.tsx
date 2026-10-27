"use client";

import { useState } from "react";
import { updatePtoAllowanceAction } from "@/app/actions";
import type { AppSnapshot, PtoBalance, UserProfile } from "@/src/lib/app-data";
import { profileMatches, type AdminFilters } from "@/src/lib/admin-workspace";
import { PTO_ALLOWANCE_HOURS, roleTracksPto } from "@/src/lib/pto";
import { ActionForm } from "./action-form";
import { PendingSubmitButton } from "./pending-submit-button";

export function AdminAllowancesTab({ snapshot, filters }: { snapshot: AppSnapshot; filters: AdminFilters }) {
  const people = snapshot.profiles
    .filter((profile) => !profile.protectedOwner && roleTracksPto(profile.role) && profileMatches(profile, filters))
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
  const year = Object.values(snapshot.balances)[0]?.calendarYear;

  if (!people.length) return <p className="empty">No employees with PTO match these filters.</p>;

  return (
    <div className="data-table allowance-table" role="table" aria-label="PTO allowances">
      <div className="data-row data-head" role="row">
        <span role="columnheader">Employee</span>
        <span role="columnheader">Allowance (h)</span>
        <span role="columnheader">Used and left{year ? ` (${year})` : ""}</span>
        <span role="columnheader" className="align-end"><span className="sr-only">Save</span></span>
      </div>
      {people.map((profile) => (
        <AllowanceRow key={profile.id} profile={profile} balance={snapshot.balances[profile.id]} />
      ))}
    </div>
  );
}

function AllowanceRow({ profile, balance }: { profile: UserProfile; balance?: PtoBalance }) {
  const saved = balance?.annualAllowanceHours ?? PTO_ALLOWANCE_HOURS;
  const used = balance?.usedHours ?? 0;
  const [value, setValue] = useState(String(saved));
  const allowance = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(allowance) && allowance >= 0;
  const dirty = valid && allowance !== saved;
  // Preview with the value being typed so the bar reacts before saving.
  const shownAllowance = valid ? allowance : saved;
  const left = Number((shownAllowance - used).toFixed(2));
  const ratio = shownAllowance > 0 ? Math.min(1, used / shownAllowance) : used > 0 ? 1 : 0;
  const tone = left <= 0 ? "is-empty" : ratio >= 0.75 ? "is-low" : "";

  return (
    <ActionForm action={updatePtoAllowanceAction} className="data-row">
      <input type="hidden" name="employeeId" value={profile.id} />
      <span role="cell" className="data-primary">
        <strong>{profile.fullName}</strong>
        <small>{profile.email}</small>
      </span>
      <span role="cell">
        <label>
          <span className="sr-only">Annual PTO allowance for {profile.fullName}</span>
          <input
            name="annualAllowanceHours"
            type="number"
            min="0"
            step="0.25"
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            required
            className="allowance-input"
          />
        </label>
      </span>
      <span role="cell" className="usage">
        <span className={`usage-bar ${tone}`} role="img" aria-label={`${used} of ${shownAllowance} hours used`}>
          <span style={{ width: `${Math.round(ratio * 100)}%` }} />
        </span>
        <small className={tone === "is-empty" ? "usage-empty" : undefined}>{used}h used · {Math.max(left, 0)}h left</small>
      </span>
      <span role="cell" className="align-end row-actions">
        {dirty ? (
          <>
            <PendingSubmitButton className="compact" pendingLabel="Saving...">Save</PendingSubmitButton>
            <button type="button" className="btn-ghost compact" onClick={() => setValue(String(saved))}>Undo</button>
          </>
        ) : null}
      </span>
    </ActionForm>
  );
}
