const STAGES = [
  {
    num: "01",
    title: "Discovery",
    desc: "We map your roles, your competency framework, and the outcomes you're trying to predict. No assumptions about what \"capability\" means until you tell us.",
  },
  {
    num: "02",
    title: "Build the model",
    desc: "Capabilities are designed around your organisation. AI-drafted, your team approves. Pre-built starting points if you'd rather customise than start blank.",
  },
  {
    num: "03",
    title: "Run",
    desc: "Participants take the assessment in a co-branded runner. Items drawn from a calibrated bank. Campaigns send to whole cohorts at once.",
  },
  {
    num: "04",
    title: "Read trajectory",
    desc: "Individual capability profiles ship today. Over time, we connect the instrument to the performance signals you choose to share.",
  },
];

export function Journey() {
  return (
    <section id="how" className="tj-section tj-journey" data-section="journey">
      <div className="tj-container">
        <div className="tj-section-head">
          <p className="tj-eyebrow">How it works</p>
          <h2 className="tj-h2">From your context to a calibrated instrument.</h2>
          <p className="tj-lede">
            Discovery is where it starts. A short scoping engagement maps the
            capabilities your organisation actually depends on, then the
            instrument is built around it.
          </p>
        </div>
        <div className="tj-steps">
          {STAGES.map((s, i) => (
            <div
              key={s.num}
              className="tj-step rise-in"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="tj-step-head">
                <span className="tj-step-num">{s.num}</span>
                <span className="tj-step-line" />
              </div>
              <h3 className="tj-h3">{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
