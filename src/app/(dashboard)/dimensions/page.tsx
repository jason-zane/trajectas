import { getDimensions } from "@/app/actions/dimensions"
import { DimensionList } from "@/app/(dashboard)/dimensions/dimension-list"

export default async function DimensionsPage() {
  const dimensions = await getDimensions()

  return <DimensionList dimensions={dimensions} />
}
