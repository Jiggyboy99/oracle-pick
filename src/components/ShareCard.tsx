import { forwardRef, useEffect, useRef, useState } from "react";
import * as htmlToImage from "html-to-image";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import type { ReceiptPick } from "./PredictionReceipt";

interface ShareCardProps {
  homeCode: string;
  awayCode: string;
  home: string;
  away: string;
  picks: ReceiptPick[];
  variant?: "default" | "called-it";
  calledScore?: string;
}

export function ShareCard({ homeCode, awayCode, home, away, picks, variant = "default", calledScore }: ShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!cardRef.current) return;
      htmlToImage
        .toPng(cardRef.current, { pixelRatio: 2, cacheBust: true })
        .then((url) => { setImgUrl(url); setGenerating(false); })
        .catch(() => setGenerating(false));
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const picksLines = picks
    .slice(0, 4)
    .map((p) => `• ${p.market}: ${p.pick}`)
    .join("\n");
  const shareText = variant === "called-it" && calledScore
    ? `I CALLED IT 👁️ ${homeCode} vs ${awayCode} — exact score ${calledScore} 🎯\n\n${picksLines}\n\nBeat the Oracle at The Eye:`
    : `I called ${homeCode} vs ${awayCode} 🎯\n\n${picksLines}\n\nThink you know better?`;

  function openTwitter() {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function openWhatsApp() {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied!");
  }

  return (
    <>
      {/* Off-screen card rendered for html-to-image capture */}
      <div style={{ position: "fixed", top: -9999, left: -9999, pointerEvents: "none" }}>
        <CardImage
          ref={cardRef}
          homeCode={homeCode}
          awayCode={awayCode}
          home={home}
          away={away}
          picks={picks}
          variant={variant}
          calledScore={calledScore}
        />
      </div>

      <div className="mt-6 rounded-[20px] border border-white/10 bg-[#0F0F16] overflow-hidden">
        <div className="px-5 md:px-6 py-4 border-b border-white/5">
          <div className="text-[10px] tracking-[0.3em] uppercase text-white/40">Share Your Call</div>
        </div>

        <div className="p-4 md:p-5">
          {/* Card preview */}
          {generating ? (
            <div
              className="w-full rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse"
              style={{ aspectRatio: "16/9" }}
            />
          ) : imgUrl ? (
            <img src={imgUrl} alt="Your prediction card" className="w-full rounded-2xl" />
          ) : null}

          {/* Share buttons */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <button
              onClick={openTwitter}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 transition-colors text-sm font-semibold"
            >
              <XIcon />
              <span>Post</span>
            </button>
            <button
              onClick={openWhatsApp}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 transition-colors text-sm font-semibold"
              style={{ color: "#25D366" }}
            >
              <WhatsAppIcon />
              <span>Send</span>
            </button>
            <button
              onClick={copyLink}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 transition-colors text-sm font-semibold"
            >
              <Link2 size={15} />
              <span>Copy link</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Internal card template captured by html-to-image ──────────────────────────

type CardImageProps = Omit<ShareCardProps, never>;

const CardImage = forwardRef<HTMLDivElement, CardImageProps>(function CardImage(
  { homeCode, awayCode, home, away, picks, variant = "default", calledScore },
  ref
) {
  const isCalledIt = variant === "called-it";
  return (
    <div
      ref={ref}
      style={{
        width: 520,
        padding: 36,
        background: "#0A0A0F",
        borderRadius: 24,
        color: "white",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background gradient blobs */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: isCalledIt
            ? "radial-gradient(circle at 10% 15%, rgba(57,231,95,0.28), transparent 45%), radial-gradient(circle at 88% 82%, rgba(57,231,95,0.14), transparent 42%)"
            : "radial-gradient(circle at 10% 15%, rgba(123,97,255,0.22), transparent 45%), radial-gradient(circle at 88% 82%, rgba(57,231,95,0.13), transparent 42%)",
        }}
      />

      {/* Branding / headline */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: isCalledIt ? 20 : 32,
        }}
      >
        {isCalledIt ? (
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "0.01em", color: "#39E75F" }}>
            I CALLED IT 👁️
          </div>
        ) : (
          <div style={{ fontSize: 21, fontWeight: 900, letterSpacing: "-0.03em", color: "white" }}>
            The Eye
          </div>
        )}
        <div
          style={{
            fontSize: 9,
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
          }}
        >
          World Cup · 2026
        </div>
      </div>

      {/* Called-it score display */}
      {isCalledIt && calledScore && (
        <div
          style={{
            position: "relative",
            textAlign: "center",
            marginBottom: 24,
            padding: "16px 0",
          }}
        >
          <div style={{ fontSize: 80, fontWeight: 900, color: "#39E75F", lineHeight: 1, letterSpacing: "-0.04em" }}>
            {calledScore}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.3em", textTransform: "uppercase", marginTop: 6 }}>
            Exact Score · Perfect Call
          </div>
        </div>
      )}

      {/* Match */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          marginBottom: 28,
          paddingBottom: 28,
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 62, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 0.88, color: "white" }}>
            {homeCode}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.4)",
              marginTop: 10,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
            }}
          >
            {home}
          </div>
        </div>
        <div
          style={{
            padding: "0 20px",
            fontSize: 22,
            color: "rgba(255,255,255,0.16)",
            fontWeight: 800,
          }}
        >
          VS
        </div>
        <div style={{ flex: 1, textAlign: "right" }}>
          <div style={{ fontSize: 62, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 0.88, color: "white" }}>
            {awayCode}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.4)",
              marginTop: 10,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
            }}
          >
            {away}
          </div>
        </div>
      </div>

      {/* Picks */}
      <div
        style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}
      >
        {picks.map((p, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "11px 16px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.45)",
                textTransform: "uppercase",
                letterSpacing: "0.18em",
              }}
            >
              {p.market}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, color: "white" }}>
              {p.pick}
              {p.faded && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    padding: "2px 7px",
                    borderRadius: 4,
                    background: "#7B61FF",
                    color: "white",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  FADE
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Tagline */}
      <div
        style={{
          position: "relative",
          padding: "16px 20px",
          background: "#39E75F",
          borderRadius: 14,
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0F", letterSpacing: "0.02em" }}>
          {isCalledIt ? "Can you beat the Oracle? · The Eye" : "Think you know better? · The Eye"}
        </span>
      </div>
    </div>
  );
});

// ── Icon helpers ──────────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.265 5.632L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
