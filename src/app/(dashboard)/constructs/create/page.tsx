import { ConstructForm } from "../construct-form"
import { getFactorsForSelect } from "@/app/actions/constructs"

export default async function CreateConstructPage() {
  const factors = await getFactorsForSelect()
  return <ConstructForm mode="create" availableFactors={factors} />
}
