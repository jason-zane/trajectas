import type { ReactNode } from "react";
import { Fragment } from "react";

const CASES = [
  {
    eyebrow: "Use case · hiring",
    title: "Hiring for critical roles",
    body: "When a bad hire costs years, not months. Assess candidates against the capabilities the role actually demands, not a generic personality archetype, and identify who has the trajectory to perform.",
    pills: ["Role-specific", "Pre-built or custom", "Trajectory signal"],
    fragment: "hiring" as const,
  },
  {
    eyebrow: "Use case · capability mapping",
    title: "Capability mapping",
    body: "Map your people against the capabilities that drive outcomes in your organisation. See where strengths concentrate and gaps hide. Connect the map to performance data once you have it.",
    pills: ["Org diagnostic", "Cohort view", "Change over time"],
    fragment: "heatmap" as const,
  },
  {
    eyebrow: "Use case · development",
    title: "Development & succession",
    body: "Move beyond proxies. Identify who is ready, who is close, and what each person needs to develop, anchored to the capabilities your next leaders will actually need.",
    pills: ["Readiness", "Development paths", "Calibrated reviews"],
    fragment: "ladder" as const,
  },
];

export function UseCases() {
  return (
    <section
      id="cases"
      className="tj-section tj-cases"
      data-section="builtFor"
    >
      <div className="tj-section-head">
        <p className="tj-eyebrow">Use cases</p>
        <h2 className="tj-h2">Built for decisions that matter.</h2>
      </div>
      <div className="tj-cases-list">
        {CASES.map((c, i) => (
          <article
            key={c.title}
            className={`tj-case rise-in${i % 2 ? " reverse" : ""}`}
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <div className="tj-case-fragment">
              <CaseFragment kind={c.fragment} />
            </div>
            <div className="tj-case-text">
              <span className="tj-eyebrow" style={{ marginBottom: 12 }}>
                {c.eyebrow}
              </span>
              <h3
                className="tj-h2"
                style={{
                  fontSize: "clamp(28px, 3vw, 38px)",
                  marginTop: 12,
                }}
              >
                {c.title}
              </h3>
              <p
                className="tj-body"
                style={{ fontSize: 16, marginTop: 16, maxWidth: "52ch" }}
              >
                {c.body}
              </p>
              <div className="tj-case-meta">
                {c.pills.map((p, j) => (
                  <span
                    key={p}
                    className={`tj-pill ${j === 0 ? "sage" : j === 1 ? "gold" : ""}`}
                  >
                    {p}
                  </span>
                ))}
              </div>
              <div style={{ marginTop: 24 }}>
                <a className="tj-case-link" href="#try">
                  See the runner in action →
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CaseFragment({
  kind,
}: {
  kind: "hiring" | "heatmap" | "ladder";
}): ReactNode {
  if (kind === "hiring") {
    const rows = [
      { n: "NK", name: "Naomi K.", v: 92, lit: true },
      { n: "AP", name: "Aron P.", v: 88, lit: true },
      { n: "LS", name: "Lila S.", v: 76, lit: false },
      { n: "RT", name: "Riya T.", v: 71, lit: false },
    ];
    return (
      <div className="frag" style={{ padding: 22, width: "100%", maxWidth: 460 }}>
        <div className="frag-head">
          <span className="frag-title">Director shortlist</span>
          <span className="frag-sub">6 / 24 reviewed</span>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((r) => (
            <div
              key={r.name}
              style={{
                display: "grid",
                gridTemplateColumns: "32px 1fr auto 32px",
                gap: 10,
                alignItems: "center",
                fontSize: 13,
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  background: r.lit ? "var(--gold-500)" : "rgba(0,0,0,.08)",
                  color: r.lit ? "#1a1a1a" : "var(--ink)",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 700,
                  fontSize: 11,
                }}
              >
                {r.n}
              </span>
              <span>{r.name}</span>
              <div
                style={{
                  width: 120,
                  height: 6,
                  background: "var(--cream)",
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${r.v}%`,
                    height: "100%",
                    background: r.lit ? "var(--gold-500)" : "var(--sage-300)",
                    borderRadius: 999,
                  }}
                />
              </div>
              <span
                className="tj-mono"
                style={{ textAlign: "right", color: "var(--ink-mute)" }}
              >
                {r.v}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === "heatmap") {
    const teams = ["Eng", "Prod", "Sales", "CS", "Ops"];
    const caps = ["JUD", "STR", "INF", "ADP", "EXR", "CMM", "TCH"];
    return (
      <div className="frag" style={{ padding: 22, width: "100%", maxWidth: 460 }}>
        <div className="frag-head">
          <span className="frag-title">Capability map · 5 teams</span>
          <span className="frag-sub">7 caps</span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "80px repeat(7, 1fr)",
            gap: 4,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--ink-mute)",
          }}
        >
          <span />
          {caps.map((h) => (
            <span key={h} style={{ textAlign: "center" }}>
              {h}
            </span>
          ))}
          {teams.map((team, ti) => (
            <Fragment key={team}>
              <span
                style={{
                  textAlign: "right",
                  paddingRight: 6,
                  color: "var(--ink)",
                }}
              >
                {team}
              </span>
              {Array.from({ length: 7 }).map((_, ci) => {
                const v =
                  Math.abs(Math.sin((ti + 1) * (ci + 1) * 1.3)) * 0.9 + 0.1;
                const useGold = (ti + ci) % 4 === 0 && v > 0.6;
                const bg = useGold
                  ? `color-mix(in oklch, var(--gold-500) ${v * 100}%, var(--cream))`
                  : `color-mix(in oklch, var(--sage-500) ${v * 100}%, var(--cream))`;
                return (
                  <div
                    key={ci}
                    style={{ aspectRatio: "1", borderRadius: 4, background: bg }}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 12,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--ink-mute)",
          }}
        >
          <span>Low</span>
          <span>High</span>
        </div>
      </div>
    );
  }

  // ladder
  const rows = [
    { l: "Ready now", n: 8, v: 0.95, fill: "var(--gold-500)" },
    { l: "Ready in 6mo", n: 14, v: 0.7, fill: "var(--gold-300)" },
    { l: "Ready in 18mo", n: 21, v: 0.5, fill: "var(--sage-300)" },
    {
      l: "Development",
      n: 38,
      v: 0.25,
      fill: "color-mix(in oklch, var(--sage-300) 50%, var(--cream))",
    },
  ];
  return (
    <div className="frag" style={{ padding: 22, width: "100%", maxWidth: 460 }}>
      <div className="frag-head">
        <span className="frag-title">Readiness · VP role</span>
        <span className="frag-sub">81 reviewed</span>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((r) => (
          <div
            key={r.l}
            style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr 32px",
              gap: 12,
              alignItems: "center",
              fontSize: 13,
            }}
          >
            <span style={{ color: "var(--ink)" }}>{r.l}</span>
            <div
              style={{
                height: 16,
                background: "var(--cream)",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${r.v * 100}%`,
                  height: "100%",
                  background: r.fill,
                  borderRadius: 6,
                }}
              />
            </div>
            <span
              className="tj-mono"
              style={{ textAlign: "right", color: "var(--ink-mute)" }}
            >
              {r.n}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
