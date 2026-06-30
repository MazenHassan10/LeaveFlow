"use client";

import { useEffect, useRef } from "react";

export function AnimatedAuthPanel({ children }: { children: React.ReactNode }) {
  const scope = useRef<HTMLElement>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let active = true;

    import("gsap").then(({ default: gsap }) => {
      if (!active || !scope.current) return;

      const context = gsap.context(() => {
        const mm = gsap.matchMedia();

        mm.add("(prefers-reduced-motion: no-preference)", () => {
          const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

          tl.from(".auth-panel", {
            autoAlpha: 0,
            y: 20,
            scale: 0.96,
            duration: 0.55,
          }).from(".auth-panel > *", {
            autoAlpha: 0,
            y: 12,
            duration: 0.34,
            stagger: 0.06,
          }, "-=0.22");
        });
      }, scope);

      cleanup = () => context.revert();
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, []);

  return (
    <main className="auth-page" ref={scope}>
      <section className="auth-panel">{children}</section>
    </main>
  );
}
