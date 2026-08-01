import { useEffect, useState } from "react";

export function useCyclingPhrase(phrases: string[], intervalMs = 1500): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % phrases.length);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [phrases, intervalMs]);

  return phrases[index];
}
