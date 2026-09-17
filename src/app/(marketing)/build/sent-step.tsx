import { PUBLIC_BUILDS_ITEMS_PER_FACTOR } from "@/lib/public-builds/shared";
import { WallPage } from "./wall-page";

export function SentStep({
  email,
  roleTitle,
  capabilityCount,
  token,
  emailSent,
  onBuildAnother,
}: {
  email: string;
  roleTitle: string;
  capabilityCount: number;
  token: string;
  emailSent: boolean;
  onBuildAnother: () => void;
}) {
  const itemCount = capabilityCount * PUBLIC_BUILDS_ITEMS_PER_FACTOR;
  const assessPath = `/assess/${token}`;

  return (
    <WallPage email={email}>
        <div className="grid gap-8 lg:grid-cols-[264px_1fr_264px]">
          <section>
            <div className="card relative flex flex-col gap-2 p-5">
              <i className="pin" aria-hidden="true" />
              <p className="label label-ink">Now on the wall</p>
              <p className="body" style={{ fontSize: 14.5 }}>
                {roleTitle}
              </p>
              <span className="measure">
                {capabilityCount} capabilities &middot; {itemCount} items
              </span>
              <div className="rule" />
              <p className="body-soft" style={{ fontSize: 13 }}>
                The assessment and its link exist. Nothing else happens until you take it.
              </p>
            </div>
          </section>

          <section aria-labelledby="s-title">
            <div className="card lift relative flex flex-col gap-4 p-9">
              <i className="pin pin-left" aria-hidden="true" />
              <i className="pin pin-right" aria-hidden="true" />
              <h1
                id="s-title"
                className="title"
                style={{ fontFamily: "var(--display)", fontWeight: 400, fontSize: 30, lineHeight: 1.1 }}
              >
                {emailSent ? `Sent to ${email}.` : "Your link is ready."}
              </h1>
              {emailSent ? (
                <p className="body">
                  Open the email and follow the link. When you finish, your report comes back to the
                  same address as a PDF, with a link to the page.
                </p>
              ) : (
                <>
                  <p className="body">
                    We couldn&rsquo;t deliver the email to {email}. Open the link below instead. When
                    you finish, your report is sent to the same address as a PDF, with a link to the
                    page.
                  </p>
                  <a className="btn btn-primary self-start" href={assessPath}>
                    Open the assessment
                  </a>
                </>
              )}
              <div className="rule" />
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="measure">Link lasts 7 days &middot; one taker &middot; free</span>
                <button type="button" className="btn btn-paper" style={{ minHeight: 42, fontSize: 11.5, boxShadow: "none" }} onClick={onBuildAnother}>
                  Build another role
                </button>
              </div>
            </div>
          </section>

          <section>
            <div className="card relative flex flex-col gap-2 p-5">
              <i className="pin" aria-hidden="true" />
              <p className="label label-ink">For a real programme</p>
              <p className="body-soft" style={{ fontSize: 13.5 }}>
                Candidates, teams, partners and norms are the platform, not the wall.
              </p>
              <a
                className="on-baize-link"
                href="mailto:hello@trajectas.com"
                style={{ color: "var(--gold-ink)", borderBottomColor: "var(--gold-ink)", fontSize: 14 }}
              >
                Talk to us
              </a>
            </div>
          </section>
        </div>

        {emailSent && (
          <p className="label label-paper mt-12" style={{ opacity: 0.7 }}>
            Didn&rsquo;t get it? Check spam.
          </p>
        )}
    </WallPage>
  );
}
