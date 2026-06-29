import type { UserProfile } from "@/src/lib/app-data";
import { updateUserProfileAction } from "@/app/actions";

export function UserRoleForm({ profile }: { profile: UserProfile }) {
  return (
    <form action={updateUserProfileAction} className="user-row">
      <input type="hidden" name="profileId" value={profile.id} />
      <div>
        <strong title={profile.fullName}>{profile.fullName}</strong>
        <span title={profile.email}>{profile.email}</span>
      </div>
      <select name="role" defaultValue={profile.role}>
        <option>Employee</option>
        <option>Admin</option>
      </select>
      <select name="status" defaultValue={profile.status}>
        <option>Pending</option>
        <option>Active</option>
        <option>Disabled</option>
      </select>
      <button type="submit">Save</button>
    </form>
  );
}
