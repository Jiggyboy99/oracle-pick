// Oracle is a virtual entity (not a real user). Computed/displayed in UI.
export const ORACLE = {
  id: "oracle",
  display_name: "The Oracle",
};

export type OracleMood = "smug" | "confident" | "nervous" | "humbled";

export function oracleMood(rank: number, totalPlayers: number, accuracy: number): OracleMood {
  if (rank === 1 && accuracy > 0.6) return "smug";
  if (rank <= Math.max(3, totalPlayers * 0.2)) return "confident";
  if (rank > totalPlayers * 0.5) return "humbled";
  return "nervous";
}

export function oracleLine(mood: OracleMood, confidence: number, pickLabel: string): string {
  const pct = Math.round(confidence * 100);
  switch (mood) {
    case "smug":
      return `${pct}% on ${pickLabel}. You won't fade me. You can't.`;
    case "confident":
      return `${pct}% on ${pickLabel}. Fade me if you're feeling brave.`;
    case "nervous":
      return `${pct}% on ${pickLabel}. Honestly? Coin flip energy.`;
    case "humbled":
      return `${pct}% on ${pickLabel}. I've been wrong before. Go with your gut.`;
  }
}

export function oracleAvatarColor(mood: OracleMood): string {
  switch (mood) {
    case "smug": return "from-violet-500 to-fuchsia-500";
    case "confident": return "from-violet-500 to-indigo-500";
    case "nervous": return "from-amber-500 to-violet-500";
    case "humbled": return "from-slate-500 to-violet-700";
  }
}
