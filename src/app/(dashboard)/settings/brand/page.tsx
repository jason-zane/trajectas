import { connection } from "next/server"
import { getCachedPlatformBrand } from "@/lib/dal/brand"
import { BrandEditor } from "./brand-editor"

export default async function BrandSettingsPage() {
  await connection()
  const record = await getCachedPlatformBrand()

  return <BrandEditor initialRecord={record} />
}
