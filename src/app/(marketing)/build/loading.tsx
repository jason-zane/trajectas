import { LoaderCircle } from "lucide-react";
import { BuilderFrame, BuilderHeading } from "./builder-frame";
import "../public-experience.css";
export default function BuildLoading() {
  return <BuilderFrame step={0}><BuilderHeading title="Opening the Role Builder." /><p role="status" className="px-link"><LoaderCircle size={18} className="rb-spinner" aria-hidden />Checking your progress…</p></BuilderFrame>;
}
