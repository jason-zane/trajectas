"use client";
import { BuilderFrame, BuilderHeading } from "./builder-frame";
import "../public-experience.css";
export default function BuildPageError({ reset }: { reset: () => void }) {
  return <BuilderFrame step={0}><div className="rb-ready"><BuilderHeading title="We couldn’t load the Role Builder.">Your existing assessment is still available through its personal link. Try loading this page again, or contact us if the problem continues.</BuilderHeading><div className="px-actions"><button className="px-button" onClick={reset}>Try again</button><a className="px-link" href="mailto:hello@trajectas.com">Get help</a></div></div></BuilderFrame>;
}
