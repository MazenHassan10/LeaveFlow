"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

gsap.registerPlugin(useGSAP);

export function BalanceRing({ used, total, remaining }: { used: number; total: number; remaining: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const usedRatio = total > 0 ? Math.min(1, used / total) : 0;
  const offset = CIRCUMFERENCE * (1 - usedRatio);

  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(".ring-fill", {
        strokeDashoffset: CIRCUMFERENCE,
      }, {
        strokeDashoffset: offset,
        duration: 0.9,
        ease: "power3.out",
      });

      gsap.from(".ring-value", {
        autoAlpha: 0,
        scale: 0.86,
        duration: 0.45,
        ease: "back.out(1.8)",
        delay: 0.18,
      });

      gsap.from(".balance-stat-row", {
        autoAlpha: 0,
        x: 14,
        duration: 0.35,
        ease: "power2.out",
        stagger: 0.06,
        delay: 0.22,
      });
    }, ref);

    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(".ring-fill", { strokeDashoffset: offset });
      gsap.set(".ring-value, .balance-stat-row", { autoAlpha: 1 });
    }, ref);

    return () => mm.revert();
  }, { scope: ref, dependencies: [offset], revertOnUpdate: true });

  return (
    <div className="balance-ring-container">
      <div className="balance-ring" ref={ref}>
        <svg viewBox="0 0 120 120">
          <defs>
            <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00C2FF" />
              <stop offset="100%" stopColor="#B6FF4D" />
            </linearGradient>
          </defs>
          <circle className="ring-track" cx="60" cy="60" r={RADIUS} />
          <circle
            className="ring-fill"
            cx="60"
            cy="60"
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="ring-value">
          <strong>{remaining}h</strong>
          <span>left</span>
        </div>
      </div>
      <div className="balance-stats">
        <div className="balance-stat-row">
          <span>Used</span>
          <strong>{used}h</strong>
        </div>
        <div className="balance-stat-row">
          <span>Remaining</span>
          <strong>{remaining}h</strong>
        </div>
        <div className="balance-stat-row">
          <span>Annual allowance</span>
          <strong>{total}h</strong>
        </div>
      </div>
    </div>
  );
}
