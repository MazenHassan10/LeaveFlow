"use client";

import { useEffect, useRef, useState } from "react";
import type { AppSnapshot } from "@/src/lib/app-data";
import { buildApprovalGroups, type ApprovalGroupKey } from "@/src/lib/approval-groups";
import { AdminRequestCard } from "./admin-request-card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { IconChevronLeft } from "./icons";

type GroupRefs = Record<ApprovalGroupKey, HTMLDivElement | null>;

const DEFAULT_OPEN: Record<ApprovalGroupKey, boolean> = {
  pending: true,
  approved: false,
  rejected: false,
};

export function ApprovalSections({ snapshot }: { snapshot: AppSnapshot }) {
  const groups = buildApprovalGroups(snapshot.requests);
  const [openGroups, setOpenGroups] = useState(DEFAULT_OPEN);
  const sectionRefs = useRef<GroupRefs>({ pending: null, approved: null, rejected: null });
  const initialized = useRef(false);

  function setSectionRef(key: ApprovalGroupKey) {
    return (element: HTMLDivElement | null) => {
      sectionRefs.current[key] = element;
    };
  }

  function toggleGroup(key: ApprovalGroupKey) {
    setOpenGroups((current) => ({ ...current, [key]: !current[key] }));
  }

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let active = true;

    import("gsap").then(({ default: gsap }) => {
      if (!active) return;

      const contexts = groups.map((group) => {
        const root = sectionRefs.current[group.key];
        if (!root) return null;

        return gsap.context(() => {
          const content = root.querySelector<HTMLElement>(".approval-group-content");
          const inner = root.querySelector<HTMLElement>(".approval-group-inner");
          const chevron = root.querySelector<HTMLElement>(".approval-group-chevron");
          const cards = gsap.utils.toArray<HTMLElement>(".request-card", root);
          const isOpen = openGroups[group.key];
          const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

          if (!content || !inner || !chevron) return;

          gsap.killTweensOf([content, inner, chevron, ...cards]);

          if (reduceMotion) {
            gsap.set(content, { height: isOpen ? "auto" : 0, autoAlpha: isOpen ? 1 : 0, overflow: "hidden" });
            gsap.set(inner, { clearProps: "transform,opacity,visibility" });
            gsap.set(chevron, { rotation: isOpen ? -90 : 0 });
            return;
          }

          if (!initialized.current) {
            gsap.set(content, { height: isOpen ? "auto" : 0, autoAlpha: isOpen ? 1 : 0, overflow: "hidden" });
            gsap.set(chevron, { rotation: isOpen ? -90 : 0 });
            if (isOpen && cards.length) {
              gsap.from(cards, {
                autoAlpha: 0,
                y: 8,
                scale: 0.99,
                duration: 0.26,
                ease: "power2.out",
                stagger: 0.025,
              });
            }
            return;
          }

          if (isOpen) {
            gsap.set(content, { height: 0, autoAlpha: 1, overflow: "hidden" });
            const targetHeight = inner.offsetHeight;
            const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
            timeline
              .to(chevron, { rotation: -90, duration: 0.22 }, 0)
              .to(content, {
                height: targetHeight,
                duration: 0.34,
                onComplete: () => {
                  gsap.set(content, { height: "auto" });
                },
              }, 0)
              .fromTo(inner, { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: 0.24 }, 0.08);

            if (cards.length) {
              timeline.fromTo(cards, {
                autoAlpha: 0,
                y: 8,
                scale: 0.99,
              }, {
                autoAlpha: 1,
                y: 0,
                scale: 1,
                duration: 0.24,
                stagger: 0.025,
              }, 0.12);
            }
            return;
          }

          gsap.set(content, { height: content.offsetHeight, overflow: "hidden" });
          gsap.timeline({ defaults: { ease: "power2.inOut" } })
            .to(chevron, { rotation: 0, duration: 0.2 }, 0)
            .to(inner, { autoAlpha: 0, y: -6, duration: 0.18 }, 0)
            .to(content, { height: 0, autoAlpha: 0, duration: 0.26 }, 0.04);
        }, root);
      });

      initialized.current = true;
      cleanup = () => {
        contexts.forEach((context) => context?.revert());
      };
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [groups, openGroups]);

  return (
    <div className="approval-sections">
      {groups.map((group) => {
        const isOpen = openGroups[group.key];
        const contentId = `approval-group-${group.key}`;

        return (
          <section
            className={`approval-group approval-group-${group.key}`}
            data-open={isOpen}
            key={group.key}
            ref={setSectionRef(group.key)}
          >
            <Button
              aria-controls={contentId}
              aria-expanded={isOpen}
              className="approval-group-trigger"
              onClick={() => toggleGroup(group.key)}
              type="button"
              variant="ghost"
            >
              <span className="approval-group-title">
                <span className="approval-group-chevron" aria-hidden="true"><IconChevronLeft /></span>
                <span>{group.title}</span>
              </span>
              <Badge className="approval-group-count" variant={group.key === "approved" ? "success" : group.key === "rejected" ? "destructive" : "warning"}>
                {group.requests.length}
              </Badge>
            </Button>
            <div
              aria-hidden={!isOpen}
              className="approval-group-content"
              id={contentId}
            >
              <div className="approval-group-inner">
                {group.requests.length ? (
                  <div className="stack">
                    {group.requests.map((request) => (
                      <AdminRequestCard key={request.id} request={request} profiles={snapshot.profiles} />
                    ))}
                  </div>
                ) : (
                  <p className="empty">{group.empty}</p>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
