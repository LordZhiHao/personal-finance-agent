import { useEffect, useRef, type ReactNode } from "react";

/**
 * Mobile swipeable panel carousel (`panels`, one entry per tab — swipe left/right,
 * kept in sync with the separately-rendered `MobileSectionTabs` bar via a debounced
 * scroll listener so a tab click's own scroll animation isn't misread as a swipe-
 * in-progress and reverted mid-flight). `desktopContent` is rendered separately,
 * completely decoupled from the tab/panel split, so desktop can keep whatever
 * layout (e.g. paired side-by-side charts) it had before mobile tabs existed.
 *
 * The tab bar itself (`MobileSectionTabs`) is rendered by the page, not here —
 * this lets a page place it directly under the app header (above the page title),
 * while this carousel renders further down the page alongside the rest of the
 * content. Both must be given the same `tabs`/`active`/`onChange` to stay in sync.
 */
export function SwipeableSections<T extends string>({
  tabs,
  active,
  onChange,
  panels,
  desktopContent,
}: {
  tabs: { value: T; label: string }[];
  active: T;
  onChange: (value: T) => void;
  panels: Partial<Record<T, ReactNode>>;
  desktopContent: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Keep the carousel in sync when a tab is clicked directly (rather than swiped).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const index = tabs.findIndex((t) => t.value === active);
    if (index < 0) return;
    const target = index * el.clientWidth;
    if (Math.abs(el.scrollLeft - target) < 4) return;
    el.scrollTo({ left: target, behavior: "smooth" });
  }, [active, tabs]);

  useEffect(() => () => clearTimeout(settleTimer.current), []);

  // Debounced: only read the settled scroll position, not every intermediate
  // frame of a click's own smooth-scroll animation (which would otherwise be
  // misread as the user swiping back to the previous tab, reverting the click).
  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (el.clientWidth === 0) return;
      const index = Math.round(el.scrollLeft / el.clientWidth);
      const tab = tabs[index];
      if (tab && tab.value !== active) onChange(tab.value);
    }, 120);
  }

  return (
    <>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="md:hidden flex overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-3"
      >
        {tabs.map((tab) => (
          <div key={tab.value} className="w-full shrink-0 snap-start px-3">
            {panels[tab.value]}
          </div>
        ))}
      </div>
      <div className="hidden md:block space-y-3">{desktopContent}</div>
    </>
  );
}
