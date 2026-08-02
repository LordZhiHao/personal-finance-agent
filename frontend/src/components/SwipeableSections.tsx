import { useEffect, useRef, type ReactNode } from "react";
import { MobileSectionTabs } from "./MobileSectionTabs";

/**
 * Pairs `MobileSectionTabs` with a swipeable panel carousel: on mobile, panels sit
 * side by side in a snap-scrolling row (swipe left/right to switch, in sync with the
 * tab bar); on desktop (`md:` and up) the same elements collapse back to a normal
 * stacked column with every panel visible at once, matching the pre-tabs layout.
 */
export function SwipeableSections<T extends string>({
  tabs,
  active,
  onChange,
  panels,
}: {
  tabs: { value: T; label: string }[];
  active: T;
  onChange: (value: T) => void;
  panels: Partial<Record<T, ReactNode>>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

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

  function handleScroll() {
    const el = containerRef.current;
    if (!el || el.clientWidth === 0) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    const tab = tabs[index];
    if (tab && tab.value !== active) onChange(tab.value);
  }

  return (
    <>
      <MobileSectionTabs tabs={tabs} active={active} onChange={onChange} />
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-3 md:mx-0 md:block md:overflow-visible md:space-y-3"
      >
        {tabs.map((tab) => (
          <div key={tab.value} className="w-full shrink-0 snap-start px-3 md:px-0 md:shrink md:snap-none">
            {panels[tab.value]}
          </div>
        ))}
      </div>
    </>
  );
}
