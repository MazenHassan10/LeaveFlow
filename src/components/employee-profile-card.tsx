"use client";

import type { AppSnapshot, UserProfile } from "@/src/lib/app-data";
import { formatDateLabelInLosAngeles, formatTimeRange12Hour } from "@/src/lib/app-time";
import { buildEmployeeProfileMetrics } from "@/src/lib/employee-profile-metrics";
import { useEffect, useRef } from "react";
import { Badge } from "./ui/badge";
import { StatusBadge } from "./status-badge";
import { Stat } from "./stat";

export function EmployeeProfileCard({ profile, snapshot }: { profile: UserProfile; snapshot: AppSnapshot }) {
  const cardRef = useRef<HTMLElement>(null);
  const balance = snapshot.balances[profile.id];
  const requests = snapshot.requests.filter((request) => request.employeeId === profile.id);
  const metrics = buildEmployeeProfileMetrics(requests);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let active = true;

    import("gsap").then(({ default: gsap }) => {
      if (!active || !cardRef.current) return;

      const context = gsap.context(() => {
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const detailItems = gsap.utils.toArray<HTMLElement>(".profile-detail-item");

        if (reduceMotion) {
          gsap.set(detailItems, { clearProps: "all", autoAlpha: 1 });
          return;
        }

        if (detailItems.length) {
          gsap.from(detailItems, {
            autoAlpha: 0,
            y: 10,
            scale: 0.985,
            duration: 0.28,
            ease: "power2.out",
            stagger: 0.04,
          });
        }
      }, cardRef);

      cleanup = () => context.revert();
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, []);

  return (
    <article className="profile-card" ref={cardRef}>
      <div className="avatar">{profile.fullName.slice(0, 2).toUpperCase()}</div>
      <div className="profile-main">
        <strong title={profile.fullName}>{profile.fullName}</strong>
        <span title={profile.email}>{profile.email}</span>
        <div className="pill-row">
          <StatusBadge value={profile.role} />
          <StatusBadge value={profile.status} />
          {profile.protectedOwner ? <StatusBadge value="Owner" /> : null}
        </div>
      </div>
      <div className="stat-grid">
        <Stat label="Used" value={`${balance?.usedHours ?? 0}h`} />
        <Stat label="Left" value={`${balance?.remainingHours ?? 0}h`} />
        <Stat label="Approved" value={requests.filter((r) => r.status === "Approved").length} />
        <Stat label="Pending" value={requests.filter((r) => r.status === "Pending").length} />
        <Stat label="Requested" value={`${requests.reduce((total, r) => total + r.totalRequestedHours, 0)}h`} />
        <Stat label="Additional" value={`${metrics.approvedAdditionalTimeOffHours}h`} />
        <Stat label="Make-up review" value={metrics.pendingMakeupReviewCount} />
      </div>
      <div className="profile-details">
        <div className="profile-detail-item">
          <span>Additional time off</span>
          <strong>{metrics.approvedAdditionalTimeOffHours}h approved</strong>
          <small>{metrics.approvedAdditionalTimeOffCount} approved request{metrics.approvedAdditionalTimeOffCount === 1 ? "" : "s"}</small>
        </div>
        <div className="profile-detail-item worked-dates">
          <div className="worked-dates-header">
            <span>Worked dates</span>
            {metrics.extraWorkedMakeupDateCount ? (
              <Badge variant="violet">+{metrics.extraWorkedMakeupDateCount} more</Badge>
            ) : null}
          </div>
          {metrics.workedMakeupDates.length ? (
            <div className="worked-date-list">
              {metrics.workedMakeupDates.map((entry) => (
                <div className="worked-date-row" key={entry.id}>
                  <strong>{formatDateLabelInLosAngeles(entry.date)}</strong>
                  <span>{formatTimeRange12Hour(entry.startTime, entry.endTime)} · {entry.hours}h</span>
                </div>
              ))}
            </div>
          ) : (
            <small>No worked make-up dates yet.</small>
          )}
        </div>
      </div>
    </article>
  );
}
