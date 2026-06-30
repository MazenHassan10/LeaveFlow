"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export function AnimatedAuthPanel({ children }: { children: React.ReactNode }) {
  const scope = useRef<HTMLElement>(null);

  useGSAP(() => {
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
    }, scope);

    return () => mm.revert();
  }, { scope });

  return (
    <main className="auth-page" ref={scope}>
      <section className="auth-panel">{children}</section>
    </main>
  );
}
