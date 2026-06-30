import type { UserProfile } from "@/src/lib/app-data";
import { updateUserProfileAction } from "@/app/actions";
import { PendingSubmitButton } from "./pending-submit-button";

export function UserRoleForm({ profile }: { profile: UserProfile }) {
  return (
    <form action={updateUserProfileAction} className="user-row">
      <input type="hidden" name="profileId" value={profile.id} />
      <div className="user-row-identity">
        <strong title={profile.fullName}>{profile.fullName}</strong>
        <span title={profile.email}>{profile.email}</span>
      </div>
      <div className="user-row-controls">
        <label>
          Role
          <select name="role" defaultValue={profile.role}>
            <option>Employee</option>
            <option>Admin</option>
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={profile.status}>
            <option>Pending</option>
            <option>Active</option>
            <option>Disabled</option>
          </select>
        </label>
        <PendingSubmitButton pendingLabel="Saving...">Save</PendingSubmitButton>
      </div>
    </form>
  );
}
