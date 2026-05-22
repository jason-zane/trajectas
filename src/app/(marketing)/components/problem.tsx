const LEGACY = [
  "Standardised frameworks.",
  "One-size-fits-all models.",
  "Off-the-shelf benchmarks.",
  "Generic personality tests.",
];

const REFORMED = [
  "Your organisational context.",
  "Your definition of capability.",
  "Assessment built around you.",
  "Measurement tied to outcomes.",
];

export function Problem() {
  return (
    <section id="why" className="tj-section tj-problem" data-section="problem">
      <div className="tj-section-head center">
        <p className="tj-eyebrow">Why now</p>
        <h2 className="tj-h2">
          Capability that knows what your organisation actually does.
        </h2>
        <p className="tj-lede" style={{ margin: "20px auto 0" }}>
          Off-the-shelf assessments score people against a single fixed model
          of human potential. Trajectas measures the capabilities{" "}
          <em
            style={{
              fontStyle: "normal",
              fontWeight: 600,
              color: "var(--ink)",
            }}
          >
            your
          </em>{" "}
          roles depend on, and links the measurement to the performance
          outcomes you&apos;re trying to move.
        </p>
      </div>

      <div className="tj-dissolve">
        <div className="tj-dissolve-col legacy">
          <h4>Standardised providers</h4>
          <ul>
            {LEGACY.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
        <div className="tj-dissolve-col us">
          <h4>Trajectas</h4>
          <ul>
            {REFORMED.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
