/**
 * Visual karate belt representation — a wrapped strip with a centered knot.
 * Renders as inline SVG so it scales and inherits color cleanly.
 */
export default function BeltIcon({ belt, size = 64, ariaLabel }) {
  const w = size * 1.6;
  const h = size * 0.5;
  const beltColor = belt?.color || "#FFFFFF";
  const stripeColor = belt?.stripe; // e.g. for Purple-White / Yellow-White
  const knotShade = darken(beltColor, 0.18);
  const tipColor = belt?.name?.startsWith("Black") ? "#D7263D" : null;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={ariaLabel || belt?.name}
      style={{ display: "block" }}
    >
      {/* Left tail */}
      <rect x="0" y={h * 0.35} width={w * 0.32} height={h * 0.32} fill={beltColor} stroke="rgba(0,0,0,0.18)" strokeWidth="0.7" />
      {/* Right tail */}
      <rect x={w * 0.68} y={h * 0.35} width={w * 0.32} height={h * 0.32} fill={beltColor} stroke="rgba(0,0,0,0.18)" strokeWidth="0.7" />
      {/* Optional stripe overlay (for split-color belts) */}
      {stripeColor && (
        <>
          <rect x="0" y={h * 0.48} width={w * 0.32} height={h * 0.08} fill={stripeColor} />
          <rect x={w * 0.68} y={h * 0.48} width={w * 0.32} height={h * 0.08} fill={stripeColor} />
        </>
      )}
      {/* Black-belt red tip */}
      {tipColor && (
        <>
          <rect x="2" y={h * 0.35} width={w * 0.05} height={h * 0.32} fill={tipColor} />
          <rect x={w * 0.93} y={h * 0.35} width={w * 0.05} height={h * 0.32} fill={tipColor} />
        </>
      )}
      {/* Knot center */}
      <rect x={w * 0.34} y={h * 0.18} width={w * 0.32} height={h * 0.66} fill={knotShade} stroke="rgba(0,0,0,0.25)" strokeWidth="0.7" />
      <rect x={w * 0.34} y={h * 0.18} width={w * 0.32} height={h * 0.12} fill="rgba(255,255,255,0.18)" />
      {/* Hanging tails */}
      <rect x={w * 0.4} y={h * 0.78} width={w * 0.08} height={h * 0.22} fill={beltColor} stroke="rgba(0,0,0,0.18)" strokeWidth="0.6" />
      <rect x={w * 0.52} y={h * 0.78} width={w * 0.08} height={h * 0.22} fill={beltColor} stroke="rgba(0,0,0,0.18)" strokeWidth="0.6" />
    </svg>
  );
}

function darken(hex, amt = 0.15) {
  if (!hex || !hex.startsWith("#") || hex.length !== 7) return hex;
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - Math.round(255 * amt));
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - Math.round(255 * amt));
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - Math.round(255 * amt));
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
