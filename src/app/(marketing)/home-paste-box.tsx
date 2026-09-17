"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PD_HANDOFF_KEY } from "./build/pd-handoff";

const EXAMPLE_PD = `Reports to the Head of Product. Owns the roadmap for the merchant payments platform and is accountable for its gross margin and transaction growth across three markets. Breaks down ambiguous merchant problems into root causes before committing engineering time. Makes the call on trade-offs between compliance obligations and merchant experience when the data is incomplete. Decides which of many competing requests the squad takes on each quarter, and which it declines. Writes the case for those decisions for the executive team and the board. Negotiates scope and sequencing with Risk, Finance and two external processors.`;

/**
 * The home page's own card never creates anything — it hands the pasted
 * text to /build via sessionStorage and navigates there. See
 * src/app/(marketing)/build/pd-handoff.ts.
 */
export function HomePasteBox() {
  const router = useRouter();
  const [text, setText] = useState(EXAMPLE_PD);
  const [isExample, setIsExample] = useState(true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = isExample ? "" : text.trim();
    try {
      if (value) window.sessionStorage.setItem(PD_HANDOFF_KEY, value);
    } catch {
      // sessionStorage unavailable — /build still works, just without the handoff.
    }
    router.push("/build");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="title" style={{ fontSize: 20 }}>
          Senior Product Manager, Payments
        </p>
        <span className="measure whitespace-nowrap">Example &middot; replace with yours</span>
      </div>
      <div className="rule" />
      <label htmlFor="home-pd" className="field-label" style={{ margin: 0 }}>
        Position description
      </label>
      <textarea
        id="home-pd"
        className="sheet-text"
        rows={12}
        value={text}
        onFocus={() => {
          if (isExample) {
            setText("");
            setIsExample(false);
          }
        }}
        onChange={(e) => {
          setIsExample(false);
          setText(e.target.value);
        }}
      />
      <p className="body-soft" style={{ fontSize: 13 }}>
        Paste yours, or upload a PDF or Word file on the next screen. Nothing is stored until you
        create the assessment.
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-4">
        <button type="submit" className="btn btn-primary">
          Build the assessment
        </button>
        <span className="measure">Free &middot; one taker &middot; about 7 min</span>
      </div>
    </form>
  );
}
