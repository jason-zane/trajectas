import { redirect } from "next/navigation"

export default async function PromptDetailRedirect({
  params,
}: {
  params: Promise<{ purpose: string }>
}) {
  const { purpose } = await params
  redirect(`/settings/ai/${purpose}`)
}
