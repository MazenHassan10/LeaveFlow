import type { PtoBalance, UserProfile } from "@/src/lib/app-data";
import { updatePtoAllowanceAction } from "@/app/actions";
import { PendingSubmitButton } from "./pending-submit-button";

export function PtoAllowanceForm({ profile, balance }: { profile: UserProfile; balance?: PtoBalance }) {
  const allowance = balance?.annualAllowanceHours ?? 48;
  const used = balance?.usedHours ?? 0;
  const remaining = balance?.remainingHours ?? allowance - used;

  return (
    <form action={updatePtoAllowanceAction} className="balance-row">
      <input type="hidden" name="employeeId" value={profile.id} />
      <div>
        <strong title={profile.fullName}>{profile.fullName}</strong>
        <span title={profile.email}>{profile.email}</span>
      </div>
      <label>
        Annual PTO
        <input
          name="annualAllowanceHours"
          type="number"
          min="0"
          step="0.25"
          defaultValue={allowance}
          required
        />
      </label>
      <div className="balance-row-meta">
        <span>Used</span>
        <strong>{used}h</strong>
      </div>
      <div className="balance-row-meta">
        <span>Left</span>
        <strong>{Number(remaining.toFixed(2))}h</strong>
      </div>
      <PendingSubmitButton pendingLabel="Saving...">Save</PendingSubmitButton>
    </form>
  );
}
