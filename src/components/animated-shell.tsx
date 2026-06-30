"use client";

import { useEffect, useRef } from "react";

export function AnimatedShell({ children }: { children: React.ReactNode }) {
  const scope = useRef<HTMLElement>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let active = true;

    import("gsap").then(({ default: gsap }) => {
      if (!active || !scope.current) return;

      const context = gsap.context(() => {
        const mm = gsap.matchMedia();

        mm.add(
          {
            reduceMotion: "(prefers-reduced-motion: reduce)",
            isDesktop: "(min-width: 1025px)",
          },
          (mediaContext) => {
            const reduceMotion = mediaContext.conditions?.reduceMotion;
            const isDesktop = mediaContext.conditions?.isDesktop;

            if (reduceMotion) {
              gsap.set(".sidebar, .page-header, .metric, .summary-card, .panel, .request-card, .list-card, .profile-card, .status", {
                clearProps: "all",
                autoAlpha: 1,
              });
              return;
            }

            const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

            tl.from(".sidebar", {
              autoAlpha: 0,
              x: isDesktop ? -24 : 0,
              y: isDesktop ? 0 : -16,
              duration: 0.55,
            })
              .from(".page-header", {
                autoAlpha: 0,
                y: 18,
                duration: 0.5,
                stagger: 0.08,
              }, "-=0.18")
              .from(".metric, .summary-card", {
                autoAlpha: 0,
                y: 16,
                scale: 0.96,
                duration: 0.42,
                stagger: 0.06,
              }, "-=0.2")
              .from(".panel", {
                autoAlpha: 0,
                y: 22,
                duration: 0.48,
                stagger: 0.08,
              }, "-=0.24")
              .from(".request-card, .list-card, .profile-card", {
                autoAlpha: 0,
                y: 12,
                scale: 0.985,
                duration: 0.34,
                stagger: 0.025,
              }, "-=0.2")
              .from(".status", {
                autoAlpha: 0,
                scale: 0.88,
                duration: 0.25,
                stagger: 0.018,
              }, "-=0.28");
          }
        );
      }, scope);

      cleanup = () => context.revert();
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, []);

  return (
    <section className="animated-shell" ref={scope}>
      {children}
    </section>
  );
}
