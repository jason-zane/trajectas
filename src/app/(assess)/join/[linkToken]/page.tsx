import { JoinForm } from "@/components/assess/join-form";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ linkToken: string }>;
}) {
  const { linkToken } = await params;

  return <JoinForm linkToken={linkToken} />;
}
