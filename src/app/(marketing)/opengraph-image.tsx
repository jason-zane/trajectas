import { trajectasSvg } from "@/lib/brand/svg";
import { ImageResponse } from "next/og";
import {
  PUBLIC_SITE_DESCRIPTION,
  PUBLIC_SITE_NAME,
  PUBLIC_SITE_TAGLINE,
} from "@/lib/seo/public-site";

export const runtime = "edge";
export const alt = `${PUBLIC_SITE_NAME} — ${PUBLIC_SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SAGE_700 = "#1e4a3e";
const SAGE_900 = "#0f2820";
const GOLD_500 = "#c9a962";
const GOLD_300 = "#ddc888";
const CREAM = "#f8f6f1";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 88px",
          background: `linear-gradient(135deg, ${SAGE_700} 0%, ${SAGE_900} 100%)`,
          color: CREAM,
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* Soft radial wash mimicking the page's mesh */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              `radial-gradient(900px 540px at 88% 22%, ${GOLD_500}22, transparent 70%)`,
            display: "flex",
          }}
        />

        {/* Brand row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            zIndex: 1,
          }}
        >
          {/* The approved outlined logo, embedded in the generated social image. */}
          <img src={`data:image/svg+xml;base64,${btoa(trajectasSvg({ variant: 'horizontal', height: 60, light: true }))}`} width={280.5} height={60} alt="Trajectas" />
        </div>

        {/* Tagline + supporting copy */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28, zIndex: 1 }}>
          <span
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: GOLD_300,
            }}
          >
            CAPABILITY · TRAJECTORY · OUTCOMES
          </span>
          <span
            style={{
              fontSize: 96,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: "-0.035em",
              color: CREAM,
              maxWidth: 1020,
            }}
          >
            {PUBLIC_SITE_TAGLINE}
          </span>
          <span
            style={{
              fontSize: 28,
              lineHeight: 1.4,
              color: "rgba(248, 246, 241, 0.78)",
              maxWidth: 920,
            }}
          >
            {PUBLIC_SITE_DESCRIPTION}
          </span>
        </div>

        {/* Footer band */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            zIndex: 1,
            fontSize: 20,
            color: "rgba(248, 246, 241, 0.6)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        >
          <span>trajectas.com</span>
          <span style={{ color: GOLD_300 }}>BOOK A 30-MIN DISCOVERY CALL</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
