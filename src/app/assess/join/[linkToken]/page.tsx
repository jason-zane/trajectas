import { getEffectiveExperience } from "@/app/actions/experience";
import { getPageContent } from "@/lib/experience/resolve";
import { JoinForm } from "@/components/assess/join-form";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ linkToken: string }>;
}) {
  const { linkToken } = await params;

  // Load platform default template (no campaign context at join time)
  const experience = await getEffectiveExperience();
  const content = getPageContent(experience, "join");

  return <JoinForm linkToken={linkToken} content={content} />;
}
