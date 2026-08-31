"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 600;

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function useAnimatedNumber(target: number): number {
  const [value, setValue] = useState(target);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = 0;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / DURATION_MS, 1);
      setValue(from + (target - from) * easeOutQuad(progress));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
}
