export function PitchLines({ className = "", opacity = 0.08 }: { className?: string; opacity?: number }) {
  return (
    <svg
      viewBox="0 0 800 500"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      style={{ opacity }}
      aria-hidden
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.5">
        {/* outer */}
        <rect x="20" y="20" width="760" height="460" />
        {/* halfway line */}
        <line x1="400" y1="20" x2="400" y2="480" />
        {/* center circle */}
        <circle cx="400" cy="250" r="70" />
        <circle cx="400" cy="250" r="2" fill="currentColor" />
        {/* left penalty box */}
        <rect x="20" y="125" width="130" height="250" />
        <rect x="20" y="190" width="55" height="120" />
        <path d="M 150 190 A 70 70 0 0 1 150 310" />
        {/* right penalty box */}
        <rect x="650" y="125" width="130" height="250" />
        <rect x="725" y="190" width="55" height="120" />
        <path d="M 650 190 A 70 70 0 0 0 650 310" />
        {/* corner arcs */}
        <path d="M 20 30 A 10 10 0 0 1 30 20" />
        <path d="M 770 20 A 10 10 0 0 1 780 30" />
        <path d="M 20 470 A 10 10 0 0 0 30 480" />
        <path d="M 780 470 A 10 10 0 0 0 770 480" />
      </g>
    </svg>
  );
}
