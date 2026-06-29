"use client";

import { useEffect, useRef, useState } from "react";

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function BalanceRing({ used, total, remaining }: { used: number; total: number; remaining: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const usedRatio = total > 0 ? Math.min(1, used / total) : 0;
  const offset = visible ? CIRCUMFERENCE * (1 - usedRatio) : CIRCUMFERENCE;

  return (
    <div className="balance-ring-container">
      <div className="balance-ring" ref={ref}>
        <svg viewBox="0 0 120 120">
          <defs>
            <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#4f46e5" />
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
            style={{ transition: visible ? `stroke-dashoffset 800ms cubic-bezier(0.16, 1, 0.3, 1)` : "none" }}
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
