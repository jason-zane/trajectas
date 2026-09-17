import type { Brief } from "@/types/ai";
import type { ArchitectPick } from "@/types/architect";
import { WallHeader } from "./wall-header";

export type WorkingStage = "reading" | "weighing" | "pinning";

export function WorkingStep({
  email,
  brief,
  stage,
  consideredCount,
  revealed,
  target,
}: {
  email: string;
  brief: Brief | null;
  stage: WorkingStage;
  consideredCount: number | null;
  revealed: ArchitectPick[];
  target: number;
}) {
  const faceDown = Math.max(target - revealed.length, 0);

  return (
    <div className="wall" style={{ minHeight: "100vh" }}>
      <WallHeader email={email} />
      <div className="mx-auto max-w-[1120px] px-6 pb-24 pt-4 sm:px-12">
        <h1 className="display mb-10" style={{ fontSize: "clamp(2.25rem, 5vw, 2.75rem)" }}>
          Reading the role.
        </h1>

        <div className="grid gap-10 lg:grid-cols-2">
          <section aria-labelledby="w-role">
            <p id="w-role" className="label label-paper mb-3">
              The role
            </p>
            <div className="card relative flex min-h-[320px] flex-col gap-3.5 p-7">
              <i className="pin" aria-hidden="true" />
              <p className="title" style={{ fontSize: 20 }}>
                {brief?.roleTitle || "…"}
              </p>
              <div className="rule" />
              {brief ? (
                <>
                  <div className="grid grid-cols-[100px_1fr] gap-2 gap-x-4 text-sm">
                    <span className="label label-ink" style={{ paddingTop: 3 }}>
                      Read as
                    </span>
                    <span className="body" style={{ fontSize: 14.5 }}>
                      {brief.roleTitle} &middot; {brief.function || "General"} &middot; {brief.level}
                    </span>
                    {brief.responsibilities.length > 0 && (
                      <>
                        <span className="label label-ink" style={{ paddingTop: 3 }}>
                          Owns
                        </span>
                        <span className="body" style={{ fontSize: 14.5 }}>
                          {brief.responsibilities.slice(0, 3).join("; ")}
                        </span>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <p className="body-soft">Reading the position description&hellip;</p>
              )}
            </div>
          </section>

          <section aria-labelledby="w-pins" aria-live="polite">
            <div className="mb-3.5 flex items-baseline justify-between">
              <p id="w-pins" className="label label-paper">
                Pinned for this role
              </p>
              <p className="label label-paper" style={{ color: "var(--gold)" }}>
                {revealed.length} of {target}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
              {revealed.map((pick) => (
                <div key={pick.factorId} className="cap-card" style={{ minHeight: 150 }}>
                  <i className="pin" aria-hidden="true" />
                  <p className="title" style={{ fontSize: 16 }}>
                    {pick.factorName}
                  </p>
                  <p className="body-soft" style={{ fontSize: 13 }}>
                    {pick.definition?.slice(0, 90) || "—"}
                  </p>
                </div>
              ))}
              {Array.from({ length: faceDown }).map((_, i) => (
                <div key={i} className="card face-down" style={{ minHeight: 150 }} />
              ))}
            </div>

            <div className="narrate mt-8 flex flex-col gap-1.5">
              <p className={stage !== "reading" ? "done" : ""} style={{ margin: 0 }}>
                Read the role
                {brief ? ` — ${brief.roleTitle} · ${brief.function || "General"} · ${brief.level}` : ""}
                {stage === "reading" && <span className="caret" aria-hidden="true" />}
              </p>
              {stage !== "reading" && (
                <p className={stage !== "weighing" ? "done" : ""} style={{ margin: 0 }}>
                  Weighed {consideredCount ?? "…"} capabilities against it
                  {stage === "weighing" && <span className="caret" aria-hidden="true" />}
                </p>
              )}
              {stage === "pinning" && (
                <p style={{ margin: 0 }}>
                  Pinning the ones it turns on &mdash; {revealed.length} of {target}
                  <span className="caret" aria-hidden="true" />
                </p>
              )}
            </div>
          </section>
        </div>

        <p className="label label-paper mt-10" style={{ opacity: 0.7 }}>
          About 20 seconds &middot; nothing is created yet
        </p>
      </div>
    </div>
  );
}
