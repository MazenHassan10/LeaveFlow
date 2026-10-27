"use client";

import type { UserProfile } from "@/src/lib/app-data";
import { updateUserProfileAction } from "@/app/actions";
import { ActionForm } from "./action-form";
import { DeleteUserForm } from "./delete-user-form";
import { PendingSubmitButton } from "./pending-submit-button";

// isSelf: the signed-in admin's own row. Deleting yourself is always refused, so no Delete button.
export function UserRoleForm({ profile, isSelf = false }: { profile: UserProfile; isSelf?: boolean }) {
  const formId = `user-form-${profile.id}`;

  return (
    <div className="user-row">
      <div className="user-row-identity">
        <label className="user-row-name">
          Name
          {/* Linked to the Save form by id; the email below is not editable. */}
          <input
            key={`name-${profile.fullName}`}
            form={formId}
            name="fullName"
            defaultValue={profile.fullName}
            required
            maxLength={100}
            autoComplete="off"
          />
        </label>
        <span title={profile.email}>{profile.email}</span>
      </div>
      <div className="user-row-actions">
        <ActionForm id={formId} action={updateUserProfileAction} className="user-row-controls">
          <input type="hidden" name="profileId" value={profile.id} />
          <label>
            Role
            {/* key resyncs the uncontrolled select to the persisted value after a refresh */}
            <select key={`role-${profile.role}`} name="role" defaultValue={profile.role}>
              <option>Employee</option>
              <option>Manager</option>
              <option>Admin</option>
            </select>
          </label>
          <label>
            Status
            <select key={`status-${profile.status}`} name="status" defaultValue={profile.status}>
              <option>Pending</option>
              <option>Active</option>
              <option>Disabled</option>
            </select>
          </label>
          <PendingSubmitButton pendingLabel="Saving...">Save</PendingSubmitButton>
        </ActionForm>
        {isSelf ? null : <DeleteUserForm profileId={profile.id} fullName={profile.fullName} email={profile.email} />}
      </div>
    </div>
  );
}
