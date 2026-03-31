import { PageHeader } from "@/components/page-header"
import { getItemSelectionRules } from "@/app/actions/item-selection-rules"
import { RulesEditor } from "./rules-editor"

export default async function ItemSelectionSettingsPage() {
  const rules = await getItemSelectionRules()

  return (
    <div className="flex flex-col gap-8 p-6">
      <PageHeader
        eyebrow="Settings"
        title="Item Selection Rules"
        description="Configure how many items per construct are selected based on the total number of constructs in an assessment."
      />
      <RulesEditor initialRules={rules} />
    </div>
  )
}
