import {ImageResponse} from "next/og";

export const size = {width: 1200, height: 630};
export const contentType = "image/png";
export const alt = "WealthyNest — Smart personal finance for Indian families";

// Same four-leg ribbon-W geometry as BrandMark's RibbonWMark, hand-copied rather than imported:
// ImageResponse renders via Satori, which supports plain inline SVG but not the Tailwind
// className/useId()-based component that draws the in-app logo — this is the same shape, just
// re-expressed with static ids and no className dependency.
const W_LEGS = [
  {tx: 63, ty: 114, rot: 71.9, len: 122.07, id: "a"},
  {tx: 91, ty: 134, rot: -76.7, len: 78.1, id: "b"},
  {tx: 109, ty: 134, rot: 76.7, len: 78.1, id: "c"},
  {tx: 137, ty: 114, rot: -71.9, len: 122.07, id: "d"},
] as const;

const W_STOPS: Record<(typeof W_LEGS)[number]["id"], [string, string]> = {
  a: ["#e8935f", "#c2703d"],
  b: ["#c2703d", "#e8935f"],
  c: ["#935a35", "#52341f"],
  d: ["#52341f", "#6b4526"],
};

function RibbonWMark() {
  return (
    <svg width="120" height="120" viewBox="0 0 200 200">
      <defs>
        {W_LEGS.map((leg) => {
          const [from, to] = W_STOPS[leg.id];
          const half = leg.len / 2;
          return (
            <linearGradient key={leg.id} id={`og-w-${leg.id}`} x1={-half} y1="0" x2={half} y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
          );
        })}
      </defs>
      {W_LEGS.map((leg) => (
        <g key={leg.id} transform={`translate(${leg.tx} ${leg.ty}) rotate(${leg.rot})`}>
          <rect x={-leg.len / 2} y={-13} width={leg.len} height={26} rx={9} fill={`url(#og-w-${leg.id})`} />
        </g>
      ))}
    </svg>
  );
}

export function buildOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #020617 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 168,
            height: 168,
            borderRadius: 36,
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #27272a 0%, #0a0a0a 100%)",
            boxShadow: "0 20px 60px -12px rgba(194,112,61,0.35)",
            marginBottom: 40,
          }}
        >
          <RibbonWMark />
        </div>

        <div style={{display: "flex", fontSize: 68, fontWeight: 800, color: "#f8fafc", letterSpacing: -1}}>
          WealthyNest
        </div>

        <div style={{display: "flex", fontSize: 30, color: "#94a3b8", marginTop: 20}}>
          One nest for your entire financial life.
        </div>

        <div style={{display: "flex", gap: 28, marginTop: 44}}>
          {["Free forever", "No ads, ever", "Built for Indian families"].map((label) => (
            <div key={label} style={{display: "flex", alignItems: "center", fontSize: 22, color: "#d98a52"}}>
              <div style={{display: "flex", width: 8, height: 8, borderRadius: 4, background: "#d98a52", marginRight: 10}} />
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    {...size}
  );
}
