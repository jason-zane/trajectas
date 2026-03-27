import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { getItemHealth } from "@/app/actions/psychometrics"
import { ItemHealthList } from "./item-health-list"

export default async function ItemHealthPage() {
  const items = await getItemHealth()

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Psychometrics"
        title="Item Health"
        description="Quality metrics for every item in your library. Items needing attention appear first."
      />

      {items.length === 0 ? (
        <EmptyState
          variant="item"
          title="No item statistics yet"
          description="Item health metrics are computed during calibration runs. Once you have candidate response data, run a calibration to see difficulty, discrimination, and reliability contributions for every item."
        />
      ) : (
        <ItemHealthList items={items} />
      )}
    </div>
  )
}
