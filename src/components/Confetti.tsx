import { useEffect, useState } from "react";

export function Confetti({ trigger }: { trigger: number }) {
  const [pieces, setPieces] = useState<number[]>([]);
  useEffect(() => {
    if (trigger === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setPieces(Array.from({ length: 80 }, (_, i) => i));
    const t = setTimeout(() => setPieces([]), 3000);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!pieces.length) return null;
  const colors = ["#39E75F", "#7B61FF", "#FF9F40", "#FF5C8A", "#FFFFFF"];
  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {pieces.map((i) => (
        <span
          key={i}
          className="absolute top-0 block rounded-sm"
          style={{
            left: `${Math.random() * 100}%`,
            width: 8,
            height: 14,
            background: colors[i % colors.length],
            animation: `confetti-fall ${1.5 + Math.random() * 1.5}s ${Math.random() * 0.3}s linear forwards`,
          }}
        />
      ))}
    </div>
  );
}
