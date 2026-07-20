"use client";

import {useEffect, useRef, useState} from "react";

// Counts up from 0 to `to` once the element scrolls into view — the landing page's mockups are
// otherwise entirely static (fabricated demo data, never fetched, never changes), and this is
// what turns them from a screenshot-shaped image into something that feels alive without needing
// a real recorded demo. Pure rAF, no animation library — this is the only place on the page that
// needs one.
export function CountUp({
  to, prefix = "", suffix = "", duration = 1200, decimals = 0, locale = "en-IN",
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  decimals?: number;
  locale?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let started = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started) return;
        started = true;
        const start = performance.now();
        function tick(now: number) {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(to * eased);
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      },
      {threshold: 0.4}
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [to, duration]);

  const formatted = decimals > 0
    ? value.toFixed(decimals)
    : Math.round(value).toLocaleString(locale);

  return <span ref={ref}>{prefix}{formatted}{suffix}</span>;
}
