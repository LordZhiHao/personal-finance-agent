import { FinnAvatar } from "./FinnAvatar";
import { useCyclingPhrase } from "../hooks/useCyclingPhrase";

const LOADING_PHRASES = [
  "Finn is fetching your numbers…",
  "Tallying it up…",
  "Crunching the data…",
  "Almost there…",
];

export function LoadingFinn() {
  const phrase = useCyclingPhrase(LOADING_PHRASES);

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <FinnAvatar size={40} />
      <div className="flex items-center gap-2">
        <div className="flex items-end gap-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="rounded-full animate-bounce"
              style={{ width: 6, height: 6, background: "var(--brand)", animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {phrase}
        </span>
      </div>
    </div>
  );
}
