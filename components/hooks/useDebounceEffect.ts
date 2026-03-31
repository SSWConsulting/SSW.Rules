import { useEffect, useRef } from "react";

export function useDebounceEffect(effect: () => void | (() => void), deps: any[], delayMs: number) {
  const cleanupRef = useRef<void | (() => void)>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => {
        // run previous cleanup if present before the new effect
        if (typeof cleanupRef.current === "function") {
          cleanupRef.current();
        }
        cleanupRef.current = effect();
      },
      Math.max(0, delayMs)
    );

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      // run cleanup if it's a function when deps change or unmount
      if (typeof cleanupRef.current === "function") {
        cleanupRef.current();
        cleanupRef.current = undefined;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
