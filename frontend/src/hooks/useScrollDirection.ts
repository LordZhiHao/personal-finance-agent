import { useEffect, useRef, useState } from "react";

const THRESHOLD = 10;

/** Tracks whether the user is scrolling down (vs up) on the document body, with a
 * small delta threshold to avoid flicker from sub-pixel/momentum scroll jitter.
 * Always reports false (visible) near the top of the page. */
export function useScrollDirection() {
  const [scrollingDown, setScrollingDown] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastY.current = window.scrollY;

    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY.current;
        if (y < 32) {
          setScrollingDown(false);
        } else if (Math.abs(delta) > THRESHOLD) {
          setScrollingDown(delta > 0);
          lastY.current = y;
        }
        ticking.current = false;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return scrollingDown;
}
