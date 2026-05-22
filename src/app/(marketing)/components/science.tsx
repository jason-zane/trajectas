const SCIENCE_ITEMS = [
  {
    num: "01",
    title: "Grounded in organisational psychology",
    body: "Every capability we measure is grounded in established research on what actually predicts performance at work. Not pop psychology, not personality typing. The underlying science decades of organisational research has stress-tested.",
  },
  {
    num: "02",
    title: "Built to predict behaviour, not describe it",
    body: "The point of measurement is to predict what people will do under pressure, in ambiguity, when stakeholders push back. We build items around the behaviours that distinguish outcomes in your roles.",
  },
  {
    num: "03",
    title: "Measurement rigour, plain-spoken",
    body: "Items are calibrated for reliability and discrimination before they reach a participant. The underlying statistics are inspectable. We won't bury you in psychometric jargon. We won't fudge the maths either.",
  },
];

export function Science() {
  return (
    <section className="tj-section tj-science" data-section="science">
      <div className="tj-section-head center">
        <p className="tj-eyebrow">How we measure</p>
        <h2 className="tj-h2">
          Built to predict behaviour, grounded in organisational psychology.
        </h2>
        <p className="tj-lede" style={{ margin: "20px auto 0" }}>
          Trajectas isn&apos;t a personality quiz dressed up as a tool. The
          capabilities we measure are drawn from the research that
          distinguishes performance at work, and built into measurement
          that&apos;s calibrated to your roles.
        </p>
      </div>
      <ul className="tj-science-grid-list">
        {SCIENCE_ITEMS.map((s) => (
          <li key={s.num}>
            <span className="num">{s.num}</span>
            <div>
              <h4>{s.title}</h4>
              <p>{s.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
