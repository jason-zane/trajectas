type LegacyState = boolean | "varies";

const COMPARISON: Array<{
  trait: string;
  legacy: LegacyState;
  us: boolean;
}> = [
  {
    trait: "Grounded in organisational and behavioural psychology",
    legacy: true,
    us: true,
  },
  {
    trait: "Designed to predict real-world performance",
    legacy: "varies",
    us: true,
  },
  {
    trait: "Mobile-optimised participant experience",
    legacy: "varies",
    us: true,
  },
  {
    trait: "Built around your capability model",
    legacy: false,
    us: true,
  },
  {
    trait: "Off-the-shelf, customised, or fully bespoke",
    legacy: false,
    us: true,
  },
  {
    trait: "AI-augmented assessment design",
    legacy: false,
    us: true,
  },
  {
    trait: "White-labelled to your brand",
    legacy: false,
    us: true,
  },
  {
    trait: "Framework updates as your context shifts",
    legacy: false,
    us: true,
  },
  {
    trait: "Launch an assessment in five clicks",
    legacy: false,
    us: true,
  },
];

const COMPETITORS = [
  "SHL / CEB",
  "Korn Ferry",
  "Saville",
  "Predictive Index",
  "Criteria",
  "Hogan-style personality tests",
];

export function Compare() {
  return (
    <section
      id="compare"
      className="tj-section tj-compare"
      data-section="compare"
    >
      <div className="tj-section-head center">
        <p className="tj-eyebrow">Side by side</p>
        <h2 className="tj-h2">Trajectas vs the off-the-shelf incumbents.</h2>
      </div>
      <div className="tj-cmp-vs">
        <span className="lab">Often compared to:</span>
        {COMPETITORS.map((c) => (
          <span key={c} className="v">
            {c}
          </span>
        ))}
      </div>
      <table className="tj-cmp-table">
        <thead>
          <tr>
            <th />
            <th style={{ width: 200, textAlign: "center" }}>Legacy provider</th>
            <th className="us" style={{ width: 200, textAlign: "center" }}>
              Trajectas
            </th>
          </tr>
        </thead>
        <tbody>
          {COMPARISON.map((row) => (
            <tr key={row.trait}>
              <td>{row.trait}</td>
              <td className="tj-cmp-cell">
                {row.legacy === true && <Tick />}
                {row.legacy === "varies" && <Partial />}
                {row.legacy === false && <Dash />}
              </td>
              <td className="tj-cmp-cell">
                {row.us ? <Tick accent /> : <Dash />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Tick({ accent }: { accent?: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      style={{ display: "inline-block", verticalAlign: "middle" }}
      aria-hidden="true"
    >
      <circle
        cx="11"
        cy="11"
        r="10"
        fill={accent ? "var(--sage-500)" : "rgba(0,0,0,.06)"}
      />
      <path
        d="M6 11.5L9 14.5L16 7.5"
        fill="none"
        stroke={accent ? "#fff" : "rgba(0,0,0,.4)"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Partial() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      style={{ display: "inline-block", verticalAlign: "middle" }}
      role="img"
      aria-label="Varies by provider"
    >
      <circle cx="11" cy="11" r="10" fill="rgba(0,0,0,.06)" />
      <path
        d="M6 11.5 Q 8.5 8.5, 11 11.5 T 16 11.5"
        fill="none"
        stroke="rgba(0,0,0,.4)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Dash() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 18,
        height: 2,
        background: "rgba(0,0,0,.18)",
        verticalAlign: "middle",
      }}
      aria-hidden="true"
    />
  );
}
