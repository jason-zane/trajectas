import { getPlatformBrand } from "@/app/actions/brand"
import { BrandEditor } from "./brand-editor"

export default async function BrandSettingsPage() {
  const record = await getPlatformBrand()

  return <BrandEditor initialRecord={record} />
}
