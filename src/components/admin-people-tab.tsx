"use client";

import { useState } from "react";
import { updateUserProfileAction } from "@/app/actions";
import type { AppSnapshot, UserProfile } from "@/src/lib/app-data";
import { profileMatches, type AdminFilters } from "@/src/lib/admin-workspace";
import { ActionForm } from "./action-form";
import { DeleteUserForm } from "./delete-user-form";
import { IconEdit } from "./icons";
import { PendingSubmitButton } from "./pending-submit-button";
import { StatusBadge } from "./status-badge";

export function AdminPeopleTab({ snapshot, filters, viewerId }: { snapshot: AppSnapshot; filters: AdminFilters; viewerId?: string }) {
  // New sign-ups first (they're waiting on an admin), then everyone else by name. The owner account is never editable.
  const people = snapshot.profiles
    .filter((profile) => !profile.protectedOwner && profileMatches(profile, filters))
    .sort((left, right) => {
      const pendingFirst = Number(right.status === "Pending") - Number(left.status === "Pending");
      return pendingFirst || left.fullName.localeCompare(right.fullName);
    });

  if (!people.length) return <p className="empty">No people match these filters.</p>;

  return (
    <div className="data-table people-table" role="table" aria-label="People">
      <div className="data-row data-head" role="row">
        <span role="columnheader">Name and email</span>
        <span role="columnheader">Role</span>
        <span role="columnheader">Status</span>
        <span role="columnheader" className="align-end">Actions</span>
      </div>
      {people.map((profile) => (
        <PersonRow key={profile.id} profile={profile} isSelf={profile.id === viewerId} />
      ))}
    </div>
  );
}

function PersonRow({ profile, isSelf }: { profile: UserProfile; isSelf: boolean }) {
  const [editing, setEditing] = useState(false);
  const isNew = profile.status === "Pending";

  if (editing) {
    return (
      <ActionForm action={updateUserProfileAction} className="data-row person-edit" onDone={() => setEditing(false)}>
        <input type="hidden" name="profileId" value={profile.id} />
        <span role="cell" className="data-primary">
          <label>
            <span className="sr-only">Name</span>
            <input name="fullName" defaultValue={profile.fullName} required maxLength={100} autoComplete="off" autoFocus />
          </label>
          <small>{profile.email}</small>
        </span>
        <span role="cell">
          <label>
            <span className="sr-only">Role</span>
            <select name="role" defaultValue={profile.role}>
              <option>Employee</option>
              <option>Manager</option>
              <option>Admin</option>
            </select>
          </label>
        </span>
        <span role="cell">
          <label>
            <span className="sr-only">Status</span>
            <select name="status" defaultValue={profile.status}>
              <option>Pending</option>
              <option>Active</option>
              <option>Disabled</option>
            </select>
          </label>
        </span>
        <span role="cell" className="align-end row-actions">
          <PendingSubmitButton className="compact" pendingLabel="Saving...">Save</PendingSubmitButton>
          <button type="button" className="btn-ghost compact" onClick={() => setEditing(false)}>Cancel</button>
        </span>
      </ActionForm>
    );
  }

  return (
    <div className={`data-row${isNew ? " is-highlighted" : ""}`} role="row">
      <span role="cell" className="data-primary">
        <strong>
          {profile.fullName}
          {isSelf ? <span className="you-tag">You</span> : null}
          {isNew ? <span className="you-tag new-tag">New sign-up</span> : null}
        </strong>
        <small>{profile.email}</small>
      </span>
      <span role="cell"><StatusBadge value={profile.role} /></span>
      <span role="cell"><StatusBadge value={profile.status} /></span>
      <span role="cell" className="align-end row-actions">
        <button type="button" className="secondary compact" onClick={() => setEditing(true)} aria-label={`Edit ${profile.fullName}`}>
          <IconEdit />
          Edit
        </button>
        {isSelf ? null : <DeleteUserForm profileId={profile.id} fullName={profile.fullName} email={profile.email} />}
      </span>
    </div>
  );
}
