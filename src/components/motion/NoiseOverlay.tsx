import { useId } from "react";

export function NoiseOverlay({
  opacity = 0.04,
  className = "",
}: {
  opacity?: number;
  className?: string;
}) {
  const id = useId();
  const filterId = `noise-${id}`;

  return (
    <svg
      aria-hidden="true"
      className={`absolute inset-0 w-full h-full pointer-events-none select-none ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <filter id={filterId}>
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.85"
          numOctaves="4"
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect
        width="100%"
        height="100%"
        filter={`url(#${filterId})`}
        opacity={opacity}
        style={{ mixBlendMode: "screen" }}
      />
    </svg>
  );
}
