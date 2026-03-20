"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type RevealSectionProps = {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  durationMs?: number;
};

export default function RevealSection({
  children,
  className = "",
  delayMs = 0,
  durationMs = 700
}: RevealSectionProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: "0px 0px -8% 0px"
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(30px)",
        transitionProperty: "opacity, transform",
        transitionDuration: `${durationMs}ms`,
        transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        transitionDelay: `${delayMs}ms`
      }}
    >
      {children}
    </section>
  );
}
