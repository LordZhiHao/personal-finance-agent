export function FinnAvatar({ size = 28 }: { size?: number }) {
  return (
    <img
      src="/logo-mark.png"
      alt="Finn"
      className="rounded-full shrink-0"
      style={{ width: size, height: size, background: "var(--brand-tint)" }}
    />
  );
}
