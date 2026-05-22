type RowState = boolean | "next";

const COMPARISON: Array<{
  trait: string;
  legacy: boolean;
  us: RowState;
  note: string;
}> = [
  {
    trait: "Built around your capability model",
    legacy: false,
    us: true,
    note: "today",
  },
  {
    trait: "Calibrated to your roles and outcomes",
    legacy: false,
    us: true,
    note: "today",
  },
  {
    trait: "Psychometric rigour (CTT, EFA/CFA)",
    legacy: true,
    us: true,
    note: "today",
  },
  { trait: "Item bank you can extend", legacy: false, us: true, note: "today" },
  {
    trait: "AI-assisted build (with human approval)",
    legacy: false,
    us: true,
    note: "today",
  },
  {
    trait: "Outcome-tied measurement",
    legacy: false,
    us: "next",
    note: "in development",
  },
  {
    trait: "Self-serve framework builder",
    legacy: false,
    us: "next",
    note: "in development",
  },
  {
    trait: "Updates as your context shifts",
    legacy: false,
    us: "next",
    note: "in development",
  },
  {
    trait: "Single fixed model for every client",
    legacy: true,
    us: false,
    note: "by design",
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
              <td>
                {row.trait}
                {row.note !== "today" && row.note !== "by design" && (
                  <span className="tj-cmp-note">{row.note}</span>
                )}
              </td>
              <td className="tj-cmp-cell">
                {row.legacy ? <Tick /> : <Dash />}
              </td>
              <td className="tj-cmp-cell">
                {row.us === true && <Tick accent />}
                {row.us === "next" && (
                  <span className="tj-cmp-dev">
                    <span className="dot" />
                    In dev
                  </span>
                )}
                {row.us === false && <Dash />}
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
