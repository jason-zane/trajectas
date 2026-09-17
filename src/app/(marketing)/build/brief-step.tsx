"use client";

import { useRef, useState, useTransition } from "react";
import { extractRoleTextUpload } from "@/app/actions/public-builds";
import {
  PUBLIC_BUILDS_TIER_ORDER,
  PUBLIC_BUILDS_TIERS,
  PUBLIC_BUILDS_MAX_PD_CHARS,
  type PublicBuildTier,
  estimatePublicBuildMinutes,
} from "@/lib/public-builds/shared";
import { WallPage } from "./wall-page";

function tierMinutes(tier: PublicBuildTier) {
  return estimatePublicBuildMinutes(PUBLIC_BUILDS_TIERS[tier].capabilities);
}

export function BriefStep({
  email,
  onSubmit,
  error,
}: {
  email: string;
  onSubmit: (input: { roleTitle: string; pdText: string; tier: PublicBuildTier }) => void;
  error: string | null;
}) {
  const [roleTitle, setRoleTitle] = useState("");
  const [pdText, setPdText] = useState("");
  const [tier, setTier] = useState<PublicBuildTier>("core");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setUploadError(null);
    startUpload(async () => {
      const formData = new FormData();
      formData.append("file", file);
      const result = await extractRoleTextUpload(formData);
      if ("error" in result) {
        setUploadError(result.error);
        return;
      }
      setPdText(result.text.slice(0, PUBLIC_BUILDS_MAX_PD_CHARS));
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!roleTitle.trim() || !pdText.trim()) return;
    onSubmit({ roleTitle: roleTitle.trim(), pdText: pdText.trim(), tier });
  }

  return (
    <WallPage email={email}>
        <h1 className="display mb-10" style={{ fontSize: "clamp(2.25rem, 5vw, 2.75rem)" }}>
          Pin up the role.
        </h1>

        <form onSubmit={submit} className="grid gap-10 lg:grid-cols-2">
          {/* LEFT: the role */}
          <section aria-labelledby="b-role">
            <p id="b-role" className="label label-paper mb-3">
              The role
            </p>
            <div className="card relative flex flex-col gap-4 p-7">
              <i className="pin" aria-hidden="true" />
              <div>
                <label htmlFor="job-title" className="field-label">
                  Job title
                </label>
                <input
                  id="job-title"
                  className="strip"
                  type="text"
                  required
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder="e.g. Senior Product Manager, Payments"
                />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor="pd" className="field-label" style={{ margin: 0 }}>
                    Position description
                  </label>
                  <button
                    type="button"
                    className="btn btn-paper"
                    style={{ minHeight: 34, padding: "0 12px", fontSize: 11 }}
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? "Reading…" : "Upload PDF or Word"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                      e.target.value = "";
                    }}
                  />
                </div>
                <textarea
                  id="pd"
                  className="sheet-text strip"
                  rows={12}
                  style={{ fontSize: 15, lineHeight: 1.55, padding: "12px 14px", resize: "vertical" }}
                  maxLength={PUBLIC_BUILDS_MAX_PD_CHARS}
                  required
                  value={pdText}
                  onChange={(e) => setPdText(e.target.value)}
                  placeholder="Paste the position description here."
                />
                {uploadError && <p className="body-soft text-red-700">{uploadError}</p>}
                <p className="body-soft" style={{ fontSize: 13 }}>
                  {pdText.length.toLocaleString("en-AU")} / {PUBLIC_BUILDS_MAX_PD_CHARS.toLocaleString("en-AU")}{" "}
                  characters. Nothing is stored until you create the assessment.
                </p>
              </div>
              {error && <p className="body-soft text-red-700">{error}</p>}
              <div className="mt-1 flex items-center justify-between gap-4">
                <button type="submit" className="btn btn-primary">
                  Build the assessment
                </button>
                <span className="measure">Takes about 20 seconds</span>
              </div>
            </div>
          </section>

          {/* RIGHT: how much of the role */}
          <section aria-labelledby="b-size">
            <p id="b-size" className="label label-paper mb-3">
              How much of the role to measure
            </p>
            <fieldset className="flex flex-col gap-3.5 border-0 p-0 m-0">
              <legend className="body mb-3.5" style={{ color: "var(--mint)", fontSize: 14.5, maxWidth: "52ch" }}>
                More capabilities gives a broader read of the person and more to interpret. The time
                stays short either way.
              </legend>
              {PUBLIC_BUILDS_TIER_ORDER.map((t) => {
                const meta = PUBLIC_BUILDS_TIERS[t];
                const selected = tier === t;
                return (
                  <label
                    key={t}
                    htmlFor={`tier-${t}`}
                    className={`card relative grid cursor-pointer grid-cols-[24px_1fr_auto] items-center gap-3.5 px-5 py-4.5 ${selected ? "lift" : ""}`}
                    style={{
                      boxShadow: selected ? undefined : "none",
                      border: selected ? "1px solid var(--gold)" : "1px solid rgba(251,250,246,0.35)",
                      background: selected ? undefined : "rgba(251,250,246,0.94)",
                    }}
                  >
                    {selected && <i className="pin" aria-hidden="true" />}
                    <input
                      id={`tier-${t}`}
                      type="radio"
                      name="tier"
                      checked={selected}
                      onChange={() => setTier(t)}
                      style={{ width: 18, height: 18, margin: 0, accentColor: "#8a6d2c" }}
                    />
                    <span className="flex flex-col gap-1">
                      <span className="title" style={{ fontSize: 17, fontWeight: selected ? 700 : 400 }}>
                        {meta.label}
                      </span>
                      <span className="body-soft" style={{ fontSize: 13.5 }}>
                        {meta.blurb}
                      </span>
                    </span>
                    <span className="measure">
                      {meta.capabilities} capabilities &middot; ~{tierMinutes(t)} min
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <div className="card relative mt-7 flex flex-col gap-2 p-5">
              <i className="pin pin-left" aria-hidden="true" />
              <p className="label label-ink">What happens next</p>
              <p className="body-soft">
                It reads the role, weighs the capability library against it, and pins the ones it
                turns on. Then you adjust. Nothing is created until you say so.
              </p>
            </div>
          </section>
        </form>

        <p className="label label-paper mt-10" style={{ opacity: 0.7 }}>
          Free &middot; one taker &middot; your report by email
        </p>
    </WallPage>
  );
}
