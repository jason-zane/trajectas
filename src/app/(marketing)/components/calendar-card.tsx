"use client";

import Script from "next/script";
import { useEffect, useId } from "react";

const CAL_NAMESPACE = "30min";
const CAL_LINK = "jason-hunt/30min";

// Brand palette piped into Cal so the embed feels like part of the page.
const BRAND_GOLD = "c9a962";
const BRAND_SAGE = "2d6a5a";
const SAGE_900 = "0f2820";
const CREAM = "f8f6f1";

declare global {
  interface Window {
    Cal?: ((command: string, ...args: unknown[]) => void) & {
      ns?: Record<
        string,
        (command: string, ...args: unknown[]) => void
      >;
      loaded?: boolean;
    };
  }
}

const INIT_SCRIPT = `
(function (C, A, L) {
  let p = function (a, ar) { a.q.push(ar); };
  let d = C.document;
  C.Cal = C.Cal || function () {
    let cal = C.Cal;
    let ar = arguments;
    if (!cal.loaded) {
      cal.ns = {};
      cal.q = cal.q || [];
      d.head.appendChild(d.createElement("script")).src = A;
      cal.loaded = true;
    }
    if (ar[0] === L) {
      const api = function () { p(api, arguments); };
      const namespace = ar[1];
      api.q = api.q || [];
      if (typeof namespace === "string") {
        cal.ns[namespace] = cal.ns[namespace] || api;
        p(cal.ns[namespace], ar);
        p(cal, ["initNamespace", namespace]);
      } else { p(cal, ar); }
      return;
    }
    p(cal, ar);
  };
})(window, "https://app.cal.com/embed/embed.js", "init");
Cal("init", "${CAL_NAMESPACE}", { origin: "https://app.cal.com" });
`.trim();

/**
 * Inline Cal.com booking embed (cal.com/jason-hunt/30min), themed to sit
 * inside the sage contact section with gold accents.
 *
 * Renders inside a glass card matching the rest of the dark sage block.
 */
export function CalendarCard() {
  // Allow more than one embed per page without id collisions.
  const reactId = useId();
  const containerId = `cal-inline-30min-${reactId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  useEffect(() => {
    function mountEmbed() {
      const cal = window.Cal?.ns?.[CAL_NAMESPACE];
      if (!cal) return false;

      cal("inline", {
        elementOrSelector: `#${containerId}`,
        config: {
          layout: "month_view",
          useSlotsViewOnSmallScreen: "true",
        },
        calLink: CAL_LINK,
      });

      cal("ui", {
        hideEventTypeDetails: true,
        layout: "month_view",
        theme: "dark",
        cssVarsPerTheme: {
          dark: {
            "cal-brand": `#${BRAND_GOLD}`,
            "cal-bg": `#${SAGE_900}`,
            "cal-bg-emphasis": `#${BRAND_SAGE}`,
            "cal-bg-muted": `#${SAGE_900}`,
            "cal-text": `#${CREAM}`,
            "cal-text-emphasis": "#ffffff",
            "cal-text-muted": "rgba(248, 246, 241, 0.65)",
            "cal-border": "rgba(255, 255, 255, 0.12)",
            "cal-border-subtle": "rgba(255, 255, 255, 0.08)",
            "cal-border-emphasis": `#${BRAND_GOLD}`,
            "cal-border-booker": "transparent",
          },
        },
      });
      return true;
    }

    if (mountEmbed()) return;

    // Cal script loads async — retry until it's available.
    const id = window.setInterval(() => {
      if (mountEmbed()) window.clearInterval(id);
    }, 120);

    const timeout = window.setTimeout(() => window.clearInterval(id), 8000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(timeout);
    };
  }, [containerId]);

  return (
    <div className="tj-cal-card tj-cal-embed">
      <div className="tj-cal-head">
        <div>
          <p
            className="tj-mono"
            style={{ color: "rgba(255,255,255,.5)", margin: 0 }}
          >
            30 · MIN · DISCOVERY
          </p>
          <h3 className="tj-h3" style={{ color: "#fff", marginTop: 6 }}>
            Book a call
          </h3>
        </div>
        <span className="tj-mono" style={{ color: "rgba(255,255,255,.5)" }}>
          cal.com/jason-hunt
        </span>
      </div>
      <div
        id={containerId}
        className="tj-cal-iframe"
        aria-label="Cal.com booking calendar"
      />
      <Script id="cal-com-init" strategy="afterInteractive">
        {INIT_SCRIPT}
      </Script>
    </div>
  );
}
