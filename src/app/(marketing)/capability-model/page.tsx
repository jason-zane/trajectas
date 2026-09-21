import type { Metadata } from "next";
import Link from "next/link";
import { getPublicCapabilityModel } from "@/lib/dal/public-capability-model";
import { PublicPage, PublicNext } from "../components/public-page";
import { ModelExplorer } from "./model-explorer";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "The capability model — Trajectas", description: "Explore the current capability library, its groupings, definitions and behavioural indicators.", alternates: { canonical: "/capability-model" } };
export default async function Page() {
  let capabilities: Awaited<ReturnType<typeof getPublicCapabilityModel>> = [];
  let unavailable = false;
  const preview = process.env.NODE_ENV === "development" && Boolean(process.env.PUBLIC_CAPABILITY_MODEL_SNAPSHOT);
  try { capabilities = await getPublicCapabilityModel(); } catch { unavailable = true; }
  return <PublicPage label="The capability model" title="Different capabilities. A connected view of work." intro="Explore what each capability describes, how it can show up at work, and the other capabilities in its grouping."><section className="px-container px-model-intro"><div><h2>Understand the model as a whole.</h2><p>Groupings help organise related concepts. Capabilities describe distinct aspects of how people approach work; behavioural indicators explain different levels of expression.</p></div><div><h2>A role brings the context.</h2><p>A role may draw on capabilities across several groupings. Role Builder recommends a relevant set from the eligible library; it does not assess every capability or treat one responsibility as one capability.</p><Link className="px-link" href="/how-it-works">How role matching works</Link></div></section><section className="px-container px-model-library" aria-label="Capability library"><p className="rb-note">{preview && <strong>Local preview: saved library snapshot, not a live database connection. </strong>}This explorer reflects the current active library. Names, groupings and descriptions may evolve as the model is refined. Saved assessments may reflect an earlier version.</p>{unavailable ? <div className="px-model-empty"><h2>The library isn’t available right now.</h2><p>We couldn’t load the current model. Please try again, or contact us for more information.</p><a className="px-button" href="/capability-model">Try again</a> <Link className="px-link" href="/contact">Contact us</Link></div> : capabilities.length ? <ModelExplorer capabilities={capabilities} /> : <p className="px-model-empty">There are no active capabilities to display yet.</p>}</section><PublicNext /></PublicPage>;
}
