"use client";

import { useState } from "react";

const ITEMS = [
  {
    stem: "When my plan no longer makes sense, I change it without losing face.",
    capability: "Adaptability",
    key: "adapt",
    reverse: false,
  },
  {
    stem: "Once I commit to a direction, I follow through even when conditions shift.",
    capability: "Adaptability",
    key: "adapt",
    reverse: true,
  },
  {
    stem: "I sense how stakeholders are reading a situation before they say so.",
    capability: "Influence",
    key: "influence",
    reverse: false,
  },
  {
    stem: "I usually find out what stakeholders think after they raise it.",
    capability: "Influence",
    key: "influence",
    reverse: true,
  },
  {
    stem: "I make calls on partial information when the cost of waiting is high.",
    capability: "Decision-making",
    key: "decide",
    reverse: false,
  },
  {
    stem: "I'd rather get more data before changing direction.",
    capability: "Decision-making",
    key: "decide",
    reverse: true,
  },
];

const CAPABILITIES = [
  { key: "adapt", name: "Adaptability" },
  { key: "influence", name: "Influence" },
  { key: "decide", name: "Decision-making" },
];

const LABELS = [
  "Strongly disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly agree",
];

function score(answers: (number | null)[]) {
  const buckets: Record<string, number[]> = {};
  ITEMS.forEach((it, i) => {
    const raw = answers[i];
    if (raw == null) return;
    const adj = it.reverse ? 4 - raw : raw;
    (buckets[it.key] ||= []).push(adj);
  });
  return CAPABILITIES.map((c) => {
    const arr = buckets[c.key] || [];
    const avg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    return { ...c, score: Math.round((avg / 4) * 100) };
  });
}

type Step = "intro" | "q" | "report";

export function TryIt() {
  return (
    <section id="try" className="tj-section tj-try" data-section="try">
      <div className="tj-section-head center">
        <p className="tj-eyebrow">A 60-second snapshot</p>
        <h2 className="tj-h2">Where does your own pattern sit?</h2>
        <p className="tj-lede" style={{ margin: "20px auto 0" }}>
          Six quick questions, then a simple snapshot across three
          capabilities. It&apos;s a taste of how Trajectas turns measurement
          into something you can actually act on.
        </p>
      </div>
      <div className="tj-container">
        <LikertDemo />
      </div>
    </section>
  );
}

function LikertDemo() {
  const total = ITEMS.length;
  const [step, setStep] = useState<Step>("intro");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => Array(total).fill(null),
  );
  const [advancing, setAdvancing] = useState(false);

  const start = () => {
    setStep("q");
    setIdx(0);
    setAdvancing(false);
  };
  const reset = () => {
    setStep("intro");
    setIdx(0);
    setAnswers(Array(total).fill(null));
    setAdvancing(false);
  };
  const back = () => {
    if (idx > 0) {
      setIdx(idx - 1);
      setAdvancing(false);
    }
  };
  const choose = (k: number) => {
    if (advancing) return;
    setAnswers((a) => a.map((x, j) => (j === idx ? k : x)));
    setAdvancing(true);
    window.setTimeout(() => {
      if (idx + 1 >= total) {
        setStep("report");
      } else {
        setIdx(idx + 1);
        setAdvancing(false);
      }
    }, 420);
  };

  if (step === "intro") {
    return (
      <div className="tj-runner">
        <div className="tj-runner-progress" aria-hidden="true">
          <div style={{ width: "0%" }} />
        </div>
        <div className="tj-runner-card tj-runner-intro">
          <span className="tj-runner-kicker">
            A short experiment · 60 seconds
          </span>
          <h3 className="tj-runner-intro-h">
            Find your strongest capability signal.
          </h3>
          <p className="tj-runner-intro-p">
            Six quick questions. We&apos;ll show you a simple snapshot across
            three capabilities at the end. No sign-up, no storage — just a
            small experiment to see how the measurement feels.
          </p>
          <button
            type="button"
            className="tj-btn tj-btn-primary"
            style={{ padding: "14px 22px", fontSize: 14 }}
            onClick={start}
          >
            Begin →
          </button>
        </div>
      </div>
    );
  }

  if (step === "report") {
    const scored = score(answers);
    const top = [...scored].sort((a, b) => b.score - a.score)[0];
    return (
      <div className="tj-runner">
        <div className="tj-runner-progress" aria-hidden="true">
          <div style={{ width: "100%" }} />
        </div>
        <div className="tj-runner-card tj-runner-report">
          <div className="tj-runner-report-head">
            <span className="tj-runner-kicker">Sample profile</span>
            <span className="tj-mono tj-mute">6 of 6</span>
          </div>
          <h3 className="tj-runner-report-h">
            Strongest signal:{" "}
            <span style={{ color: "var(--gold-700)" }}>
              {top.name.toLowerCase()}
            </span>
            .
          </h3>
          <p className="tj-runner-report-p">
            On six quick questions your strongest signal is{" "}
            {top.name.toLowerCase()}. A real assessment would resolve this
            against the capabilities your role actually depends on, and link
            it to the outcomes you&apos;re trying to move.
          </p>
          <div className="tj-runner-bars">
            {scored.map((c) => (
              <div key={c.key} className="tj-runner-bar-row">
                <span className="tj-runner-bar-label">{c.name}</span>
                <div className="tj-runner-bar-track">
                  <div
                    className="tj-runner-bar-fill"
                    style={{
                      width: `${c.score}%`,
                      background:
                        c.key === top.key
                          ? "var(--gold-500)"
                          : "var(--sage-500)",
                    }}
                  />
                </div>
                <span
                  className="tj-runner-bar-score"
                  style={{
                    color:
                      c.key === top.key
                        ? "var(--gold-700)"
                        : "var(--sage-500)",
                  }}
                >
                  {c.score}
                </span>
              </div>
            ))}
          </div>
          <div className="tj-runner-report-foot">
            <button
              type="button"
              className="tj-btn tj-btn-ghost"
              style={{ padding: "12px 18px", fontSize: 13 }}
              onClick={reset}
            >
              Take again
            </button>
            <a
              href="#contact"
              className="tj-btn tj-btn-primary"
              style={{ padding: "12px 20px", fontSize: 13 }}
            >
              Talk about a real one →
            </a>
          </div>
        </div>
      </div>
    );
  }

  const item = ITEMS[idx];
  const chosen = answers[idx];
  const pct = (idx / total) * 100;

  return (
    <div className="tj-runner">
      <div className="tj-runner-progress" aria-hidden="true">
        <div style={{ width: `${pct}%` }} />
      </div>
      <div className="tj-runner-meta">
        <span className="tj-runner-kicker">{`Question ${idx + 1} of ${total}`}</span>
        <span className="tj-mono tj-mute">
          measuring: {item.capability.toLowerCase()}
        </span>
      </div>
      <div className={`tj-runner-card${advancing ? " advancing" : ""}`}>
        <p className="tj-runner-stem" key={idx}>
          {item.stem}
        </p>
        <div
          className="tj-runner-scale"
          role="radiogroup"
          aria-label={item.stem}
        >
          {LABELS.map((lbl, k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={chosen === k}
              className={`tj-runner-opt${chosen === k ? " on" : ""}`}
              onClick={() => choose(k)}
              disabled={advancing}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>
      <div className="tj-runner-foot">
        <button
          type="button"
          className="tj-runner-back"
          onClick={back}
          disabled={idx === 0 || advancing}
        >
          <span aria-hidden="true">←</span> Back
        </button>
        <span className="tj-mono tj-mute" style={{ fontSize: 11 }}>
          Response private · not stored
        </span>
      </div>
    </div>
  );
}
