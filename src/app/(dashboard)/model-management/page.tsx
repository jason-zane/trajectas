import { getManagedCapabilities } from '@/lib/dal/model-management'
import { ModelManagement } from './model-management'
export default async function ModelManagementPage() {
  return <ModelManagement capabilities={await getManagedCapabilities()} />
}
