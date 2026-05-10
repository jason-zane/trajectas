import { getCachedPlatformBrand } from "@/app/actions/brand"
import { BrandEditor } from "./brand-editor"

export default async function BrandSettingsPage() {
  const record = await getCachedPlatformBrand()

  return <BrandEditor initialRecord={record} />
}
