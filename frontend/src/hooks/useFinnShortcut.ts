import { useEffect } from "react";

/**
 * Opens the Finn dock on Ctrl+Tab (Windows/Linux) / Cmd+Tab (Mac). Note this is a
 * best-effort binding, not a guarantee: both shortcuts are reserved by the OS/browser
 * chrome for actual tab/window switching in many setups, so the browser may consume
 * the keystroke before this listener sees it, or the app may need to be focused in a
 * context where the browser doesn't intercept it first. `preventDefault` is called
 * whenever the event does reach us, to stop it from also switching browser tabs.
 */
export function useFinnShortcut(onTrigger: () => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifierHeld = isMac ? e.metaKey : e.ctrlKey;
      if (!modifierHeld || e.shiftKey || e.altKey) return;
      e.preventDefault();
      onTrigger();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onTrigger]);
}
